"""P0: observação do funil legado, sem alterar critérios ou equações."""
import csv
import hashlib
import json
import math
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

COLUNAS = ['rodada', 'Z', 'D', 'Ae/Ao', 'P/D', 'status', 'analisado_motor',
           'viavel', 'rpm', 'J', 'KTs', 'KQs', 'eta0', 'tau_c', 'tau_max', 'sigma',
           'BHP_kW', 'MCR_kW', 'RPM_MCR', 'SFOC', 'FOC_t_h', 'motor_proximo',
           'motor_n_min', 'motor_n_max', 'motor_p_min_kw', 'motor_p_max_kw',
           'viol_rpm', 'viol_kw', 'viol_total']


def seguro(value):
    if hasattr(value, 'item'):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


class AuditoriaFunil:
    """Uma linha por geometria/lote, na primeira rejeição ou análise do motor.

    As contagens são chamadas avaliadas nesta rodada, não geometrias únicas.
    Valores inexistentes em etapas anteriores ficam vazios, nunca zero.
    """
    def __init__(self, caminho, rodada=1):
        self.handle = open(caminho, 'w', encoding='utf-8', newline='')
        self.writer = csv.DictWriter(self.handle, fieldnames=COLUNAS)
        self.writer.writeheader()
        self.rodada = rodada
        self.contagens = Counter()
        self.inicio = time.perf_counter()

    def registrar(self, frame, status):
        self.contagens[status] += len(frame)
        motor = status in ('VIAVEL', 'RPM_MOTOR', 'POTENCIA_MOTOR', 'RPM_E_POTENCIA_MOTOR')
        for row in frame.to_dict(orient='records'):
            result = {key: seguro(row.get(key)) for key in COLUNAS}
            result.update(rodada=self.rodada, status=status, analisado_motor=motor,
                          viavel=(status == 'VIAVEL'))
            self.writer.writerow(result)

    def finalizar(self, cfg, funil, melhor=None, contexto=None):
        self.handle.flush()
        self.handle.close()
        counts = dict(self.contagens)
        motor_keys = ('VIAVEL', 'RPM_MOTOR', 'POTENCIA_MOTOR', 'RPM_E_POTENCIA_MOTOR')
        return dict(rodada=self.rodada, data_utc=datetime.now(timezone.utc).isoformat(),
                    duracao_s=time.perf_counter()-self.inicio, avaliados_brutos=sum(counts.values()),
                    analisados_motor=sum(counts.get(key, 0) for key in motor_keys),
                    rejeitados_antes_motor=sum(value for key,value in counts.items() if key not in motor_keys),
                    aprovados_motor=counts.get('VIAVEL', 0), rejeicoes_e_resultados=counts,
                    funil_rodada=funil, contexto=contexto or {},
                    objetivo=cfg['backtest']['objetivo'], melhor=melhor,
                    nota='Contagens da rodada; avaliações podem repetir geometrias entre rodadas. Sem cache ou contagem de únicos nesta entrega.')


def diagnosticar_viabilidade(candidato, config):
    import propulsao as p
    row = candidato
    vr, vp = float(row['viol_rpm']), float(row['viol_kw'])
    status = 'RPM_E_POTENCIA_MOTOR' if vr > 0 and vp > 0 else 'RPM_MOTOR' if vr > 0 else 'POTENCIA_MOTOR' if vp > 0 else 'VIAVEL'
    limites = []
    z = int(row['Z'])
    for key,column in (('diametro','D'),('p_d','P/D'),('ae_ao','Ae/Ao')):
        span = config['helice'][key]
        lower,upper = span['min'],span['max']
        if upper is None:
            upper = config['navio']['calado_popa']/config['restricoes']['ta_sobre_d_min']
        if key == 'ae_ao':
            lower,upper = max(lower,p.AE_AO_POR_Z[z][0]),min(upper,p.AE_AO_POR_Z[z][1])
        last = lower+math.floor((upper-lower+1e-9)/span['passo'])*span['passo']
        tolerance = config.get('diagnostico',{}).get('tolerancia_limite',min(span['passo']/2,max(1e-9,span['passo']*1e-5)))
        if not math.isfinite(tolerance) or tolerance < 0:
            raise ValueError('Tolerância de diagnóstico deve ser finita e não negativa.')
        limites.append(dict(parametro=column, minimo_efetivo=lower, teto_efetivo=upper,
                            ultimo_ponto_amostrado=last, tolerancia=tolerance,
                            no_teto=math.isclose(float(row[column]),upper,rel_tol=0,abs_tol=tolerance),
                            no_ultimo_ponto=math.isclose(float(row[column]),last,rel_tol=0,abs_tol=tolerance)))
    return dict(viavel=bool(row['cabe_motor']), status=status,
                motor_proximo=row['motor_proximo'], rpm_helice_servico=float(row['rpm']),
                rpm_motor_servico=float(row['rpm']), rpm_motor_mcr=float(row['RPM_MCR']),
                rpm_motor_min=float(row['motor_n_min']), rpm_motor_max=float(row['motor_n_max']),
                mcr_kw=float(row['MCR_kW']), potencia_min_kw=float(row['motor_p_min_kw']),
                potencia_max_kw=float(row['motor_p_max_kw']), viol_rpm=vr, viol_kw=vp,
                viol_total=float(row['viol_total']), restricoes_ativas=p.avisos_limites(config,row), limites_geometricos=limites,
                transmissao='Modelo legado: rotação do motor igual à da hélice; nenhuma relação de redução implementada.')


def hashes_fontes(extra=None):
    root = Path(__file__).resolve().parent.parent
    names = ['projects/propulsao.py', 'projects/propulsao_busca.py',
             'projects/propulsao_auditoria.py', 'projects/motores.csv',
             'naval.js', 'naval-backtest.js', 'naval-backtest-worker.js', 'naval.html', 'naval.css']
    result = {}
    for name in names:
        path = root/name
        if path.is_file():
            raw = path.read_bytes()
            result[name] = dict(bytes_sha256=hashlib.sha256(raw).hexdigest(),
                                lf_sha256=hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest())
    result.update(extra or {})
    return result


def historico_csv(historico):
    import io
    stream = io.StringIO(newline='')
    columns = ['rodada', 'data_utc', 'duracao_s', 'avaliados_brutos', 'analisados_motor',
               'rejeitados_antes_motor', 'aprovados_motor', 'objetivo', 'rejeicoes_e_resultados', 'contexto']
    writer = csv.DictWriter(stream, fieldnames=columns)
    writer.writeheader()
    for row in historico:
        writer.writerow({key: json.dumps(row.get(key),ensure_ascii=False,allow_nan=False)
                         if isinstance(row.get(key),(dict,list)) else row.get(key) for key in columns})
    return stream.getvalue()
