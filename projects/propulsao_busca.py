"""Search profiles with bounded batches and a global, deterministic ranking."""
import copy
import math

import pandas as pd
import propulsao as p
WEB_API_VERSION = 3

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


def calibrar_motor(cfg, motor, nivel='rapido', estado=None, progresso=None, diagnostico_destino=None):
    """One bounded round; the browser repeats infinite rounds until stopped.

    Only propeller geometry is optimized. Ship, margins, RPM limits and
    physical restrictions are preserved. Motor selection is a strict filter.
    """
    if nivel not in ('rapido', 'completo', 'infinita'):
        raise ValueError('Nível de calibração inválido.')
    base = copy.deepcopy(cfg)
    catalog = p.carregar_motores(base)
    chosen = [row for row in catalog if row[0] == motor]
    if not chosen:
        raise ValueError('Motor selecionado não existe no catálogo da configuração.')
    base['motor']['catalogo_registrado'] = [dict(zip(('modelo', 'n_min', 'n_max', 'p_max_kw', 'p_min_kw'), chosen[0]))]
    base['restricoes']['motor'] = 'estrito'
    valid_z = [z for z in base['helice']['z'] if max(base['helice']['ae_ao']['min'], p.AE_AO_POR_Z[z][0]) <= min(base['helice']['ae_ao']['max'], p.AE_AO_POR_Z[z][1])]
    if not valid_z:
        raise ValueError('Nenhuma área de hélice válida para as pás selecionadas.')
    iteration = 0 if estado is None else estado['iteracao']
    local = copy.deepcopy(base)
    profile = 'completo' if nivel == 'completo' else 'rapido'
    if iteration:
        profile = 'personalizado'
        previous = estado['ranking']
        rng = p.np.random.default_rng(20261013 + iteration)
        explore = not previous or iteration % 5 == 0
        row = None if explore else previous[(iteration - 1) % min(5, len(previous))]
        if row is not None:
            local['helice']['z'] = [int(row['Z'])]
        else:
            local['helice']['z'] = [int(rng.choice(valid_z))]
        for key, column, initial in [('diametro', 'D', .1), ('ae_ao', 'Ae/Ao', .05), ('p_d', 'P/D', .05)]:
            span = base['helice'][key]
            lower = span['min']
            upper = span['max'] if span['max'] is not None else base['navio']['calado_popa'] / base['restricoes']['ta_sobre_d_min']
            if key == 'ae_ao':
                z = local['helice']['z'][0]
                lower, upper = max(lower, p.AE_AO_POR_Z[z][0]), min(upper, p.AE_AO_POR_Z[z][1])
            center = float(rng.uniform(lower, upper)) if row is None else float(row[column])
            step = max(0.0001, initial / 2 ** min(iteration, 10))
            radius = step * 2
            minimum, maximum = max(lower, center - radius), min(upper, center + radius)
            # Preserve the incumbent as a sampled point, including at the upper bound.
            if row is not None:
                minimum = center - math.floor((center-minimum+1e-9)/step)*step
            local['helice'][key] = dict(min=round(minimum, 6), max=round(maximum, 6), passo=step)
    g, fallback, funnel, resistance, effective = backtest_perfil(local, profile, progresso, diagnostico_destino=diagnostico_destino)
    candidates = pd.concat([g, fallback], ignore_index=True)
    if estado is not None and estado['ranking']:
        candidates = pd.concat([pd.DataFrame(estado['ranking']), candidates], ignore_index=True)
    objective = {'bhp':'BHP_kW', 'foc':'FOC_t_h'}[base['backtest']['objetivo']]
    candidates = candidates.drop_duplicates(['Z', 'D', 'Ae/Ao', 'P/D']).sort_values(['viol_total', objective, 'Z', 'D', 'Ae/Ao', 'P/D'], kind='stable').head(base['backtest']['top']).reset_index(drop=True)
    previous_total = 0 if estado is None else estado['avaliacoes']
    state = dict(iteracao=iteration+1, avaliacoes=previous_total+funnel[0][1], ranking=json_records(candidates))
    base['calibracao'] = dict(motor=motor, nivel=nivel, iteracao=state['iteracao'], avaliacoes=state['avaliacoes'],
                             malha_rodada=effective['helice'], contagens='avaliações acumuladas podem repetir pontos; funil e diagnóstico CSV referem-se à última rodada')
    approved = candidates[candidates['cabe_motor']].reset_index(drop=True)
    return approved, candidates, funnel, resistance, base, state


def json_records(frame):
    import json
    return json.loads(frame.to_json(orient='records', double_precision=15))
