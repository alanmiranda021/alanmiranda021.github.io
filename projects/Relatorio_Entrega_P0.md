# Entrega P0 — baseline, diagnóstico e rastreabilidade

## Escopo implementado

API v4 preservada. Equações, margens, limites geométricos, catálogo, seleção, refinamentos e parada permanecem com o comportamento legado. A observação é opcional em `backtest`, `backtest_perfil` e `calibrar_motor`, pelo argumento adicional `auditoria=None`.

- `propulsao_auditoria.py`: CSV de primeira rejeição por geometria/lote, diagnóstico do candidato, hashes e histórico.
- `propulsao.py` e `propulsao_busca.py`: callbacks nos filtros existentes e integração das exportações.
- Worker/controlador/HTML: explicação de RPM e potência, downloads e histórico das rodadas concluídas.
- Testes: conservação das contagens, valores sem arredondamento, causas de rejeição, exclusividade de motor, snapshots, transferências e downloads.

## Evidência numérica

Os snapshots `baselines/p0_antes.json` e `baselines/p0_depois.json` incluem CONFIG integral e hashes. O registrador recusa sobrescrever arquivos existentes. Este comparador verifica todas as colunas do melhor candidato e exige igualdade de CONFIG, funil e contagem de aprovados.

Aceite: `abs(novo-antigo) <= 1e-9 + 1e-10*abs(antigo)`. Contagens são exatas. Nenhuma diferença foi observada nos valores abaixo. Tempos foram registrados, mas não constituem benchmark controlado.

| Caso | Grandeza | Antes | Depois | Diferença |
|---|---|---:|---:|---:|
| referencia_detalhada | RT | 1787.4331403028286 | 1787.4331403028286 | 0 |
| referencia_detalhada | EHP_kW | 22988.376221116934 | 22988.376221116934 | 0 |
| referencia_detalhada | rpm | 79.495648718308274 | 79.495648718308274 | 0 |
| referencia_detalhada | BHP_kW | 33907.318198528905 | 33907.318198528905 | 0 |
| referencia_detalhada | MCR_kW | 49653.728425408626 | 49653.728425408626 | 0 |
| referencia_detalhada | RPM_MCR | 90.274030282449289 | 90.274030282449289 | 0 |
| referencia_detalhada | SFOC | 165.67904751634399 | 165.67904751634399 | 0 |
| referencia_detalhada | FOC_t_h | 5.6177321829658657 | 5.6177321829658657 | 0 |
| pontual | RT | 1787.4331403028286 | 1787.4331403028286 | 0 |
| pontual | EHP_kW | 22988.376221116934 | 22988.376221116934 | 0 |
| pontual | rpm | 115.95876981227279 | 115.95876981227279 | 0 |
| pontual | BHP_kW | 31476.211970749755 | 31476.211970749755 | 0 |
| pontual | MCR_kW | 46093.627101538572 | 46093.627101538572 | 0 |
| pontual | RPM_MCR | 131.68098715241791 | 131.68098715241791 | 0 |
| pontual | SFOC | 165.67904751634399 | 165.67904751634399 | 0 |
| pontual | FOC_t_h | 5.2149488187363637 | 5.2149488187363637 | 0 |

### Funil de referência

| Etapa | Sobreviventes |
|---|---:|
| Combinacoes geradas | 214415 |
| Empuxo disponivel = requerido (M12 = 0) | 199557 |
| J >= 0.01 e KT, KQ > 0 | 199557 |
| 0.1 <= eta0 <= 0.9 | 199557 |
| Cavitacao Burrill <= 5% dorso | 14213 |
| Cabe no layout de um motor MAN B&W | 0 |

### Auditoria executada na malha completa

Evidência: `baselines/p0_auditoria_referencia.json`. Foram observadas todas as 214.415 avaliações, com 200.202 rejeições anteriores ao motor e 14.213 análises pelo catálogo. Cada avaliação consta exatamente uma vez no diagnóstico da execução.

| Primeira rejeição ou resultado | Quantidade |
|---|---:|
| SEM_BRACKET | 14858 |
| J_KT_KQ | 0 |
| EFICIENCIA | 0 |
| CAVITACAO | 185344 |
| VIAVEL | 0 |
| RPM_E_POTENCIA_MOTOR | 14149 |
| RPM_MOTOR | 64 |
| POTENCIA_MOTOR | 0 |

O caso continua sem motor aprovado: 8G90ME-C10.5, RPM MCR 90,27403028244929 contra máximo 84, violação 0,06949983580902624. O ranking exibido é exploratório.

## Interpretação dos novos arquivos

- `diagnostico_restricoes.csv`: última rodada, uma linha por geometria avaliada em cada lote. Registra a primeira rejeição: `SEM_BRACKET`, `J_KT_KQ`, `EFICIENCIA`, `CAVITACAO`, `MCR_LIMITE`; quem chega ao motor recebe `VIAVEL`, `RPM_MOTOR`, `POTENCIA_MOTOR` ou `RPM_E_POTENCIA_MOTOR`.
- `analisado_motor=false`: não houve avaliação pelo catálogo. Campos ainda não calculados ficam vazios. `viavel=true` exige passar os filtros legados e o catálogo; modo informativo não transforma incompatibilidade em aprovação.
- `historico_busca.json`: rodadas concluídas, datas, duração, causas, avaliados brutos, rejeitados anteriores ao motor, analisados por motor, aprovados, objetivo, contexto da malha e melhor preservado. Na calibração, o melhor inclui candidatos de rodadas anteriores; não significa candidato encontrado nessa rodada.
- `historico_busca.csv`: contagens e contexto por rodada; detalhes do melhor e hashes estão no JSON.
- `config_execucao.json`: CONFIG, catálogo efetivo, diagnóstico e histórico com hashes. O hash do arquivo CSV é separado do hash do catálogo efetivo serializado. Para catálogo incorporado, o hash bruto do CSV é `null`.

