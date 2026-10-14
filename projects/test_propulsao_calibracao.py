import copy
import unittest
import propulsao as p
import propulsao_busca as busca


class CalibrationTests(unittest.TestCase):
    def config(self):
        cfg=copy.deepcopy(p.CONFIG)
        cfg['helice']['z']=[4,5]
        cfg['helice']['diametro']=dict(min=7.8,max=8,passo=.1)
        cfg['helice']['ae_ao']=dict(min=.9,max=1.05,passo=.05)
        cfg['helice']['p_d']=dict(min=1.2,max=1.4,passo=.05)
        return cfg

    def test_target_is_exclusive_and_inputs_preserved(self):
        cfg=self.config(); original=copy.deepcopy(cfg)
        g,f,_,_,used,state=busca.calibrar_motor(cfg,'8G90ME-C10.5','rapido')
        self.assertTrue(all(f.motor_proximo=='8G90ME-C10.5'))
        self.assertEqual(len(p.carregar_motores(used)),1)
        self.assertEqual(cfg,original)
        self.assertEqual(used['navio'],cfg['navio'])
        self.assertEqual(used['margens'],cfg['margens'])
        self.assertEqual(state['iteracao'],1)

    def test_refinement_preserves_best_and_stays_in_bounds(self):
        cfg=self.config(); state=None; best=float('inf')
        for i in range(7):
            _,f,_,_,used,state=busca.calibrar_motor(cfg,'8G90ME-C10.5','infinita',state)
            self.assertLessEqual(float(f.iloc[0].viol_total),best+1e-12)
            best=float(f.iloc[0].viol_total)
            self.assertEqual(state['iteracao'],i+1)
            for key in ('diametro','p_d','ae_ao'):
                span=used['calibracao']['malha_rodada'][key]
                self.assertGreaterEqual(span['min'],cfg['helice'][key]['min']-1e-6)
                self.assertLessEqual(span['max'],cfg['helice'][key]['max']+1e-6)

    def test_unknown_motor_rejected(self):
        with self.assertRaises(ValueError):
            busca.calibrar_motor(self.config(),'motor inexistente')

    def test_compatible_target_is_approved(self):
        cfg=self.config()
        cfg['margens'].update(mar=0,rotacao=0,operacional=0)
        approved,_,_,_,_,_=busca.calibrar_motor(cfg,'6G90ME-C10.5','completo')
        self.assertGreater(len(approved),0)
        self.assertTrue(all(approved.Motores=='6G90ME-C10.5'))
        self.assertTrue(all(approved.viol_total==0))


if __name__=='__main__':unittest.main()
