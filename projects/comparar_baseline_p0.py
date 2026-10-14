"""Compara os snapshots P0 e gera relatório com tolerâncias explícitas."""
import json
import math
from pathlib import Path
from propulsao_auditoria import hashes_fontes

ROOT=Path(__file__).resolve().parent


def comparar():
    before=json.loads((ROOT/'baselines/p0_antes.json').read_text(encoding='utf-8'))
    after=json.loads((ROOT/'baselines/p0_depois.json').read_text(encoding='utf-8'))
    rows=[]
    for name,old in before['casos'].items():
        new=after['casos'][name]
        assert old['config']==new['config'], name+' configuração'
        assert old['funil']==new['funil'], name+' funil'
        assert old['aprovados_retidos']==new['aprovados_retidos'], name+' aprovados'
        for key in ('RT','EHP_kW'):
            assert math.isclose(old[key],new[key],rel_tol=1e-10,abs_tol=1e-9), (name,key)
            rows.append((name,key,old[key],new[key],new[key]-old[key]))
        for key,value in old['melhor'].items():
            changed=new['melhor'][key]
            if isinstance(value,(int,float)) and not isinstance(value,bool):
                assert math.isclose(value,changed,rel_tol=1e-10,abs_tol=1e-9),(name,key)
            else:
                assert value==changed,(name,key)
        for key in ('rpm','BHP_kW','MCR_kW','RPM_MCR','SFOC','FOC_t_h'):
            rows.append((name,key,old['melhor'][key],new['melhor'][key],new['melhor'][key]-old['melhor'][key]))
    return before,after,rows


