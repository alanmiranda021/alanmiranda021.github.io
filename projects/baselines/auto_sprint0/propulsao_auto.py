"""Otimização automática em uma chamada: busca, refinamento, parada por estagnação
e, quando nenhum motor serve, a menor mudança que torna o caso viável.

Uso:
    python propulsao_auto.py                       # navio padrão do CONFIG
    python propulsao_auto.py --config navio.json   # CONFIG próprio (JSON)
    python propulsao_auto.py --motor 8G90ME-C10.5  # restringe a um motor
"""
import copy
import json
import math

import propulsao as p
import propulsao_busca as busca

OBJETIVO = {'bhp': 'BHP_kW', 'foc': 'FOC_t_h'}


def _melhor_linha(approved, ranking):
    frame = approved if len(approved) else ranking
    return None if frame.empty else frame.iloc[0].to_dict()


def _chave(linha, objetivo):
    """Menor é melhor: primeiro a violação do motor, depois o objetivo."""
    return (round(float(linha['viol_total']), 9), float(linha[objetivo]))


def _melhorou(nova, antiga, tolerancia):
    if antiga is None:
        return True
    if nova[0] < antiga[0] - 1e-9:
        return True
    return nova[0] <= antiga[0] + 1e-9 and nova[1] < antiga[1] * (1 - tolerancia)


def otimizar(cfg, motor=None, nivel='completo', paciencia=2, max_rodadas=12, tolerancia=1e-3,
             progresso=None, rodada_cb=None):
    """Roda varredura ampla + refinamentos até a melhoria estagnar.

    Para quando `paciencia` rodadas seguidas não melhoram o melhor resultado
    (violação do motor, depois objetivo) por mais que `tolerancia` relativa,
    ou ao atingir `max_rodadas`. Retorna um dicionário serializável.
    """
    if nivel not in ('rapido', 'completo'):
        raise ValueError("nivel deve ser 'rapido' ou 'completo'.")
    objetivo = OBJETIVO[cfg['backtest']['objetivo']]
    estado, melhor, chave, sem_melhoria = None, None, None, 0
    historico, approved, ranking, usado, funil = [], None, None, None, []
    for rodada in range(1, max_rodadas + 1):
        approved, ranking, funil, _, usado, estado = busca.calibrar_motor(
            cfg, motor, nivel, estado, progresso)
        linha = _melhor_linha(approved, ranking)
        if linha is None:
            break
        nova = _chave(linha, objetivo)
        # Ganho significativo = acima da tolerância contra a rodada anterior; o melhor
        # resultado, porém, é sempre atualizado (ganhos pequenos não se perdem).
        melhorou = _melhorou(nova, chave, tolerancia)
        if chave is None or nova < chave:
            melhor, chave = linha, nova
        sem_melhoria = 0 if melhorou else sem_melhoria + 1
        registro = dict(rodada=rodada, etapa=usado['calibracao']['etapa'], aprovados=len(approved),
                        viol_total=nova[0], objetivo=nova[1], melhorou=melhorou,
                        avaliacoes=estado['avaliacoes'])
        historico.append(registro)
        if rodada_cb:
            rodada_cb(registro)
        # Com o caso aprovado, o primeiro refinamento já mostra se há ganho;
        # sem aprovação, só vale insistir enquanto a violação ainda cai.
        if sem_melhoria >= paciencia:
            break
    if melhor is None:
        return dict(status='sem_hidrodinamica', melhor=None, historico=historico, funil=funil,
                    parada='nenhuma hélice passa nas restrições hidrodinâmicas', config=usado,
                    estado=estado, ajustes=[])
    aprovado = bool(melhor['cabe_motor'])
    parada = ('estagnou (%d rodadas sem melhoria)' % sem_melhoria if sem_melhoria >= paciencia
              else 'limite de %d rodadas' % max_rodadas)
    resultado = dict(status='aprovado' if aprovado else 'inviavel', melhor=melhor, historico=historico,
                     funil=funil, parada=parada, config=usado, estado=estado, ajustes=[])
    if not aprovado:
        resultado['ajustes'] = sugerir_ajustes(cfg, motor)
    return resultado


# --------------------------------------------------------------------------
# Consultor de viabilidade: o que precisa mudar para algum motor servir?
# --------------------------------------------------------------------------
def _viavel(cfg, motor):
    try:
        approved, ranking, *_ = busca.calibrar_motor(cfg, motor, 'rapido')
    except ValueError:
        return False, None
    return len(approved) > 0, (None if ranking.empty else float(ranking.iloc[0]['viol_total']))


def _passos(inicio, fim, passo):
    n = int(math.floor(abs(fim - inicio) / passo + 1e-9))
    return [round(inicio + math.copysign(passo * i, fim - inicio), 6) for i in range(1, n + 1)]


