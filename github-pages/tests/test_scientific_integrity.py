"""Regressões científicas: API sem UI, seleção e isolamento do holdout."""
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import Ridge
from core.augment import SAESampler
from core.exp_artigo3 import NavalConfig, run_naval


def artificial_table():
    rng = np.random.default_rng(17)
    n = 98
    distance = rng.uniform(10, 100, size=n)
    fuel = 10*distance + rng.normal(0, 25, n)
    return pd.DataFrame({
        'ship_type': ['A']*42 + ['B']*56,
        'route_id': ['R'+str(i % 2) for i in range(n)],
        'distance': distance,
        'fuel_type': ['Diesel' if i % 2 else 'HFO' for i in range(n)],
        'weather_conditions': [['rain','sun','wind'][i%3] for i in range(n)],
        'engine_efficiency': rng.uniform(70, 95, n),
        'fuel_consumption': fuel,
        'CO2_emissions': fuel*2.7,
    })


@pytest.mark.parametrize('target,proxy', [
    ('fuel_consumption','CO2_emissions'),
    ('CO2_emissions','fuel_consumption'),
])
def test_calling_executor_directly_rejects_leakage(target, proxy):
    df = artificial_table()
    with pytest.raises(ValueError, match='Vazamento'):
        run_naval(df, NavalConfig(target=target, excluded=()))
    with pytest.raises(ValueError, match='Vazamento'):
        SAESampler(target=target).fit_resample(df.drop(columns=target), df[target])
    with pytest.raises(ValueError, match='Vazamento'):
        SAESampler(target=target).fit_resample(df.drop(columns=proxy), df[target])


def test_reject_ambiguous_columns_in_direct_api():
    df = artificial_table()
    df['distance_copy'] = df.distance
    df.columns = [*df.columns[:-1], 'distance']
    with pytest.raises(ValueError, match='duplicados'):
        run_naval(df)


def test_final_holdout_not_used_to_fit_or_generate(monkeypatch):
    import core.exp_artigo3 as core
    data = artificial_table()
    source = data.copy(deep=True)
    monkeypatch.setattr(core, 'naval_model', lambda name, seed: (Ridge(), {'alpha': [1.]}))
    fitted_indices = []
    original = SAESampler.fit_resample
    def spy(self, X, y):
        fitted_indices.append(set(X.index))
        return original(self, X, y)
    monkeypatch.setattr(SAESampler, 'fit_resample', spy)
    result = run_naval(data, NavalConfig(scenarios=('E1','E3','DIST'),
        models=('Ridge-test',), hidden_grid=(3,), maxiter=10, draws=1,
        outer_folds=2, inner_folds=2, budget_seconds=300))
    assert result['test'] is not None, result['failures']
    assert result['status'].startswith('concluído'), result['failures']
    cfg = result['config']
    train, final = set(cfg['final_train_indices']), set(cfg['final_test_indices'])
    assert not train & final and train | final == set(range(len(data)))
    assert cfg['split_invariants_verified']
    assert cfg['final_test_synthetic'] == 0
    assert cfg['final_test_attempts'] == cfg['final_test_evaluations'] == 1
    assert fitted_indices and all(f <= train and f.isdisjoint(final) for f in fitted_indices)
    assert all(set(d['train_indices']).isdisjoint(d['validation_indices']) for d in result['folds'])
    assert all((set(d['train_indices']) | set(d['validation_indices'])) <= train for d in result['folds'])
    assert 'CO2_emissions' not in cfg['features']
    pd.testing.assert_frame_equal(source, data)


def test_test_attempt_counter_tracks_failed_final_fit(monkeypatch):
    import core.exp_artigo3 as core
    data = artificial_table()
    monkeypatch.setattr(core, 'naval_model', lambda name, seed: (Ridge(), {'alpha': [1.]}))
    from core.augment import cell_labels
    from sklearn.model_selection import train_test_split
    labels = cell_labels(data, ('ship_type',))
    _, final_ids = train_test_split(np.arange(len(data)), test_size=.2, stratify=labels, random_state=42)
    final_y = data.iloc[final_ids].fuel_consumption.to_numpy()
    original = core.reg_metrics
    def failing_metric(y_true, y_pred):
        if np.array_equal(np.asarray(y_true), final_y):
            raise RuntimeError('final indisponível')
        return original(y_true, y_pred)
    monkeypatch.setattr(core, 'reg_metrics', failing_metric)
    result = run_naval(data, NavalConfig(scenarios=('E1','DIST'), models=('Ridge-test',),
        draws=1, outer_folds=2, inner_folds=2, budget_seconds=120))
    assert result['config']['final_test_attempts'] == 1
    assert result['config']['final_test_evaluations'] == 0
    assert result['test'] is None
    assert result['status'] == 'parcial'


def test_artificial_pdf_marks_dataset_origin(monkeypatch):
    import io
    import core.exp_artigo3 as core
    from pypdf import PdfReader
    from core.report_pdf import naval_pdf
    monkeypatch.setattr(core, 'naval_model', lambda name, seed: (Ridge(), {'alpha': [1.]}))
    result = run_naval(artificial_table(), NavalConfig(
        filename='DADOS_ARTIFICIAIS_NAO_REAIS', scenarios=('E1', 'DIST'),
        models=('Ridge-test',), outer_folds=2, inner_folds=2, draws=1))
    document = PdfReader(io.BytesIO(naval_pdf(result)))
    assert 'DEMONSTRAÇÃO COM DADOS ARTIFICIAIS' in document.pages[0].extract_text()
    assert 'DADOS ARTIFICIAIS' in document.pages[1].extract_text()
    assert 'Resumo executivo' in document.pages[1].extract_text()
    assert 'Sumário' in document.pages[2].extract_text()
    assert 'observações reais reservadas' not in document.pages[1].extract_text()
