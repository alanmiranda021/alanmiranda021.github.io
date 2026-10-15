import copy
import json
import unittest
from unittest.mock import patch
import pandas as pd
import propulsao as p
import propulsao_busca as busca
import propulsao_auto as auto


def config():
    cfg=copy.deepcopy(p.CONFIG)
    cfg['helice'].update(z=[4,5],diametro=dict(min=8,max=8,passo=.1),ae_ao=dict(min=.9,max=1.05,passo=.05),p_d=dict(min=1.2,max=1.4,passo=.05))
    return cfg


def row(foc=5,feasible=True,violation=0,z=5):
    return dict(FOC_t_h=foc,BHP_kW=30000,Z=z,D=8.,**{'Ae/Ao':1.,'P/D':1.4},cabe_motor=feasible,viol_total=violation,Motores='TESTE' if feasible else '-',motor_proximo='TESTE')


class AutoTests(unittest.TestCase):
    def fake(self,sequence,covered=True):
        def run(cfg,motor,nivel,state,progresso):
            i=state['iteracao'] if state else 0
            rows=sequence[min(i,len(sequence)-1)]
            frame=pd.DataFrame(rows) if rows else pd.DataFrame(columns=row().keys())
            accepted=frame[frame.cabe_motor==True].copy()
            used=copy.deepcopy(cfg)
            allowed=[z for z in cfg['helice']['z'] if max(cfg['helice']['ae_ao']['min'],p.AE_AO_POR_Z[z][0])<=min(cfg['helice']['ae_ao']['max'],p.AE_AO_POR_Z[z][1])]
            used['calibracao']=dict(etapa='varredura ampla' if i==0 else 'refinamento',pas_avaliadas=allowed if covered else [])
            count=p.tamanho_malha(busca.configurar_perfil(cfg,nivel)) if i==0 else 1
            return accepted,frame,[('geradas',count)],{},used,dict(iteracao=i+1,avaliacoes=(state['avaliacoes'] if state else 0)+count)
        return run

    def test_approved_case_stops_by_stagnation_and_keeps_inputs(self):
        cfg=config();original=copy.deepcopy(cfg)
        with patch.object(busca,'calibrar_motor',side_effect=self.fake([[row()]])) as called:
            result=auto.otimizar(cfg,paciencia=1)
        self.assertEqual(result['status'],'aprovado')
        self.assertEqual(result['parada_codigo'],'estagnacao_pos_cobertura')
        self.assertEqual(cfg,original)
        effective=called.call_args.args[0]
        self.assertEqual(effective['backtest']['objetivo'],'foc')
        self.assertEqual(effective['helice']['z'],[2,3,4,5,6,7])
        self.assertIsNone(called.call_args.args[1])
        self.assertEqual(effective['margens'],original['margens'])
        self.assertEqual(result['ajustes'],[])

    def test_best_never_worsens_across_rounds(self):
        with patch.object(busca,'calibrar_motor',side_effect=self.fake([[row(5)],[row(6)],[],[row(4)]])):
            result=auto.otimizar(config(),paciencia=10,max_rodadas=4)
        self.assertEqual([h['best_so_far']['FOC_t_h'] for h in result['historico']],[5,5,5,4])

    def test_infeasible_case_reports_binding_rpm_and_fix(self):
        with patch.object(busca,'calibrar_motor',side_effect=self.fake([[row(1,False,.1)],[row(5,True)],[]])):
            result=auto.otimizar(config(),paciencia=10,max_rodadas=3)
        self.assertEqual(result['melhor_viavel']['FOC_t_h'],5)
        self.assertEqual(result['melhor_diagnostico']['FOC_t_h'],1)
        self.assertTrue(result['melhor']['cabe_motor'])
        self.assertEqual(result['ajustes'],[])

    def test_invalid_level_rejected(self):
        for level in ('infinita','profundo','incorreto'):
            with self.assertRaises(ValueError):auto.otimizar(config(),nivel=level)

    def test_no_stagnation_before_declared_coverage(self):
        with patch.object(busca,'calibrar_motor',side_effect=self.fake([[row()]],covered=False)):
            result=auto.otimizar(config(),paciencia=1,max_rodadas=4)
        self.assertEqual(len(result['historico']),4)
        self.assertEqual(result['parada_codigo'],'orcamento')
        self.assertFalse(result['cobertura']['cobertura_minima_concluida'])

    def test_invalid_parameters_and_input_error(self):
        for kwargs in (dict(paciencia=0),dict(max_rodadas=0),dict(tolerancia=float('nan')),dict(tolerancia=-1)):
            with self.assertRaises(ValueError):auto.otimizar(config(),**kwargs)
        cfg=config();cfg['navio']['velocidade_nos']=-1;original=copy.deepcopy(cfg)
        with self.assertRaises(ValueError):auto.otimizar(cfg)
        self.assertEqual(cfg,original)

    def test_nan_inf_not_selected_and_strict_json(self):
        with patch.object(busca,'calibrar_motor',side_effect=self.fake([[row(float('inf')),row(5)]])):
            result=auto.otimizar(config(),max_rodadas=1)
        self.assertEqual(result['melhor']['FOC_t_h'],5)
        json.dumps(result,allow_nan=False)

    def test_cancel_before_round_preserves_input(self):
        cfg=config();original=copy.deepcopy(cfg)
        result=auto.otimizar(cfg,cancelar=lambda:True)
        self.assertEqual(result['parada_codigo'],'cancelado')
        self.assertEqual(result['status'],'interrompido')
        self.assertEqual(cfg,original)

    def test_no_candidates_and_no_approved_status(self):
        for sequence,status in (([[]],'sem_hidrodinamica_encontrada'),([[row(1,False,.1)]],'sem_aprovados_encontrados')):
            with patch.object(busca,'calibrar_motor',side_effect=self.fake(sequence)):
                result=auto.otimizar(config(),max_rodadas=1)
            self.assertEqual(result['status'],status)

    def test_real_top_one_keeps_both_scientific_reservoirs(self):
        cfg=config();cfg['backtest']['top']=1
        cfg['margens'].update(mar=0,rotacao=0,operacional=0)
        cfg['motor']['catalogo_registrado']=[dict(modelo='ARTIFICIAL_TESTE',n_min=1,n_max=84,p_max_kw=1e6,p_min_kw=.001)]
        a,b,_,_,_,state=busca.calibrar_motor(cfg,nivel='rapido')
        self.assertLessEqual(len(b),1)
        self.assertIsNotNone(state['melhor_diagnostico'])
        self.assertIsNotNone(state['melhor_viavel'])
        self.assertTrue(state['melhor_viavel']['cabe_motor'])
        self.assertFalse(state['melhor_diagnostico']['cabe_motor'])
        self.assertIn('reservatorios',state)
        self.assertEqual(state['reservatorios_schema_version'],1)

    def test_hypothetical_alternatives_are_opt_in_and_immutable(self):
        cfg=config();original=copy.deepcopy(cfg)
        apply=lambda candidate,value:candidate['navio'].update(velocidade_nos=value)
        with patch.object(auto,'_alavancas',return_value=[('velocidade','Teste',apply,[20],25)]),patch.object(auto,'_viavel',return_value=(True,0)):
            alternatives=auto.sugerir_ajustes(cfg)
        self.assertEqual(cfg,original)
        self.assertTrue(alternatives[0]['hipotetico'])
        self.assertEqual(alternatives[0]['status'],'encontrado')
        with patch.object(busca,'calibrar_motor',side_effect=ValueError('entrada inválida')):
            with self.assertRaises(ValueError):auto._viavel(cfg,None)

    def test_deterministic_ties_and_explicit_target(self):
        for rows in ([row(z=5),row(z=4)],[row(z=4),row(z=5)]):
            with patch.object(busca,'calibrar_motor',side_effect=self.fake([rows])) as called:
                result=auto.otimizar(config(),motor='8G90ME-C10.5',max_rodadas=1)
            self.assertEqual(result['melhor']['Z'],4)
            self.assertEqual(called.call_args.args[1],'8G90ME-C10.5')
            self.assertEqual(result['catalogo_escopo'],'8G90ME-C10.5')


if __name__=='__main__':unittest.main()
