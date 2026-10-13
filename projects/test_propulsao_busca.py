"""Search resolution and global ranking regressions."""
import copy
import unittest

import pandas as pd

import propulsao as p
import propulsao_busca as busca


class SearchTests(unittest.TestCase):
    def config(self):
        cfg = copy.deepcopy(p.CONFIG)
        cfg['helice']['z'] = [4, 5]
        cfg['helice']['diametro'] = dict(min=7.8, max=8, passo=0.1)
        cfg['helice']['ae_ao'] = dict(min=0.7, max=0.75, passo=0.05)
        cfg['helice']['p_d'] = dict(min=0.8, max=0.9, passo=0.05)
        return cfg

    def test_batch_ranking_matches_single_grid(self):
        cfg = self.config()
        direct, fallback, funnel, _ = p.backtest(cfg, verbose=False)
        progress = []
        accepted, batched, steps, _, used = busca.backtest_perfil(cfg, 'personalizado', lambda done, total: progress.append((done, total)), tamanho_lote=6)
        pd.testing.assert_frame_equal(direct.head(15), accepted)
        pd.testing.assert_frame_equal(fallback.head(15).reset_index(drop=True), batched)
        self.assertEqual(funnel, steps)
        self.assertEqual(progress[-1][0], progress[-1][1])
        self.assertEqual(cfg, used)

    def test_profiles_increase_resolution_without_mutating_input(self):
        cfg = self.config()
        original = copy.deepcopy(cfg)
        totals = []
        for profile in ('rapido', 'completo', 'detalhado'):
            _, _, steps, _, used = busca.backtest_perfil(cfg, profile)
            totals.append(steps[0][1])
            self.assertEqual(used['helice']['diametro']['min'], 7.8)
            self.assertEqual(used['helice']['diametro']['max'], 8)
        self.assertLess(totals[0], totals[1])
        self.assertLess(totals[1], totals[2])
        self.assertEqual(cfg, original)

    def test_invalid_profiles_and_excessive_grids(self):
        with self.assertRaises(ValueError):
            busca.backtest_perfil(self.config(), 'unknown')
        cfg = self.config()
        cfg['helice']['diametro']['passo'] = 1e-9
        with self.assertRaises(ValueError):
            busca.backtest_perfil(cfg, 'personalizado')


if __name__ == '__main__':
    unittest.main()
