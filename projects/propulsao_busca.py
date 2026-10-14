"""Search profiles with bounded batches and a global, deterministic ranking."""
import copy
import math

import pandas as pd
import propulsao as p
WEB_API_VERSION = 4

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


def calibrar_motor(cfg, motor=None, nivel='rapido', estado=None, progresso=None, diagnostico_destino=None):
    """All allowed blades: broad search, per-Z refinement and exhaustive tiles."""
    import os
    import tempfile
    if nivel not in ('rapido', 'completo', 'infinita'):
        raise ValueError('Nível de calibração inválido.')
    base = copy.deepcopy(cfg)
    if motor:
        chosen = [row for row in p.carregar_motores(base) if row[0] == motor]
        if not chosen:
            raise ValueError('Motor selecionado não existe no catálogo da configuração.')
        base['motor']['catalogo_registrado'] = [dict(zip(('modelo', 'n_min', 'n_max', 'p_max_kw', 'p_min_kw'), chosen[0]))]
    base['restricoes']['motor'] = 'estrito'
    valid_z = sorted(set(z for z in base['helice']['z'] if max(base['helice']['ae_ao']['min'], p.AE_AO_POR_Z[z][0]) <= min(base['helice']['ae_ao']['max'], p.AE_AO_POR_Z[z][1])))
    if not valid_z:
        raise ValueError('Nenhuma área de hélice válida para as pás selecionadas.')
    iteration = 0 if estado is None else estado['iteracao']
    cursor = 0 if estado is None else estado.get('cursor_global', 0)
    resolution = 0 if estado is None else estado.get('resolucao_global', 0)
    previous_by_z = {} if estado is None else estado.get('melhores_por_z', {})
    grids = []
    stage = 'varredura ampla'
    tile_total = 1
    if not iteration:
        for z in valid_z:
            grid = configurar_perfil(base, 'completo' if nivel == 'completo' else 'rapido')
            grid['helice']['z'] = [z]
            grids.append(grid)
    elif nivel == 'infinita' and iteration % 2 == 0:
        # Enumerate the entire next-resolution grid systematically, without
        # constructing its Cartesian product. Each tile covers every valid Z.
        stage = 'varredura global por blocos'
        steps = dict(diametro=max(.0001, .1 / 2**min(resolution, 10)),
                     ae_ao=max(.0001, .05 / 2**min(resolution, 10)),
                     p_d=max(.0001, .05 / 2**min(resolution, 10)))
        axes = {}
        for key in ('diametro', 'p_d'):
            span = base['helice'][key]
            maximum = span['max'] if span['max'] is not None else base['navio']['calado_popa']/base['restricoes']['ta_sobre_d_min']
            axes[key] = p._faixa(dict(min=span['min'], max=maximum, passo=steps[key]))
        area_axes = {z:p._faixa(dict(min=max(base['helice']['ae_ao']['min'], p.AE_AO_POR_Z[z][0]), max=min(base['helice']['ae_ao']['max'], p.AE_AO_POR_Z[z][1]), passo=steps['ae_ao'])) for z in valid_z}
        width = 5
        counts = [math.ceil(len(axes['diametro'])/width), math.ceil(len(axes['p_d'])/width), max(math.ceil(len(values)/width) for values in area_axes.values())]
        tile_total = math.prod(counts)
        d_index = cursor // (counts[1]*counts[2])
        p_index = (cursor // counts[2]) % counts[1]
        a_index = cursor % counts[2]
        for z in valid_z:
            selected = dict(diametro=axes['diametro'][d_index*width:(d_index+1)*width], p_d=axes['p_d'][p_index*width:(p_index+1)*width], ae_ao=area_axes[z][a_index*width:(a_index+1)*width])
            if not len(selected['ae_ao']):
                continue
            local = copy.deepcopy(base)
            local['helice']['z'] = [z]
            for key, values in selected.items():
                local['helice'][key] = dict(min=float(values[0]), max=float(values[-1]), passo=steps[key])
            grids.append(local)
    else:
        stage = 'refinamento de todas as pás'
        for z in valid_z:
            rows = previous_by_z.get(str(z), [])
            row = rows[(iteration-1) % len(rows)] if rows else None
            local = configurar_perfil(base, 'rapido')
            local['helice']['z'] = [z]
            if row is not None:
                for key, column, initial in [('diametro','D',.1), ('ae_ao','Ae/Ao',.05), ('p_d','P/D',.05)]:
                    span = base['helice'][key]
                    lower = span['min']
                    upper = span['max'] if span['max'] is not None else base['navio']['calado_popa']/base['restricoes']['ta_sobre_d_min']
                    if key == 'ae_ao':
                        lower, upper = max(lower, p.AE_AO_POR_Z[z][0]), min(upper, p.AE_AO_POR_Z[z][1])
                    center = float(row[column])
                    step = max(.0001, initial / 2**min(iteration,10))
                    minimum = center-math.floor((center-max(lower,center-2*step)+1e-9)/step)*step
                    local['helice'][key] = dict(min=round(minimum,6), max=round(min(upper,center+2*step),6), passo=step)
            grids.append(local)
    objective = {'bhp':'BHP_kW','foc':'FOC_t_h'}[base['backtest']['objetivo']]
    keys = ['viol_total',objective,'Z','D','Ae/Ao','P/D']
    frames = []
    if estado and estado['ranking']:
        frames.append(pd.DataFrame(estado['ranking']))
    for rows in previous_by_z.values():
        if rows:
            frames.append(pd.DataFrame(rows))
    funnel = {}
    completed = 0
    total = sum(p.tamanho_malha(grid) for grid in grids)
    if progresso:
        progresso(0,total)
    with tempfile.TemporaryDirectory() as temporary:
        if diagnostico_destino:
            with open(diagnostico_destino,'w',encoding='utf-8'):
                pass
        first = True
        for grid in grids:
            part = os.path.join(temporary,'parte.csv') if diagnostico_destino else None
            callback = (lambda done,size: progresso(completed+done,total)) if progresso else None
            g,f,steps,resistance,effective = backtest_perfil(grid,'personalizado',callback,diagnostico_destino=part)
            frames.extend([g,f])
            for name,count in steps:
                funnel[name] = funnel.get(name,0)+count
            completed += steps[0][1]
            if diagnostico_destino:
                with open(part,encoding='utf-8') as handle:
                    content = handle.read()
                with open(diagnostico_destino,'a',encoding='utf-8',newline='') as handle:
                    handle.write(content if first else content.split('\n',1)[1])
                first = False
    candidates = pd.concat(frames,ignore_index=True).drop_duplicates(['Z','D','Ae/Ao','P/D']).sort_values(keys,kind='stable')
    by_z = {str(z):json_records(candidates[candidates['Z']==z].head(5)) for z in valid_z}
    candidates = candidates.head(base['backtest']['top']).reset_index(drop=True)
    next_cursor,next_resolution = cursor,resolution
    if stage == 'varredura global por blocos':
        next_cursor = cursor+1
        if next_cursor >= tile_total:
            next_cursor,next_resolution = 0,resolution+1
    state = dict(iteracao=iteration+1, avaliacoes=(estado['avaliacoes'] if estado else 0)+completed,
                 ranking=json_records(candidates), melhores_por_z=by_z, cursor_global=next_cursor,resolucao_global=next_resolution)
    base['calibracao'] = dict(motor=motor or None,nivel=nivel,iteracao=state['iteracao'],avaliacoes=state['avaliacoes'],
        etapa=stage,pas_permitidas=valid_z,pas_avaliadas=sorted(set(z for grid in grids for z in grid['helice']['z'])),
        bloco_global=cursor+1 if stage=='varredura global por blocos' else None,blocos_globais=tile_total if stage=='varredura global por blocos' else None,
        resolucao_global=resolution,malhas_rodada=[grid['helice'] for grid in grids],
        contagens='avaliações acumuladas podem repetir pontos; funil e diagnóstico CSV referem-se à última rodada')
    approved = candidates[candidates['cabe_motor']].reset_index(drop=True)
    return approved,candidates,list(funnel.items()),resistance,base,state

def json_records(frame):
    # Keep the original float values for transfer to the simulator; only
    # replace missing values so the payload remains valid JSON.
    return frame.astype(object).where(pd.notna(frame), None).to_dict(orient='records')
