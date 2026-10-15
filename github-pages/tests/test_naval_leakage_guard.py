"""Bloqueio de vazamento CO2_emissions <-> fuel_consumption na camada de execução (sem UI)."""
import numpy as np
import pandas as pd
import pytest

import core.exp_artigo3 as exp
from core.exp_artigo3 import NavalConfig, run_naval, validate_naval


@pytest.fixture
def data():
    rng = np.random.default_rng(0)
    rows = []
    for ship in "ABCD":
        for route in "wxyz":
            for _ in range(20):
                dist = rng.uniform(50, 500)
                fuel = dist * rng.uniform(.8, 1.2) + 5
                rows.append(dict(ship_type=ship, route_id=route, distance=dist,
                                 fuel_type=rng.choice(["Diesel", "HFO"]),
                                 weather_conditions=rng.choice(["Calm", "Moderate", "Stormy"]),
                                 engine_efficiency=rng.uniform(70, 95),
                                 fuel_consumption=fuel, CO2_emissions=fuel * rng.uniform(2.5, 3.0)))
    return pd.DataFrame(rows)


@pytest.mark.parametrize("target,forbidden", [("fuel_consumption", "CO2_emissions"),
                                              ("CO2_emissions", "fuel_consumption")])
@pytest.mark.parametrize("excluded", [(), ("engine_efficiency",), [], ("ship_type",)])
def test_run_naval_rejects_forbidden_combination(data, target, forbidden, excluded):
    with pytest.raises(ValueError, match="Vazamento"):
        run_naval(data, NavalConfig(target=target, excluded=excluded))


def test_excluded_as_plain_string_is_not_substring_matched(data):
    with pytest.raises(ValueError, match="Vazamento"):
        run_naval(data, NavalConfig(excluded="xCO2_emissions_not"))
    cfg = NavalConfig(excluded="CO2_emissions").effective()
    validate_naval(data, cfg)
    assert cfg.excluded == ("CO2_emissions",)


def test_forbidden_column_in_features_is_caught(data, monkeypatch):
    monkeypatch.setattr(exp, "FEATURES", (*exp.FEATURES, "CO2_emissions"))
    with pytest.raises(ValueError, match="Vazamento|obrigatórios"):
        validate_naval(data, NavalConfig().effective())


def test_valid_config_passes_validation_and_features_are_clean(data):
    feats = validate_naval(data, NavalConfig().effective())
    assert "CO2_emissions" not in feats and "fuel_consumption" not in feats
    feats2 = validate_naval(data, NavalConfig(target="CO2_emissions", excluded=("fuel_consumption",)).effective())
    assert "fuel_consumption" not in feats2 and "CO2_emissions" not in feats2


def test_forbidden_never_reaches_preprocessing_during_real_run(data, monkeypatch):
    seen = []
    orig = exp.build_preprocessor

    def spy(numeric, cats, *a, **k):
        seen.append(set(numeric) | set(cats))
        return orig(numeric, cats, *a, **k)

    monkeypatch.setattr(exp, "build_preprocessor", spy)
    from sklearn.linear_model import Ridge
    monkeypatch.setattr(exp, 'naval_model', lambda name, seed: (Ridge(), {'alpha': [1.]}))
    result = run_naval(data, NavalConfig(mode="rapido", scenarios=("E1", "DIST"), budget_seconds=120,
                                        models=("Ridge-test",), draws=1, outer_folds=2, inner_folds=2,
                                        hidden_grid=(3,), gamma_grid=(1.,), components_grid=(5,)))
    assert result['test'] is not None, result['failures']
    assert seen, "pré-processador não foi chamado"
    assert all("CO2_emissions" not in cols and "fuel_consumption" not in cols for cols in seen)
