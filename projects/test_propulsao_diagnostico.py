import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import propulsao as p
import propulsao_busca as busca


class DiagnosticTests(unittest.TestCase):
    def config(self):
        cfg = copy.deepcopy(p.CONFIG)
        cfg['helice']['z'] = [4, 5]
        cfg['helice']['diametro'] = dict(min=8, max=8, passo=.1)
        cfg['helice']['ae_ao'] = dict(min=.95, max=1.05, passo=.05)
        cfg['helice']['p_d'] = dict(min=1.35, max=1.4, passo=.05)
        return cfg

    def test_violation_matches_workbook_and_all_bounds(self):
        motors = [('G90', 72, 84, 76000, 30000)]
        diagnostic = p.diagnostico_motor([49653.728, 76000, 100000, 10000, 30000], [90.274, 84, 90, 60, 72], motors)
        self.assertAlmostEqual(diagnostic.iloc[0].viol_total, (90.274-84)/90.274)
        self.assertEqual(diagnostic.iloc[0].motor_p_max_kw, 76000)
        self.assertEqual(diagnostic.iloc[1].viol_total, 0)
        self.assertEqual(diagnostic.iloc[2].viol_kw, .24)
        self.assertEqual(diagnostic.iloc[2].viol_total, .24)
        self.assertEqual(diagnostic.iloc[3].motivo_motor, 'rpm e potência')
        for power, rpm, row in zip([49653.728, 76000, 100000, 10000, 30000], [90.274, 84, 90, 60, 72], diagnostic.itertuples()):
            self.assertEqual(row.viol_total == 0, bool(p.motores_que_cabem(power, rpm, motors)))

    def test_official_catalog_variants(self):
        rows = p.carregar_motores(p.CONFIG)
        self.assertEqual(len(rows), 56)
        g90 = next(row for row in rows if row[0] == '8G90ME-C10.5')
        self.assertEqual(tuple(g90[1:]), (72, 84, 49920, 37360))

    def test_empty_and_invalid_diagnostic(self):
        self.assertTrue(p.diagnostico_motor([], [], p.MOTORES).empty)
        with self.assertRaises(ValueError):
            p.diagnostico_motor([0], [84], p.MOTORES)

    def test_fallback_order_and_complete_batched_diagnostic(self):
        cfg = self.config()
        g, f, steps, _ = p.backtest(cfg, verbose=False)
        self.assertEqual(f.iloc[0]['Z'], 5)
        self.assertTrue(f.viol_total.is_monotonic_increasing)
        with tempfile.TemporaryDirectory() as directory:
            target = str(Path(directory, 'diagnostico_motor.csv'))
            _, batched, actual_steps, _, _ = busca.backtest_perfil(cfg, 'personalizado', tamanho_lote=2, diagnostico_destino=target)
            self.assertEqual(len(pd.read_csv(target)), len(f))
            pd.testing.assert_frame_equal(f.head(15).reset_index(drop=True), batched)
            self.assertEqual(steps, actual_steps)

    def test_margin_chain_and_boundary_warnings(self):
        factors = p.margens(1, 1, p.CONFIG['margens'])
        self.assertAlmostEqual(factors['bhp3'], 1.464395625)
        self.assertAlmostEqual(factors['rpm3'], 1.13558454755598)
        limits = p.avisos_limites(p.CONFIG, {'Z':5, 'D':8, 'P/D':1.4, 'Ae/Ao':1.05})
        self.assertEqual(len(limits), 3)
        cfg = self.config()
        cfg['helice']['diametro'] = dict(min=5, max=8.04, passo=.1)
        self.assertTrue(any('limite de D' in message for message in p.avisos_limites(cfg, {'Z':5,'D':8,'P/D':1.4,'Ae/Ao':1.05})))

    def test_sfoc_clamp_and_curve_envelope(self):
        self.assertEqual(p.sfoc(.01, p.CONFIG), p.sfoc(.25, p.CONFIG))
        self.assertEqual(p.sfoc(1.43, p.CONFIG), p.sfoc(1, p.CONFIG))
        cfg = self.config()
        cfg['perfil_velocidades'] = [5, 25, 30]
        _, frame, _, _ = p.backtest(cfg, verbose=False)
        row = frame.iloc[0]
        curve = p.curva_velocidades(cfg, (row['D'], int(row['Z']), row['Ae/Ao'], row['P/D']), row['MCR_kW'])
        low, service, high = (curve.iloc[i] for i in range(3))
        self.assertFalse(low.consumo_confiavel)
        self.assertTrue(np.isnan(low.FOC_t_h))
        self.assertEqual(low.carga_sfoc, .25)
        self.assertTrue(service.consumo_confiavel)
        self.assertGreater(high.carga, 1)
        self.assertTrue(np.isnan(high.FOC_t_h))
        self.assertIn('fora do envelope', high.status_envelope)
        self.assertEqual(high.carga_sfoc, 1)

    def test_save_and_replay_recorded_catalog(self):
        cfg = self.config()
        with tempfile.TemporaryDirectory() as directory:
            cfg['backtest']['saida'] = directory
            p.rodar_tudo(cfg)
            saved = json.loads(Path(directory, 'config_execucao.json').read_text(encoding='utf-8'))
            self.assertEqual(saved['config']['helice'], cfg['helice'])
            self.assertIn('+00:00', saved['data_utc'])
            self.assertEqual(len(saved['catalogo']), 56)
            with patch.object(p, 'rodar_tudo') as run:
                p.main(['tudo', '--config', str(Path(directory, 'config_execucao.json'))])
                replay = run.call_args.args[0]
                self.assertEqual(p.carregar_motores(replay), p.carregar_motores(cfg))
                self.assertEqual(p.registro_execucao(replay, saved['funil'])['catalogo_sha256'], saved['catalogo_sha256'])
            self.assertTrue(Path(directory, 'diagnostico_motor.csv').exists())
            report = Path(directory, 'relatorio.html').read_text(encoding='utf-8')
            self.assertIn('Reprodutibilidade', report)
            self.assertIn('Margens de potência', report)

    def test_validation_reports_actual_grid_size(self):
        self.assertEqual(p.validar_config(p.CONFIG), 29450)
        cfg = busca.configurar_perfil(p.CONFIG, 'detalhado')
        self.assertEqual(p.tamanho_malha(cfg), 214415)
        with self.assertRaisesRegex(ValueError, '214,415'):
            p.validar_config(cfg)

    def test_cli_profile_writes_effective_configuration(self):
        cfg = self.config()
        with tempfile.TemporaryDirectory() as directory:
            cfg['backtest']['saida'] = directory
            input_path = Path(directory, 'input.json')
            input_path.write_text(json.dumps(cfg), encoding='utf-8')
            p.main(['tudo', '--config', str(input_path), '--perfil', 'detalhado'])
            record = json.loads(Path(directory, 'config_execucao.json').read_text(encoding='utf-8'))
            self.assertEqual(record['perfil'], 'detalhado')
            self.assertEqual(record['config']['helice']['p_d']['passo'], .025)
            self.assertEqual(len(pd.read_csv(Path(directory, 'diagnostico_motor.csv'))), next(count for name, count in record['funil'] if name.startswith('Cavitacao')))


if __name__ == '__main__':
    unittest.main()
