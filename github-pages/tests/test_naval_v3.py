"""Aceite das divergências da especificação científica v3."""
import io
import os
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from pypdf import PdfReader
from core.augment import SAESampler
from core.exp_artigo3 import NavalConfig, validate_naval, run_naval, paired_comparisons, rank_results
from core.report_pdf import naval_pdf
from core.sae import SparseAutoencoder


@pytest.fixture
def data():
    rng = np.random.default_rng(17)
    n = 98
    distance = rng.uniform(10, 100, n)
    fuel = 10*distance+rng.normal(0, 25, n)
    return pd.DataFrame(dict(ship_type=['A']*42+['B']*56, route_id=['R'+str(i%2) for i in range(n)],
        distance=distance, fuel_type=['Diesel' if i%2 else 'HFO' for i in range(n)],
        weather_conditions=[['sun','wind','rain'][i%3] for i in range(n)],
        engine_efficiency=rng.uniform(70,95,n), fuel_consumption=fuel, CO2_emissions=2.7*fuel))


def test_n_fast_contract_and_local_diagnostic():
    cfg = NavalConfig().effective()
    assert cfg.outer_folds == cfg.inner_folds == 3
    assert cfg.repeats == 1 and cfg.cell_columns == ('ship_type',)
    assert cfg.scenarios == ('E1', 'E3', 'DIST') and not cfg.sensitivity
    assert cfg.maxiter == 50 and cfg.draws <= 8
    with pytest.raises(ValueError, match='completo'):
        NavalConfig(scenarios=('E1','E3-orig')).effective()


def test_delta_sign_relative_zero_and_primary_ranking():
    details = [dict(scenario=s, model='RF', fold=i, metrics={'RMSE':v})
               for s,v in [('E1',10.),('E3',8.)] for i in range(5)]
    row = paired_comparisons(details, 5)[0]
    assert row['delta_rmse'] == 2 and row['delta_percent'] == 20
    assert row['fraction_improved'] == 1 and 'heurística' in row['conclusion']
    unequal = [dict(scenario=s,model='RF',fold=i,metrics={'RMSE':v})
               for s,values in [('E1',[10.,100.]),('E3',[8.,90.])] for i,v in enumerate(values)]
    assert paired_comparisons(unequal)[0]['delta_percent'] == pytest.approx(100*6/55)
    for d in details:
        d['metrics']['RMSE'] = 0.
    assert paired_comparisons(details)[0]['delta_percent'] is None
    rows = [dict(scenario=s,model='RF',RMSE=r,RMSE_std=std,seconds=1.)
            for s,r,std in [('E1',100.,10.),('E3',105.,1.),('E3-orig',1.,0.)]]
    assert rank_results(rows)[0]['scenario'] == 'E1'


@pytest.mark.parametrize('distance',[0.,-1.,np.inf])
def test_invalid_distance_api_and_sampler(data,distance):
    data.loc[0,'distance'] = distance
    with pytest.raises(ValueError):
        validate_naval(data,NavalConfig().effective())
    with pytest.raises(ValueError):
        SAESampler(cell_columns=('ship_type',)).fit_resample(data.drop(columns=['fuel_consumption','CO2_emissions']), data.fuel_consumption)


def test_candidate_audit_and_near_copy_gate(data):
    X, y = data.drop(columns=['fuel_consumption','CO2_emissions']),data.fuel_consumption
    sampler = SAESampler(cell_columns=('ship_type',), hidden_grid=(3,),maxiter=20)
    sampler.fit_resample(X,y)
    diag = next(d for d in sampler.diagnostics_ if d['synthetic'])
    candidates = diag['noise_candidates']
    assert len(candidates) == 3
    approved = [c for c in candidates if c['approved']]
    assert diag['noise_scale'] == min(approved,key=lambda c:(c['ks'],c['s']))['s']
    assert diag['attempts'] >= diag['accepted'] and diag['rejected'] >= 0
    assert diag['reconstruction_mse'] is not None
    with pytest.raises(ValueError,match='plausíveis'):
        SAESampler(cell_columns=('ship_type',),generator='gaussian',noise_grid=(1e-15,)).fit_resample(X,y)


