"""Sprint 1: FOC, incumbentes separados e cobertura ampla explícita."""
import copy
import hashlib
import json
import math
import propulsao as p
import propulsao_busca as busca
from propulsao_auditoria import hashes_fontes

WEB_API_VERSION=4


def chave(row,feasible):
    return tuple(([] if feasible else [row['viol_total']])+[row['FOC_t_h'],row['BHP_kW'],row['Z'],row['D'],row['Ae/Ao'],row['P/D'],str(row.get('Motores',''))])


def selecionar(rows,feasible):
    valid=[row for row in rows if bool(row.get('cabe_motor'))==feasible and
           all(isinstance(row.get(key),(int,float)) and math.isfinite(row[key]) for key in ('FOC_t_h','BHP_kW','viol_total'))]
    return min(valid,key=lambda row:chave(row,feasible)) if valid else None


def otimizar(cfg,motor=None,nivel='completo',paciencia=2,max_rodadas=12,tolerancia=1e-3,
             progresso=None,rodada_cb=None,analisar_alternativas=False,cancelar=None):
    if nivel not in ('rapido','completo'):
        raise ValueError('Sprint 1 suporta rapido/completo; profundo requer cobertura global do Sprint 2.')
    for name,value in (('paciencia',paciencia),('max_rodadas',max_rodadas)):
        if isinstance(value,bool) or not isinstance(value,int) or value<1:
            raise ValueError(name+' deve ser inteiro positivo.')
    if not isinstance(tolerancia,(int,float)) or isinstance(tolerancia,bool) or not math.isfinite(tolerancia) or tolerancia<0:
        raise ValueError('tolerancia deve ser finita e não negativa.')
    original=copy.deepcopy(cfg);work=copy.deepcopy(cfg)
    work['backtest']['objetivo']='foc';work['helice']['z']=[2,3,4,5,6,7]
    work['restricoes']['motor']='estrito'
    p.validar_config(work,limite_malha=None)
    catalog=p.carregar_motores(work)
    if motor and not any(row[0]==motor for row in catalog):
        raise ValueError('Motor solicitado ausente do catálogo.')
    if motor:
        chosen=next(row for row in catalog if row[0]==motor)
        work['motor']['catalogo_registrado']=[dict(zip(('modelo','n_min','n_max','p_max_kw','p_min_kw'),chosen))]
        catalog=[chosen]
    allowed=[z for z in work['helice']['z'] if max(work['helice']['ae_ao']['min'],p.AE_AO_POR_Z[z][0])<=min(work['helice']['ae_ao']['max'],p.AE_AO_POR_Z[z][1])]
    expected=p.tamanho_malha(busca.configurar_perfil(work,nivel))
    state=None;best_v=best_d=None;history=[];stale=0;covered=False;funnel=[];used=work
    reason='orcamento';by_z={str(z):dict(admissivel=z in allowed,motivo=None if z in allowed else 'interseção AE/AO vazia',melhor_viavel=None,melhor_diagnostico=None) for z in range(2,8)}
    for iteration in range(1,max_rodadas+1):
        if cancelar and cancelar():reason='cancelado';break
        before=best_v or best_d
        approved,ranking,funnel,_,used,state=busca.calibrar_motor(work,motor,nivel,state,progresso)
        rows=busca.json_records(approved)+busca.json_records(ranking)
        for pool in state.get('reservatorios',{}).values():rows+=pool['viaveis']+pool['diagnosticos']
        best_v=selecionar(rows+([best_v] if best_v else []),True)
        best_d=selecionar(rows+([best_d] if best_d else []),False)
        for z in range(2,8):
            local=by_z[str(z)]
            zrows=[row for row in rows if row['Z']==z]
            local['melhor_viavel']=selecionar(zrows+([local['melhor_viavel']] if local['melhor_viavel'] else []),True)
            local['melhor_diagnostico']=selecionar(zrows+([local['melhor_diagnostico']] if local['melhor_diagnostico'] else []),False)
        metadata=used.get('calibracao',{})
        # This certifies only the initial discrete broad profile, never the
        # global fine tiles. Deep/global coverage is deliberately not claimed.
        if iteration==1:
            covered=(metadata.get('etapa')=='varredura ampla' and set(metadata.get('pas_avaliadas',[]))==set(allowed)
                     and bool(funnel) and funnel[0][1]==expected)
        current=best_v or best_d
        significant=False;improved=False
        if current:
            feasible=best_v is not None
            improved=(before is None or (bool(before['cabe_motor'])!=feasible and feasible) or chave(current,feasible)<chave(before,feasible))
            significant=(before is None or (not bool(before['cabe_motor']) and feasible) or
                         (not feasible and current['viol_total']<before['viol_total']-1e-9) or
                         (bool(before['cabe_motor'])==feasible and current['viol_total']<=before['viol_total']+1e-9 and current['FOC_t_h']<before['FOC_t_h']*(1-tolerancia)))
        stale=0 if significant else stale+1
        entry=dict(rodada=iteration,etapa=metadata.get('etapa'),aprovados=len(approved),
                   viol_total=current['viol_total'] if current else None,objetivo=current['FOC_t_h'] if current else None,
                   melhorou=significant,melhoria_qualquer=improved,best_so_far=copy.deepcopy(current),
                   best_viavel=copy.deepcopy(best_v),best_diagnostico=copy.deepcopy(best_d),
                   avaliacoes=state.get('avaliacoes',0),cobertura_minima_concluida=covered)
        history.append(entry)
        if rodada_cb:rodada_cb(copy.deepcopy(entry))
        if covered and stale>=paciencia:reason='estagnacao_pos_cobertura';break
    if best_v:status='aprovado'
    elif best_d:status='sem_aprovados_encontrados'
    else:status='sem_hidrodinamica_encontrada'
    if reason=='cancelado':status='interrompido'
    effective=json.dumps(work,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
    result=dict(status=status,melhor=best_v or best_d,melhor_viavel=best_v,melhor_diagnostico=best_d,
                historico=history,funil=funnel,parada_codigo=reason,
                parada=('estagnou após cobertura da malha ampla' if reason=='estagnacao_pos_cobertura' else reason),
                config=used,config_original=original,config_efetiva=work,estado=state,ajustes=[],por_z=by_z,
                objetivo='FOC_t_h',modo='auto_foc_'+nivel,config_hash=hashlib.sha256(effective.encode()).hexdigest(),
                fontes_sha256=hashes_fontes(),versoes=dict(api=4,sprint=1),catalogo_escopo=motor or 'todo catálogo da configuração',
                catalogo=[dict(zip(('modelo','n_min','n_max','p_max_kw','p_min_kw'),row)) for row in catalog],
                alteracoes_modo=dict(objetivo_original=original['backtest']['objetivo'],objetivo_efetivo='foc',
                    pas_originais=original['helice']['z'],pas_efetivas=work['helice']['z'],
                    modo_motor_original=original['restricoes']['motor'],modo_motor_efetivo='estrito'),
                sfoc_origem='Modelo genérico configurado; não representa economia específica de fabricante.',
                cobertura=dict(tipo='malha_ampla_'+nivel,cobertura_minima_concluida=covered,
                    global_discreta_concluida=False,pontos_previstos_ampla=expected,avaliacoes_totais=state.get('avaliacoes',0) if state else 0,
                    avaliacoes_unicas=None,cache_hits=None))
    if analisar_alternativas:
        from propulsao_auto import sugerir_ajustes
        result['ajustes']=sugerir_ajustes(original,motor)
    return result
