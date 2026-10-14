import copy
import tempfile
import unittest
from pathlib import Path
import pandas as pd
import propulsao as p
import propulsao_busca as busca
from propulsao_auditoria import AuditoriaFunil


class BladeComparisonTests(unittest.TestCase):
    def config(self):
        cfg=copy.deepcopy(p.CONFIG)
        cfg['helice'].update(z=[2,3,4,5,6,7],diametro=dict(min=8,max=8,passo=.1),
                            ae_ao=dict(min=.7,max=1.05,passo=.05),p_d=dict(min=1.2,max=1.4,passo=.05))
        cfg['backtest']['top']=1
        return cfg

    def execute(self,cfg,previous=None):
        with tempfile.TemporaryDirectory() as directory:
            audit=AuditoriaFunil(Path(directory)/'audit.csv',config=cfg)
            result=busca.backtest_perfil(cfg,'personalizado',tamanho_lote=4,auditoria=audit.registrar)
            audit.finalizar(result[4],result[2])
            return result,audit.resumo_pas(result[4],previous)

    def test_real_counts_and_independent_rankings_even_when_global_excludes_z(self):
        cfg=self.config();result,summary=self.execute(cfg)
        self.assertEqual([row['Z'] for row in summary],[2,3,4,5,6,7])
        self.assertEqual(summary[0]['status'],'EXCLUIDA_DOMINIO_AE_AO')
        self.assertEqual(summary[0]['avaliadas_rodada'],0)
        self.assertEqual(sum(row['geradas_rodada'] for row in summary),result[2][0][1])
        _,full,_,_=p.backtest(cfg,False)
        for category in summary:
            self.assertEqual(category['geradas_rodada'],category['rejeitadas_antes_motor']+category['analisadas_motor'])
            expected=full[full.Z==category['Z']].head(cfg['backtest']['top'])
            self.assertEqual(len(category['ranking']),len(expected))
            if len(expected):
                actual=pd.DataFrame(category['ranking'])[expected.columns]
                pd.testing.assert_frame_equal(expected.reset_index(drop=True),actual,check_dtype=False,check_exact=True)
        self.assertGreater(sum(bool(row['ranking']) for row in summary),len(result[1]))

    def test_missing_config_and_no_solution_remain_visible(self):
        cfg=self.config();cfg['helice']['z']=[4];cfg['helice']['rpm']=dict(min=40,max=41)
        _,summary=self.execute(cfg)
        self.assertEqual(summary[0]['status'],'EXCLUIDA_CONFIG')
        category=summary[2]
        self.assertEqual(category['status'],'SEM_SOLUCAO_HIDRODINAMICA')
        self.assertEqual(category['ranking'],[])
        self.assertIsNotNone(category['representante_rejeitado'])
        self.assertEqual(category['contagens_rodada']['SEM_BRACKET'],category['geradas_rodada'])

    def test_preserved_rankings_and_accumulated_calls_do_not_change_round_counts(self):
        cfg=self.config();_,first=self.execute(cfg);_,second=self.execute(cfg,first)
        for old,new in zip(first,second):
            self.assertEqual(new['geradas_rodada'],old['geradas_rodada'])
            self.assertEqual(new['avaliacoes_acumuladas'],2*old['geradas_rodada'])
            self.assertEqual(new['ranking'],old['ranking'])


if __name__=='__main__':unittest.main()