As contagens são da rodada, não cumulativas. A soma `analisados_motor + rejeitados_antes_motor` deve igualar `avaliados_brutos`. Uma geometria pode reaparecer em outra rodada. Os CSVs de candidatos não são um arquivo acumulado de todas as rodadas; o histórico acumulado reúne seus resumos. Interseções de área por Z delimitam a malha gerada; geometrias excluídas antes de gerá-la não contam como avaliadas. Em `SEM_BRACKET`, a RPM é a tentativa retornada pela bisseção legada, não equilíbrio confirmado; o status impede interpretá-la como solução.

O histórico acompanha o último snapshot concluído. Ao parar durante a próxima rodada, as contagens parciais não são incorporadas; o snapshot anterior é preservado. Uma nova execução começa outro histórico. Não foi implementada persistência entre sessões.

## Limites ativos

`diagnostico_viabilidade.limites_geometricos` separa teto efetivo, mínimo, último ponto amostrado e indicadores de proximidade. Tolerância padrão: `min(passo/2, max(1e-9, passo*1e-5))`; pode ser informada em `diagnostico.tolerancia_limite`. Isso apenas anota proximidade e não altera restrições nem cálculo. Para refinamentos, esses campos descrevem a malha-base da configuração exportada; as malhas efetivamente percorridas estão em `contexto.malhas_rodada`.

## Verificação executada

- Antes: 25 testes Python aprovados. Depois: 33 testes Python aprovados.
- Teste real Worker/Pyodide 0.29.2 aprovado, incluindo históricos, hashes e equivalência Python/JS.
- Teste real Edge/Playwright aprovado, incluindo calibração completa, exploração infinita com parada, transferências, exportações e largura móvel.
- Verificação sintática dos três JavaScripts aprovada.
- Comparação das árvores sintáticas de `resistencia`, `serie_b`, `coef_propulsivos`, `burrill`, `margens`, `sfoc`, `_resolver_rpm` e `motores_que_cabem`: sem alterações em relação ao checkout publicado anterior.

```powershell
python -m unittest discover -s projects -p "test_propulsao*.py"
python projects/comparar_baseline_p0.py
node --check naval.js
node --check naval-backtest.js
node --check naval-backtest-worker.js
node projects/test_propulsao_worker.cjs <caminho-pyodide>
node projects/test_propulsao_browser.cjs <caminho-playwright-core> http://127.0.0.1:8080
```

## Rastreabilidade dos arquivos finais

Hashes abaixo correspondem aos arquivos disponíveis quando este relatório foi gerado. Os snapshots numéricos também guardam seus próprios hashes; pequenos acréscimos posteriores de metadados não reescrevem essas evidências. No navegador, os hashes de recursos JS/HTML/CSS são calculados das fontes obtidas com `no-store`, não de uma introspecção do código já carregado pelo navegador.

| Arquivo | SHA-256 LF |
|---|---|
| `projects/propulsao.py` | `f1741e8722a58ff407ad2be1354820c71cfcada25dc66ec266ab25d71026d032` |
| `projects/propulsao_busca.py` | `c6b20331515dae74eb94f3f0241ab6aea73e398dc78e780abb0bed522921914c` |
| `projects/propulsao_auditoria.py` | `1d4cd06249800710123eb558635335cac438652c46c9449567d8b2a4d6bb5d41` |
| `projects/motores.csv` | `0e9a595c665332162034809a8c6ae9c8582481913514e771efac3e40b277a3b8` |
| `naval.js` | `1810ff77179f93fdc21b5729a971fb6308ad1910fcde55e7d5196aeb02d4e062` |
| `naval-backtest.js` | `914bdbd61ba3a418a48ec316896f3d3f82003f15d55af418b1406f77c677a9cb` |
| `naval-backtest-worker.js` | `70949dbfe02cd09a459bb3ebec341c91e654e485d01448ca3da3c92be0922e3e` |
| `naval.html` | `d2fc29220778f0bd88bc3298f3201dad3d4f9c8ef169ecb3130ff80e6d2f0473` |
| `naval.css` | `4d5af14e89746e4b502e486ef51dd7bf0136f1b345e1b379852dbbebf9ca7d4b` |

## Pendências deliberadas

Cache, contagem de geometrias únicas, retomada persistente, critérios de convergência, otimizadores heurísticos, transmissão, missão e calibração experimental pertencem às próximas fases. O status `VIAVEL` significa aprovação nos filtros atuais do modelo; não certificação de engenharia. Este P0 não acrescenta filtros de domínio empírico nem altera raízes nos extremos. Catálogo ausente/entrada inválida continua sendo erro de execução; não é contado como rejeição de uma geometria.

