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
            for grid in used['calibracao']['malhas_rodada']:
                for key in ('diametro','p_d','ae_ao'):
                    span=grid[key]
                    self.assertGreaterEqual(span['min'],cfg['helice'][key]['min']-1e-6)
                    self.assertLessEqual(span['max'],cfg['helice'][key]['max']+1e-6)
            if used['calibracao']['etapa']=='varredura global por blocos':
                self.assertTrue(set(used['calibracao']['pas_avaliadas']).issubset({4,5}))
            else:
                self.assertEqual(used['calibracao']['pas_avaliadas'],[4,5])

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

    def test_without_motor_uses_entire_catalog(self):
        _,_,_,_,used,state=busca.calibrar_motor(self.config(),None,'infinita')
        self.assertIsNone(used['calibracao']['motor'])
        self.assertEqual(len(p.carregar_motores(used)),56)
        self.assertEqual(set(state['melhores_por_z']),{'4','5'})

    def test_global_tiles_cover_entire_grid_before_refining(self):
        import itertools
        cfg=self.config();cfg['helice']['z']=[3,4,5]
        cfg['helice']['ae_ao']=dict(min=.4,max=1.05,passo=.05)
        state=None;global_total=0;seen_z=set();covered=set();initial_grid=busca.configurar_perfil(cfg,'completo')
        for _ in range(15):
            _,_,funnel,_,used,state=busca.calibrar_motor(cfg,None,'infinita',state)
            if used['calibracao']['etapa']=='varredura global por blocos':
                global_total+=funnel[0][1]
                seen_z.update(used['calibracao']['pas_avaliadas'])
                for grid in used['calibracao']['malhas_rodada']:
                    for d,a,pd in itertools.product(p._faixa(grid['diametro']),p._faixa(grid['ae_ao']),p._faixa(grid['p_d'])):
                        covered.add((grid['z'][0],float(d),float(a),float(pd)))
            if state['resolucao_global']>0:break
        self.assertEqual(global_total,p.tamanho_malha(initial_grid))
        self.assertEqual(seen_z,{3,4,5})
        self.assertEqual(state['resolucao_global'],1)
        expected=set()
        for z in initial_grid['helice']['z']:
            area={**initial_grid['helice']['ae_ao'],'min':max(initial_grid['helice']['ae_ao']['min'],p.AE_AO_POR_Z[z][0]),'max':min(initial_grid['helice']['ae_ao']['max'],p.AE_AO_POR_Z[z][1])}
            for d,a,pd in itertools.product(p._faixa(initial_grid['helice']['diametro']),p._faixa(area),p._faixa(initial_grid['helice']['p_d'])):
                expected.add((z,float(d),float(a),float(pd)))
        self.assertEqual(covered,expected)


if __name__=='__main__':unittest.main()