if __name__=='__main__':
    before,after,rows=comparar()
    text=['# Entrega P0 — baseline, diagnóstico e rastreabilidade\n',
          '## Escopo implementado\n',
          'API v4 preservada. Equações, margens, limites geométricos, catálogo, seleção, refinamentos e parada permanecem com o comportamento legado. A observação é opcional em `backtest`, `backtest_perfil` e `calibrar_motor`, pelo argumento adicional `auditoria=None`.\n',
          '- `propulsao_auditoria.py`: CSV de primeira rejeição por geometria/lote, diagnóstico do candidato, hashes e histórico.\n- `propulsao.py` e `propulsao_busca.py`: callbacks nos filtros existentes e integração das exportações.\n- Worker/controlador/HTML: explicação de RPM e potência, downloads e histórico das rodadas concluídas.\n- Testes: conservação das contagens, valores sem arredondamento, causas de rejeição, exclusividade de motor, snapshots, transferências e downloads.\n',
          '## Evidência numérica\n',
          'Os snapshots `baselines/p0_antes.json` e `baselines/p0_depois.json` incluem CONFIG integral e hashes. O registrador recusa sobrescrever arquivos existentes. Este comparador verifica todas as colunas do melhor candidato e exige igualdade de CONFIG, funil e contagem de aprovados.\n',
          'Aceite: `abs(novo-antigo) <= 1e-9 + 1e-10*abs(antigo)`. Contagens são exatas. Nenhuma diferença foi observada nos valores abaixo. Tempos foram registrados, mas não constituem benchmark controlado.\n',
          '| Caso | Grandeza | Antes | Depois | Diferença |','|---|---|---:|---:|---:|']
    text += [f'| {name} | {key} | {old:.17g} | {new:.17g} | {difference:.17g} |' for name,key,old,new,difference in rows]
    reference=after['casos']['referencia_detalhada']
    text += ['\n### Funil de referência\n','| Etapa | Sobreviventes |','|---|---:|']
    text += [f'| {name} | {count} |' for name,count in reference['funil']]
    audited=ROOT/'baselines/p0_auditoria_referencia.json'
    if audited.exists():
        audit=json.loads(audited.read_text(encoding='utf-8'))
        assert audit['avaliados_brutos']==reference['funil'][0][1]
        assert audit['analisados_motor']==14213 and audit['aprovados_motor']==0
        text += ['\n### Auditoria executada na malha completa\n',
                 'Evidência: `baselines/p0_auditoria_referencia.json`. Foram observadas todas as 214.415 avaliações, com 200.202 rejeições anteriores ao motor e 14.213 análises pelo catálogo. Cada avaliação consta exatamente uma vez no diagnóstico da execução.\n',
                 '| Primeira rejeição ou resultado | Quantidade |','|---|---:|']
        text += [f'| {name} | {count} |' for name,count in audit['rejeicoes_e_resultados'].items()]
    text += ['\nO caso continua sem motor aprovado: 8G90ME-C10.5, RPM MCR 90,27403028244929 contra máximo 84, violação 0,06949983580902624. O ranking exibido é exploratório.\n',
             '## Interpretação dos novos arquivos\n',
             '- `diagnostico_restricoes.csv`: última rodada, uma linha por geometria avaliada em cada lote. Registra a primeira rejeição: `SEM_BRACKET`, `J_KT_KQ`, `EFICIENCIA`, `CAVITACAO`, `MCR_LIMITE`; quem chega ao motor recebe `VIAVEL`, `RPM_MOTOR`, `POTENCIA_MOTOR` ou `RPM_E_POTENCIA_MOTOR`.\n- `analisado_motor=false`: não houve avaliação pelo catálogo. Campos ainda não calculados ficam vazios. `viavel=true` exige passar os filtros legados e o catálogo; modo informativo não transforma incompatibilidade em aprovação.\n- `historico_busca.json`: rodadas concluídas, datas, duração, causas, avaliados brutos, rejeitados anteriores ao motor, analisados por motor, aprovados, objetivo, contexto da malha e melhor preservado. Na calibração, o melhor inclui candidatos de rodadas anteriores; não significa candidato encontrado nessa rodada.\n- `historico_busca.csv`: contagens e contexto por rodada; detalhes do melhor e hashes estão no JSON.\n- `config_execucao.json`: CONFIG, catálogo efetivo, diagnóstico e histórico com hashes. O hash do arquivo CSV é separado do hash do catálogo efetivo serializado. Para catálogo incorporado, o hash bruto do CSV é `null`.\n',
             'As contagens são da rodada, não cumulativas. A soma `analisados_motor + rejeitados_antes_motor` deve igualar `avaliados_brutos`. Uma geometria pode reaparecer em outra rodada. Os CSVs de candidatos não são um arquivo acumulado de todas as rodadas; o histórico acumulado reúne seus resumos. Interseções de área por Z delimitam a malha gerada; geometrias excluídas antes de gerá-la não contam como avaliadas. Em `SEM_BRACKET`, a RPM é a tentativa retornada pela bisseção legada, não equilíbrio confirmado; o status impede interpretá-la como solução.\n',
             'O histórico acompanha o último snapshot concluído. Ao parar durante a próxima rodada, as contagens parciais não são incorporadas; o snapshot anterior é preservado. Uma nova execução começa outro histórico. Não foi implementada persistência entre sessões.\n',
             '## Limites ativos\n',
             '`diagnostico_viabilidade.limites_geometricos` separa teto efetivo, mínimo, último ponto amostrado e indicadores de proximidade. Tolerância padrão: `min(passo/2, max(1e-9, passo*1e-5))`; pode ser informada em `diagnostico.tolerancia_limite`. Isso apenas anota proximidade e não altera restrições nem cálculo. Para refinamentos, esses campos descrevem a malha-base da configuração exportada; as malhas efetivamente percorridas estão em `contexto.malhas_rodada`.\n',
             '## Verificação executada\n',
             '- Antes: 25 testes Python aprovados. Depois: 33 testes Python aprovados.\n- Teste real Worker/Pyodide 0.29.2 aprovado, incluindo históricos, hashes e equivalência Python/JS.\n- Teste real Edge/Playwright aprovado, incluindo calibração completa, exploração infinita com parada, transferências, exportações e largura móvel.\n- Verificação sintática dos três JavaScripts aprovada.\n- Comparação das árvores sintáticas de `resistencia`, `serie_b`, `coef_propulsivos`, `burrill`, `margens`, `sfoc`, `_resolver_rpm` e `motores_que_cabem`: sem alterações em relação ao checkout publicado anterior.\n',
             '```powershell\npython -m unittest discover -s projects -p "test_propulsao*.py"\npython projects/comparar_baseline_p0.py\nnode --check naval.js\nnode --check naval-backtest.js\nnode --check naval-backtest-worker.js\nnode projects/test_propulsao_worker.cjs <caminho-pyodide>\nnode projects/test_propulsao_browser.cjs <caminho-playwright-core> http://127.0.0.1:8080\n```\n',
             '## Rastreabilidade dos arquivos finais\n',
             'Hashes abaixo correspondem aos arquivos disponíveis quando este relatório foi gerado. Os snapshots numéricos também guardam seus próprios hashes; pequenos acréscimos posteriores de metadados não reescrevem essas evidências. No navegador, os hashes de recursos JS/HTML/CSS são calculados das fontes obtidas com `no-store`, não de uma introspecção do código já carregado pelo navegador.\n',
             '| Arquivo | SHA-256 LF |','|---|---|']
    text += [f'| `{name}` | `{value["lf_sha256"]}` |' for name,value in hashes_fontes().items()]
    text += ['\n## Pendências deliberadas\n',
             'Cache, contagem de geometrias únicas, retomada persistente, critérios de convergência, otimizadores heurísticos, transmissão, missão e calibração experimental pertencem às próximas fases. O status `VIAVEL` significa aprovação nos filtros atuais do modelo; não certificação de engenharia. Este P0 não acrescenta filtros de domínio empírico nem altera raízes nos extremos. Catálogo ausente/entrada inválida continua sendo erro de execução; não é contado como rejeição de uma geometria.\n']
    (ROOT/'Relatorio_Entrega_P0.md').write_text('\n'.join(text)+'\n',encoding='utf-8',newline='\n')
    print('PASS: baseline comparado; relatório gerado.')
