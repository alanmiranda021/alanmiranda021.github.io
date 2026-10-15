#!/usr/bin/env python3
"""Portão de aceitação executável do laboratório naval.

Sem --input, usa dados ARTIFICIAIS e identifica o PDF como demonstrativo.
Com --input, lê o arquivo real fornecido, calcula hash do arquivo e valida o esquema.
Não publica no Git nem afirma que navegador/Stlite ou unidades foram validados.
"""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from pypdf import PdfReader

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT))
from core.exp_artigo3 import NavalConfig, run_naval, validate_naval
from core.experiment_tracking import json_bytes
from core.io import load_table
from core.report_pdf import naval_pdf

SCHEMA = {'ship_type', 'route_id', 'distance', 'fuel_type', 'weather_conditions',
          'engine_efficiency', 'fuel_consumption', 'CO2_emissions'}


def artificial_table():
    rng = np.random.default_rng(17)
    n = 98
    x = rng.uniform(10, 100, n)
    fuel = 10*x+rng.normal(0, 25, n)
    return pd.DataFrame(dict(ship_type=['A']*42+['B']*56,
        route_id=['R'+str(i%2) for i in range(n)], distance=x,
        fuel_type=['Diesel' if i%2 else 'HFO' for i in range(n)],
        weather_conditions=[['sun','rain','wind'][i%3] for i in range(n)],
        engine_efficiency=rng.uniform(70,95,n), fuel_consumption=fuel,
        CO2_emissions=2.7*fuel))


def main():
    parser = argparse.ArgumentParser(description='Validar fluxo naval + PDF + integridade científica')
    parser.add_argument('--input', type=Path, help='Arquivo naval real .mat ou .csv')
    parser.add_argument('--out', type=Path, default=PROJECT/'verification')
    parser.add_argument('--budget', type=float, default=300)
    args = parser.parse_args()
    args.out.mkdir(exist_ok=True, parents=True)
    real = args.input is not None
    if real:
        raw = args.input.read_bytes()
        df = load_table(args.input.name, raw)
        source_name = args.input.name
        sha = hashlib.sha256(raw).hexdigest()
        if args.input.suffix.lower() == '.mat' and (df.shape != (1440,8) or set(df) != SCHEMA):
            raise ValueError('O MAT não corresponde às 1440 linhas/8 colunas esperadas da auditoria.')
    else:
        df, sha, source_name = artificial_table(), '', 'DADOS_ARTIFICIAIS_NAO_REAIS'
    config = NavalConfig(mode='rapido', use_efficiency=False, filename=source_name,
        source_sha256=sha, scenarios=('E1','E3','DIST'), models=('SVR (RBF)',),
        outer_folds=2, inner_folds=2, hidden_grid=(3,), draws=1,
        maxiter=10, budget_seconds=args.budget)
    validate_naval(df, config.effective())
    result = run_naval(df, config)
    data = naval_pdf(result)
    pdf_path = args.out/('resultado_real_naval.pdf' if real else 'resultado_ARTIFICIAL_demonstrativo.pdf')
    pdf_path.write_bytes(data)
    pages = PdfReader(io.BytesIO(data)).pages
    cfg = result['config']
    train, test = set(cfg['final_train_indices']), set(cfg['final_test_indices'])
    checks = {
        'schema': SCHEMA <= set(df),
        'disjoint_holdout': not (train & test) and train | test == set(range(len(df))),
        'external_folds_within_development': all(
            (set(d['train_indices']) | set(d['validation_indices'])) <= train
            and not set(d['train_indices']) & set(d['validation_indices'])
            for d in result['folds']),
        'no_co2_predictor': 'CO2_emissions' not in cfg['features'],
        'no_synthetic_holdout': cfg['final_test_synthetic'] == 0,
        'one_final_test_attempt': cfg['final_test_attempts'] == 1,
        'one_final_test_evaluation': cfg['final_test_evaluations'] == 1,
        'all_requested_scenarios_present': {'E1','E3','DIST'} <= {r['scenario'] for r in result['validation']},
        'complete_validation': all(r['complete'] for r in result['validation']) and len(result['validation']) == 4,
        'pdf_valid_header': data[:4] == b'%PDF',
        'pdf_executive_summary_page': len(pages) >= 3 and 'Resumo executivo' in (pages[1].extract_text() or ''),
        'pdf_summary_followed_by_toc': len(pages) >= 3 and 'Sumário' in (pages[2].extract_text() or ''),
        'pdf_mentions_run_hash': result['dataset_sha256'] in '\n'.join(p.extract_text() or '' for p in pages),
    }
    outcome = {
        'kind': 'dataset_fornecido' if real else 'DEMONSTRATIVO_ARTIFICIAL',
        'input_filename': source_name, 'file_sha256': sha or None,
        'dataset_sha256': result['dataset_sha256'], 'status': result['status'],
        'failures': result['failures'], 'checks': checks, 'pdf_pages': len(pages),
        'test': result['test'], 'validation': result['validation'],
        'manifest': result['manifest'], 'configuration': cfg,
        'note': ('Execução com arquivo fornecido; física e representatividade ainda exigem verificação externa.'
                 if real else 'Dados 100% artificiais: não comprovam resultados do dataset naval original.'),
    }
    (args.out/'evidencias_execucao.json').write_bytes(json_bytes(outcome))
    approved = all(checks.values()) and result['status'].startswith('concluído')
    documentation = [
        '# Resultado do portão de aceitação do ML Learner', '',
        f'**Fonte:** {outcome["kind"]}. **Status:** {result["status"]}.',
        f'**PDF:** `{pdf_path.name}` ({len(pages)} páginas).',
        f'**Hash SHA-256 da tabela:** `{result["dataset_sha256"]}`.', '',
        '| Verificação | Resultado |', '| --- | --- |',
        *[f'| {name} | {"PASSOU" if state else "FALHOU"} |' for name,state in checks.items()], '',
        f'**Veredito do portão local:** {"APROVADO" if approved else "REPROVADO/PARCIAL"}.', '',
        'Este verificador não testa o Stlite em navegador. Não substitui a suíte pytest,',
        'o arquivo MAT original, a revisão de plausibilidade física ou o Git remoto.',
        'As métricas estão no JSON e PDF, nunca são valores presumidos.',
    ]
    (args.out/'RELATORIO_VERIFICACAO.md').write_text('\n'.join(documentation)+'\n',encoding='utf-8')
    print('\n'.join(documentation))
    return 0 if approved else 1


if __name__ == '__main__':
    raise SystemExit(main())
