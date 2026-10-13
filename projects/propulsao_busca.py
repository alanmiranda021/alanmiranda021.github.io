"""Search profiles with bounded batches and a global, deterministic ranking."""
import copy
import math

import pandas as pd
import propulsao as p
WEB_API_VERSION = 2

PERFIS = {
    'rapido': ('Rápido', 0.25, 0.10, 0.10),
    'completo': ('Completo', 0.10, 0.05, 0.05),
    'detalhado': ('Extremamente detalhado', 0.05, 0.025, 0.025),
}


def configurar_perfil(cfg, perfil):
    result = copy.deepcopy(cfg)
    if perfil == 'personalizado':
        return result
    if perfil not in PERFIS:
        raise ValueError('Perfil de busca inválido.')
    _, diameter, area, pitch = PERFIS[perfil]
    for key, step in (('diametro', diameter), ('ae_ao', area), ('p_d', pitch)):
        result['helice'][key]['passo'] = step
    return result


def backtest_perfil(cfg, perfil='completo', progresso=None, tamanho_lote=8000, diagnostico_destino=None):
    cfg = configurar_perfil(cfg, perfil)
    hl, nv, rs = cfg['helice'], cfg['navio'], cfg['restricoes']
    # Validate physical inputs and each step without allocating the entire grid.
    probe = copy.deepcopy(cfg)
    for key in ('diametro', 'ae_ao', 'p_d'):
        maximum = hl[key]['max']
        if maximum is None:
            maximum = nv['calado_popa'] / rs['ta_sobre_d_min']
        if not isinstance(maximum, (int, float)) or not math.isfinite(maximum) or maximum < hl[key]['min']:
            raise ValueError('%s: máximo inválido ou menor que mínimo.' % key)
        step = hl[key]['passo']
        if not isinstance(step, (int, float)) or not math.isfinite(step) or step <= 0:
            raise ValueError('%s: passo deve ser positivo e finito.' % key)
        probe['helice'][key]['max'] = hl[key]['min']
    p.validar_config(probe)
    max_d = hl['diametro']['max'] or nv['calado_popa'] / rs['ta_sobre_d_min']
    # Reject excessive dimensions before building numpy arrays.
    counts = [math.floor((end - span['min']) / span['passo'] + 1e-7) + 1
              for span, end in ((hl['diametro'], max_d), (hl['ae_ao'], hl['ae_ao']['max']), (hl['p_d'], hl['p_d']['max']))]
    if math.prod(counts) * len(hl['z']) > 2000000:
        raise ValueError('Busca acima de 2 milhões de combinações. Reduza os intervalos ou escolha outro perfil.')
    ds = p._faixa({**hl['diametro'], 'max': max_d})
    pds = p._faixa(hl['p_d'])
    batches, total = [], 0
    for z in dict.fromkeys(hl['z']):
        lo, hi = p.AE_AO_POR_Z[z]
        aes = p._faixa({**hl['ae_ao'], 'min': max(hl['ae_ao']['min'], lo), 'max': min(hl['ae_ao']['max'], hi)})
        if not len(aes):
            continue
        per_d = len(aes) * len(pds)
        if per_d > 150000:
            raise ValueError('Malha de área e passo muito grande para um lote.')
        width = max(1, tamanho_lote // per_d)
        for i in range(0, len(ds), width):
            part = ds[i:i + width]
            batches.append((z, part, len(part) * per_d))
            total += len(part) * per_d
    if not batches:
        raise ValueError('Nenhuma hélice dentro dos limites da Série B.')
    objective = {'bhp': 'BHP_kW', 'foc': 'FOC_t_h'}[cfg['backtest']['objetivo']]
    top_n = int(cfg['backtest']['top'])
    accepted = fallback = None
    funnel, completed, resistance = {}, 0, None
    def merge(previous, frame, exploratory=False):
        keys = (['viol_total'] if exploratory or cfg['restricoes']['motor'] == 'informativo' else []) + [objective, 'Z', 'D', 'Ae/Ao', 'P/D']
        frame = frame.sort_values(keys, kind='stable').head(top_n)
        if previous is not None:
            frame = pd.concat([previous, frame], ignore_index=True)
        return frame.sort_values(keys, kind='stable').head(top_n).reset_index(drop=True)
    if progresso:
        progresso(0, total)
    if diagnostico_destino:
        # One diagnostic row per hydrodynamically valid candidate, not just top N.
        with open(diagnostico_destino, 'w', encoding='utf-8'):
            pass
    first_diagnostic = True
    for z, part, count in batches:
        local = copy.deepcopy(cfg)
        local['helice']['z'] = [z]
        local['helice']['diametro'].update(min=float(part[0]), max=float(part[-1]))
        g, f, steps, resistance = p.backtest(local, verbose=False)
        accepted, fallback = merge(accepted, g), merge(fallback, f, exploratory=True)
        if diagnostico_destino:
            with open(diagnostico_destino, 'a', encoding='utf-8', newline='') as handle:
                diagnostic = p.diagnostico_csv(f)
                handle.write(diagnostic if first_diagnostic else diagnostic.split('\n', 1)[1])
                first_diagnostic = False
        for name, survivors in steps:
            funnel[name] = funnel.get(name, 0) + survivors
        completed += count
        if progresso:
            progresso(completed, total)
    return accepted, fallback, list(funnel.items()), resistance, cfg
