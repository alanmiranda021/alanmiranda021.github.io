"""Numerical regression and generated artifact checks for propulsion."""
import copy
import tempfile
import unittest
from pathlib import Path

import propulsao as p


class PropulsionTests(unittest.TestCase):
    def test_reference_values(self):
        self.assertTrue(p.validar(p.CONFIG))

    def test_invalid_grid(self):
        cfg = copy.deepcopy(p.CONFIG)
        cfg['helice']['diametro']['passo'] = 0
        with self.assertRaises(ValueError):
            p.backtest(cfg)

    def test_complete_workflow_and_balance(self):
        cfg = copy.deepcopy(p.CONFIG)
        with tempfile.TemporaryDirectory() as directory:
            cfg['backtest']['saida'] = directory
            p.rodar_tudo(cfg)
            for name in ('ranking.csv', 'curva_velocidades.csv', 'relatorio.html'):
                self.assertGreater(Path(directory, name).stat().st_size, 0)
        accepted, fallback, funnel, _ = p.backtest(cfg, verbose=False)
        self.assertGreater(len(fallback), 0)
        self.assertTrue(all(a[1] >= b[1] for a, b in zip(funnel, funnel[1:])))
        row = (accepted if len(accepted) else fallback).iloc[0]
        point = p.avaliar_ponto(cfg, row['D'], int(row['Z']), row['Ae/Ao'], row['P/D'], row['rpm'])
        self.assertAlmostEqual(point['T_disp'] / point['T_req'], 1.0, places=7)


if __name__ == '__main__':
    unittest.main()
