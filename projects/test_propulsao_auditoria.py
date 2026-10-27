import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd
import propulsao as p
import propulsao_busca as busca
from propulsao_auditoria import AuditoriaFunil, diagnosticar_viabilidade, historico_csv, hashes_fontes


class AuditTests(unittest.TestCase):
    def config(self):
        cfg = copy.deepcopy(p.CONFIG)
        cfg['helice'].update(z=[4], diametro=dict(min=8,max=8,passo=.1),
                             ae_ao=dict(min=.7,max=.7,passo=.05), p_d=dict(min=.85,max=.85,passo=.05))
        return cfg

    def run_audit(self, cfg):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'diagnostico.csv'
            audit = AuditoriaFunil(path)
            g,f,funnel,r = p.backtest(cfg, False, audit.registrar)
            history = audit.finalizar(cfg,funnel)
            with path.open(encoding='utf-8',newline='') as handle:
                rows = list(csv.DictReader(handle))
        self.assertEqual(history['avaliados_brutos'],funnel[0][1])
        self.assertEqual(len(rows),funnel[0][1])
        self.assertEqual(history['analisados_motor']+history['rejeitados_antes_motor'],funnel[0][1])
        return g,f,rows,history

    def test_observer_preserves_values_and_records_unavailable_as_empty(self):
        cfg = self.config()
        g,f,_,_ = p.backtest(cfg,False)
        observed, fallback, rows, history = self.run_audit(cfg)
        pd.testing.assert_frame_equal(g,observed,check_exact=True)
        pd.testing.assert_frame_equal(f,fallback,check_exact=True)
        self.assertEqual(rows[0]['analisado_motor'],'True')
        self.assertEqual(float(rows[0]['MCR_kW']),float(f.iloc[0].MCR_kW))
        self.assertEqual(len(list(csv.DictReader(historico_csv([history]).splitlines()))),1)

    def test_first_rejections_bracket_coefficients_efficiency_and_power_limit(self):
        for status, change in (
            ('SEM_BRACKET',lambda cfg:cfg['helice'].update(rpm=dict(min=40,max=41))),
            ('J_KT_KQ',lambda cfg:cfg['restricoes'].update(j_min=10)),
            ('EFICIENCIA',lambda cfg:cfg['restricoes'].update(eta0_max=.01)),
            ('MCR_LIMITE',lambda cfg:cfg['restricoes'].update(potencia_max_motor_kw=1)),
        ):
            with self.subTest(status=status):
                cfg=self.config();change(cfg)
                _,_,rows,history=self.run_audit(cfg)
                self.assertEqual(rows[0]['status'],status)
                self.assertEqual(rows[0]['analisado_motor'],'False')
                self.assertEqual(rows[0]['motor_proximo'],'')
                self.assertEqual(history['rejeitados_antes_motor'],1)

    def test_cavitation_rejection(self):
        original=p.burrill
        def rejected(*args,**kwargs):
            ok,tau,maximum,sigma=original(*args,**kwargs)
            return np.zeros_like(ok,dtype=bool),tau,maximum,sigma
        with patch.object(p,'burrill',side_effect=rejected):
            _,_,rows,_=self.run_audit(self.config())
        self.assertEqual(rows[0]['status'],'CAVITACAO')
        self.assertNotEqual(rows[0]['sigma'],'')

    def test_compatible_and_only_power_incompatible_catalog(self):
        for maximum,status in ((1000000,'VIAVEL'),(1,'POTENCIA_MOTOR')):
            with patch.object(p,'carregar_motores',return_value=[('TESTE',1,1000,maximum,.001)]):
                _,f,rows,_=self.run_audit(self.config())
                diag=diagnosticar_viabilidade(f.iloc[0],self.config())
            self.assertEqual(rows[0]['status'],status)
            self.assertEqual(diag['status'],status)
            self.assertEqual(diag['viavel'],status=='VIAVEL')
            self.assertEqual(diag['rpm_motor_servico'],float(f.iloc[0].rpm))

    def test_batched_trace_conservation_and_calibration_unchanged(self):
        cfg=self.config();cfg['helice']['z']=[3,4,5,6]
        cfg['helice']['ae_ao']=dict(min=.7,max=1.05,passo=.05)
        with tempfile.TemporaryDirectory() as directory:
            audit=AuditoriaFunil(Path(directory)/'round.csv')
            g,f,funnel,_,used=busca.backtest_perfil(cfg,'personalizado',tamanho_lote=4,auditoria=audit.registrar)
            record=audit.finalizar(used,funnel)
        self.assertEqual(record['avaliados_brutos'],funnel[0][1])
        plain=busca.calibrar_motor(cfg,nivel='rapido')
        with tempfile.TemporaryDirectory() as directory:
            audit=AuditoriaFunil(Path(directory)/'calibration.csv')
            observed=busca.calibrar_motor(cfg,nivel='rapido',auditoria=audit.registrar)
            record=audit.finalizar(observed[4],observed[2])
        pd.testing.assert_frame_equal(plain[0],observed[0],check_exact=True)
        pd.testing.assert_frame_equal(plain[1],observed[1],check_exact=True)
        self.assertEqual(plain[5],observed[5])
        self.assertEqual(record['avaliados_brutos'],observed[2][0][1])

    def test_frozen_reference_point_and_hashes(self):
        baseline=json.loads((Path(__file__).parent/'baselines/p0_antes.json').read_text(encoding='utf-8'))
        expected=baseline['casos']['pontual']
        g,f,_,r=p.backtest(expected['config'],False)
        row=(g if len(g) else f).iloc[0]
        for key in ('rpm','BHP_kW','MCR_kW','RPM_MCR','SFOC','FOC_t_h'):
            self.assertLessEqual(abs(float(row[key])-expected['melhor'][key]),1e-9+1e-10*abs(expected['melhor'][key]))
        for key in ('RT','EHP_kW'):
            self.assertLessEqual(abs(r[key]-expected[key]),1e-9+1e-10*abs(expected[key]))
        hashes=hashes_fontes()
        self.assertEqual(hashes['projects/motores.csv'],baseline['hashes']['projects/motores.csv'])
        self.assertEqual(len(hashes['naval.js']['lf_sha256']),64)
        self.assertEqual(len(baseline['hashes']['naval.js']['lf_sha256']),64)

    def test_reference_geometry_stays_incompatible_by_rpm(self):
        baseline=json.loads((Path(__file__).parent/'baselines/p0_antes.json').read_text(encoding='utf-8'))
        expected=baseline['casos']['referencia_detalhada']; row=expected['melhor']
        cfg=copy.deepcopy(expected['config'])
        cfg['helice']['z']=[row['Z']]
        for key,column in (('diametro','D'),('ae_ao','Ae/Ao'),('p_d','P/D')):
            cfg['helice'][key].update(min=row[column],max=row[column])
        g,f,rows,_=self.run_audit(cfg)
        self.assertTrue(g.empty)
        diag=diagnosticar_viabilidade(f.iloc[0],expected['config'])
        self.assertFalse(diag['viavel'])
        self.assertEqual(diag['status'],'RPM_MOTOR')
        self.assertEqual(diag['rpm_motor_max'],84)
        self.assertEqual(diag['motor_proximo'],'8G90ME-C10.5')
        for key in ('rpm','BHP_kW','MCR_kW','RPM_MCR','SFOC','FOC_t_h'):
            self.assertLessEqual(abs(float(f.iloc[0][key])-row[key]),1e-9+1e-10*abs(row[key]))
        self.assertEqual(rows[0]['status'],'RPM_MOTOR')

    def test_limit_input_and_last_sample_are_distinct(self):
        cfg=self.config();cfg['helice']['p_d']=dict(min=.85,max=.94,passo=.05)
        _,f,_,_=p.backtest(self.config(),False)
        row=f.iloc[0].copy();row['P/D']=.9
        limits=diagnosticar_viabilidade(row,cfg)['limites_geometricos']
        pitch=next(item for item in limits if item['parametro']=='P/D')
        self.assertTrue(pitch['no_ultimo_ponto'])
        self.assertFalse(pitch['no_teto'])
        self.assertEqual(pitch['teto_efetivo'],.94)


if __name__=='__main__':
    unittest.main()
