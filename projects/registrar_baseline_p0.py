"""Registra evidência numérica antes/depois; recusa sobrescrever o destino."""
import argparse
import copy
import hashlib
import json
import time
from pathlib import Path
import propulsao as p
import propulsao_busca as busca

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ['projects/propulsao.py', 'projects/propulsao_busca.py',
           'projects/motores.csv', 'naval.js', 'naval-backtest.js',
           'naval-backtest-worker.js', 'naval.html', 'naval.css']


def capture():
    result = {'api': p.WEB_API_VERSION, 'tolerancias': {
        'rtol': 1e-10, 'atol': 1e-9,
        'regra': 'abs(novo-antigo) <= atol + rtol*abs(antigo); contagens e geometrias exatas'},
        'hashes': {name: {'bytes_sha256': hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),
                         'lf_sha256': hashlib.sha256((ROOT/name).read_bytes().replace(b'\r\n', b'\n')).hexdigest()}
                   for name in SOURCES}, 'casos': {}}
    for name in ('referencia_detalhada', 'pontual'):
        cfg = copy.deepcopy(p.CONFIG)
        profile = 'detalhado'
        if name == 'pontual':
            cfg['helice'].update(z=[4], diametro=dict(min=8,max=8,passo=.1),
                                 ae_ao=dict(min=.7,max=.7,passo=.05), p_d=dict(min=.85,max=.85,passo=.05))
            profile = 'personalizado'
        started = time.perf_counter()
        g, f, funnel, resistance, effective = busca.backtest_perfil(cfg, profile)
        top = g if len(g) else f
        row = None if top.empty else busca.json_records(top.head(1))[0]
        result['casos'][name] = {'config': cfg, 'perfil': profile, 'funil': funnel,
            'aprovados_retidos': len(g), 'RT': float(resistance['RT']),
            'EHP_kW': float(resistance['EHP_kW']), 'melhor': row,
            'duracao_s': time.perf_counter()-started}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino', type=Path)
    args = parser.parse_args()
    if args.destino.exists():
        parser.error('Destino já existe: baseline não será sobrescrito.')
    result = capture()
    args.destino.parent.mkdir(parents=True, exist_ok=True)
    with args.destino.open('x', encoding='utf-8') as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2, allow_nan=False)
    print(args.destino)