def test_pretrip_distance_baseline_pdf_and_memory(data,monkeypatch):
    import core.exp_artigo3 as module
    from sklearn.linear_model import Ridge
    monkeypatch.setattr(module,'naval_model',lambda name, seed:(Ridge(),{'alpha':[1.]}))
    cfg = NavalConfig(use_efficiency=False, models=('Ridge-test',),outer_folds=2,inner_folds=2,
                      draws=1,hidden_grid=(3,),maxiter=10)
    result = run_naval(data.drop(columns='engine_efficiency'),cfg)
    assert not result['failures'],result['failures']
    assert 'engine_efficiency' not in result['config']['features']
    assert len([r for r in result['validation'] if r['scenario']=='DIST']) == 2
    assert result['memory']['python_traced_peak_bytes'] > 0
    assert result['config']['final_test_evaluations'] == 1
    assert all('sem conclusão científica' in c['conclusion'] for c in result['comparisons'])
    pdf = PdfReader(io.BytesIO(naval_pdf(result)))
    assert 'Resumo executivo' in pdf.pages[1].extract_text()
    assert 'Guia de leitura' not in pdf.pages[1].extract_text()
    text = '\n'.join(p.extract_text() for p in pdf.pages)
    for phrase in ['Em termos simples','Detalhe matemático','7,0711','0,8125','unidade não informada','DIST','heurística','Sumário']:
        assert phrase.casefold() in text.casefold()


def test_cancellation_yields_partial_without_unlocking_test(data):
    result = run_naval(data,NavalConfig(),cancelled=lambda:True)
    assert result['status']=='interrompido' and not result['test']
    assert result['config']['final_test_evaluations']==0
    assert result['failures']


@pytest.mark.parametrize('target,forbidden',[('fuel_consumption','CO2_emissions'),('CO2_emissions','fuel_consumption')])
def test_cross_target_block(data,target,forbidden):
    with pytest.raises(ValueError,match='Vazamento'):
        run_naval(data,NavalConfig(target=target,excluded=()))


def test_constant_target_and_source_immutability(data):
    original = data.copy(deep=True)
    with pytest.raises(ValueError,match='constante'):
        run_naval(data.assign(fuel_consumption=100.))
    pd.testing.assert_frame_equal(data,original)


def test_uploaded_mat_to_naval_pipeline(data,monkeypatch):
    from scipy.io import savemat
    from core.io import load_table
    from core.data_inspection import inspect_mat
    from sklearn.linear_model import Ridge
    import core.exp_artigo3 as module
    raw = io.BytesIO()
    savemat(raw, {'viagens': {c:data[c].to_numpy() for c in data}})
    assert inspect_mat(raw.getvalue())['variables']
    loaded = load_table('viagens_artificiais.mat',raw.getvalue())
    assert loaded.shape == data.shape and set(loaded)==set(data)
    # MATLAB preenche arrays de texto com espaços; o parser conserva conteúdo.
    for col in loaded.select_dtypes(exclude='number'):
        loaded[col] = loaded[col].str.rstrip()
    monkeypatch.setattr(module,'naval_model',lambda name,seed:(Ridge(),{'alpha':[1.]}))
    result = run_naval(loaded,NavalConfig(models=('Ridge-test',),scenarios=('E1','DIST'),draws=1,outer_folds=2,inner_folds=2))
    assert result['test'] and not result['failures']


@pytest.mark.parametrize('shape',[(8,3,2),(12,5,3),(5,2,1)])
@pytest.mark.parametrize('alpha,beta',[(0.,0.),(.01,0.),(0.,1.),(.01,1.)])
def test_central_gradient_components(shape,alpha,beta):
    m,d,h = shape
    X = np.random.default_rng(m).normal(size=(m,d))
    net = SparseAutoencoder(hidden_dim=h,alpha=alpha,beta=beta,maxiter=2).fit(X)
    theta = np.concatenate([p.ravel() for p in net.params_])
    theta += np.random.default_rng(d).normal(0,.1,len(theta))
    analytic = net.loss_gradient(theta,X)[1]
    numeric = np.zeros_like(theta)
    for k in range(len(theta)):
        a,b = theta.copy(),theta.copy()
        a[k] += 1e-6; b[k] -= 1e-6
        numeric[k] = (net.loss_gradient(a,X)[0]-net.loss_gradient(b,X)[0])/2e-6
    error = np.linalg.norm(analytic-numeric)/max(1e-12,np.linalg.norm(analytic)+np.linalg.norm(numeric))
    assert error < 1e-5


def test_real_mat_schema_when_supplied():
    path = os.environ.get('ML_LEARNER_NAVAL_MAT')
    if not path:
        pytest.skip('MAT real opcional: defina ML_LEARNER_NAVAL_MAT; dados não são distribuídos com o código')
    from core.io import load_table
    from core.data_inspection import inspect_mat
    raw = Path(path).read_bytes()
    assert inspect_mat(raw)['variables']
    df = load_table(Path(path).name,raw)
    assert df.shape == (1440,8)
    assert set(df) == {'ship_type','route_id','distance','fuel_type','weather_conditions','engine_efficiency','fuel_consumption','CO2_emissions'}
    assert not df.isna().any().any() and not df.duplicated().any()
    validate_naval(df,NavalConfig().effective())
