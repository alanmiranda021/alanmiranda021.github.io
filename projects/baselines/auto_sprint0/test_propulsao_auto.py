import copy
import unittest
import propulsao as p
import propulsao_auto as auto


def config():
    cfg = copy.deepcopy(p.CONFIG)
    cfg['helice']['z'] = [4, 5]
    cfg['helice']['diametro'] = dict(min=7.8, max=8, passo=.1)
    cfg['helice']['ae_ao'] = dict(min=.9, max=1.05, passo=.05)
    cfg['helice']['p_d'] = dict(min=1.2, max=1.4, passo=.05)
    return cfg


class AutoTests(unittest.TestCase):
    def test_approved_case_stops_by_stagnation_and_keeps_inputs(self):
        cfg = config(); cfg['margens'].update(mar=0, rotacao=0, operacional=0)
        original = copy.deepcopy(cfg)
        r = auto.otimizar(cfg, '6G90ME-C10.5', 'rapido')
        self.assertEqual(r['status'], 'aprovado')
        self.assertEqual(r['melhor']['viol_total'], 0)
        self.assertIn('estagnou', r['parada'])
        self.assertLess(len(r['historico']), 12)
        self.assertEqual(r['ajustes'], [])
        self.assertEqual(cfg, original)

    def test_best_never_worsens_across_rounds(self):
        r = auto.otimizar(config(), None, 'rapido', max_rodadas=5)
        chaves = [(h['viol_total'], h['objetivo']) for h in r['historico'] if h['melhorou']]
        self.assertEqual(chaves, sorted(chaves, reverse=True))

    def test_infeasible_case_reports_binding_rpm_and_fix(self):
        r = auto.otimizar(config(), None, 'rapido', paciencia=1, max_rodadas=2)
        self.assertEqual(r['status'], 'inviavel')
        self.assertGreater(r['melhor']['viol_rpm'], 0)
        por_parametro = {a['parametro']: a for a in r['ajustes']}
        self.assertIsNotNone(por_parametro['velocidade_nos']['para'])
        self.assertLess(por_parametro['velocidade_nos']['para'], 25)
        # a ajuda sugerida precisa realmente viabilizar o caso
        teste = config(); teste['navio']['velocidade_nos'] = por_parametro['velocidade_nos']['para']
        self.assertTrue(auto._viavel(teste, None)[0])
        self.assertIn('NENHUM motor serve', auto.resumo(r))

    def test_invalid_level_rejected(self):
        with self.assertRaises(ValueError):
            auto.otimizar(config(), None, 'infinita')


if __name__ == '__main__':
    unittest.main()