def _alavancas(cfg):
    nv, mg, rs = cfg['navio'], cfg['margens'], cfg['restricoes']

    def velocidade(c, v):
        c['navio']['velocidade_nos'] = v

    def rotacao(c, v):
        c['margens']['rotacao'] = v

    def mar(c, v):
        c['margens']['mar'] = v

    def operacional(c, v):
        c['margens']['operacional'] = v

    def ta_d(c, v):
        c['restricoes']['ta_sobre_d_min'] = v
        c['helice']['diametro']['max'] = None

    return [
        ('velocidade_nos', 'Velocidade de serviço (nós)', velocidade,
         _passos(nv['velocidade_nos'], max(1.0, nv['velocidade_nos'] - 12), .5), nv['velocidade_nos']),
        ('margens.rotacao', 'Margem de rotação (%)', rotacao,
         _passos(mg['rotacao'], 0, 1), mg['rotacao']),
        ('margens.mar', 'Margem de mar (%)', mar,
         _passos(mg['mar'], 0, 5), mg['mar']),
        ('margens.operacional', 'Margem operacional (%)', operacional,
         _passos(mg['operacional'], 0, 5), mg['operacional']),
        ('restricoes.ta_sobre_d_min', 'Ta/D mínimo (permite hélice maior)', ta_d,
         _passos(rs['ta_sobre_d_min'], 1.0, .05), rs['ta_sobre_d_min']),
    ]


def sugerir_ajustes(cfg, motor=None):
    """Para cada parâmetro isolado, a menor mudança que aprova algum motor.

    Cada item: parametro, rotulo, de, para (None se mudar só isso não basta).
    Não altera `cfg`. Cada teste é uma calibração rápida (~1 s).
    """
    saida = []
    for chave, rotulo, aplicar, valores, atual in _alavancas(cfg):
        achado = None
        for valor in valores:
            teste = copy.deepcopy(cfg)
            aplicar(teste, valor)
            ok, _ = _viavel(teste, motor)
            if ok:
                achado = valor
                break
        saida.append(dict(parametro=chave, rotulo=rotulo, de=atual, para=achado))
    return saida


def resumo(resultado):
    """Texto curto para terminal ou interface."""
    melhor, linhas = resultado['melhor'], []
    if melhor is None:
        return 'Nenhuma hélice passa nas restrições hidrodinâmicas (cavitação, J, η0). Revise D máx., velocidade ou Ae/Ao.'
    motor = melhor['motor_proximo']
    linhas.append('Melhor: Z=%d  D=%.3f m  Ae/Ao=%.3f  P/D=%.3f' % (melhor['Z'], melhor['D'], melhor['Ae/Ao'], melhor['P/D']))
    linhas.append('MCR=%.0f kW a %.2f rpm | FOC=%.3f t/h' % (melhor['MCR_kW'], melhor['RPM_MCR'], melhor['FOC_t_h']))
    if resultado['status'] == 'aprovado':
        linhas.append('Motor(es) aprovados: %s' % melhor['Motores'])
    else:
        linhas.append('NENHUM motor serve. Mais próximo: %s (%s; violação %.1f%%)' % (
            motor, melhor['motivo_motor'], 100 * melhor['viol_total']))
        if melhor['viol_rpm'] > 0:
            linhas.append('  RPM_MCR %.2f fora de %g–%g rpm do motor.' % (melhor['RPM_MCR'], melhor['motor_n_min'], melhor['motor_n_max']))
        if melhor['viol_kw'] > 0:
            linhas.append('  MCR %.0f kW fora de %.0f–%.0f kW na rotação do layout.' % (melhor['MCR_kW'], melhor['motor_p_min_kw'], melhor['motor_p_max_kw']))
        linhas.append('Menor mudança isolada que viabiliza:')
        for item in resultado['ajustes']:
            destino = 'não basta sozinho' if item['para'] is None else '%g → %g' % (item['de'], item['para'])
            linhas.append('  - %s: %s' % (item['rotulo'], destino))
    linhas.append('Parada: %s | rodadas: %d' % (resultado['parada'], len(resultado['historico'])))
    return '\n'.join(linhas)


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', help='arquivo JSON com o CONFIG (padrão: CONFIG do propulsao.py)')
    ap.add_argument('--motor', help='modelo de motor específico (padrão: todo o catálogo)')
    ap.add_argument('--nivel', choices=('rapido', 'completo'), default='completo')
    ap.add_argument('--json', action='store_true', help='saída em JSON')
    args = ap.parse_args(argv)
    if args.config:
        with open(args.config, encoding='utf-8') as handle:
            cfg = json.load(handle)
    else:
        cfg = copy.deepcopy(p.CONFIG)
    resultado = otimizar(cfg, args.motor, args.nivel)
    if args.json:
        saida = {k: v for k, v in resultado.items() if k not in ('config', 'estado')}
        print(json.dumps(saida, ensure_ascii=False, indent=2, default=float))
    else:
        print(resumo(resultado))


if __name__ == '__main__':
    main()
