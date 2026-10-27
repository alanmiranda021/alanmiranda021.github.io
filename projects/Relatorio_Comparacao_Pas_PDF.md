# Comparação por pás e exportação científica em PDF

## Entrega

O painel apresenta todas as categorias Z=2 a 7, com contagens reais da última rodada, rejeições antes/depois do catálogo e rankings independentes. O ranking global, as equações, as margens, o catálogo e o algoritmo de exploração permanecem preservados. A API continua v4; os recursos novos usam `exploration-4-pas-pdf` e verificam a capacidade de resumir pás no handshake.

## Uso

1. Em **Alternativas de pás**, escolha explorar todas ou respeitar o JSON. Executar a busca não amplia silenciosamente AE/AO.
2. Consulte o painel **Exploração por número de pás**. Z excluído por configuração/domínio aparece com zero avaliações e motivo explícito.
3. Em **Visualizar ranking**, escolha global ou Z. **Hélice para carregar e exportar** seleciona um candidato do ranking correspondente.
4. O botão de carregar transfere exatamente o candidato escolhido. A conclusão/parada automática continua carregando o melhor global, preservando o comportamento anterior.
5. **Exportar curvas da hélice PDF** usa o candidato selecionado; **Relatório comparativo por pás PDF** inclui o melhor preservado de cada Z. A simulação também oferece **Exportar curvas PDF**, que representa sua configuração atual.

## Significado das situações

| Situação da rodada | Significado |
|---|---|
| EXCLUIDA_CONFIG | Z não está na lista solicitada. |
| EXCLUIDA_DOMINIO_AE_AO | O intervalo de área não intersecta o domínio da Série B desse Z. |
| NAO_AVALIADA_NESTA_RODADA | Categoria permitida, mas não foi percorrida neste bloco/rodada. |
| SEM_SOLUCAO_HIDRODINAMICA | Foi avaliada, mas nenhum candidato passou todos os filtros anteriores ao motor. |
| SEM_MOTOR_COMPATIVEL | Há candidatos hidrodinâmicos, mas nenhum passou o catálogo nesta rodada. |
| COM_MOTOR_COMPATIVEL | Existe aprovação nos filtros e no catálogo nesta rodada. |

Para cada Z: `geradas_rodada = avaliadas_rodada = rejeitadas_antes_motor + analisadas_motor`. Dentro do motor: `analisadas_motor = rejeitadas_motor + aprovadas_motor`. Categorias fora da malha não são avaliações rejeitadas: não foram geradas. As contagens derivam do callback nos filtros existentes, não de totais fixos.

`contagens_acumuladas` soma chamadas concluídas, podendo repetir geometrias entre rodadas. Não é contagem de geometrias únicas. A situação da rodada e o melhor preservado são distintos: um bloco pode não avaliar Z que já possuía uma boa alternativa. Uma nova execução começa novo resumo. Interromper uma rodada mantém a anterior.

O observador conserva até `backtest.top` candidatos por Z, independentemente do corte global, com ordenação por violação, objetivo BHP/FOC e desempates geométricos determinísticos. Entre aprovados, a violação é zero. Geometrias repetidas são deduplicadas no ranking preservado; as contagens de avaliações continuam brutas. O algoritmo de calibração mantém seu estado original `melhores_por_z`, e o painel recebe um estado observacional separado `bladeState`.

Categorias sem candidato hidrodinâmico não recebem curvas inventadas. Seu diagnóstico conserva as contagens e um representante da primeira rejeição, explicitamente sem classificação de ótimo. Esse representante não pode ser carregado como solução.

## Conteúdo e métodos dos PDFs

- Três gráficos vetoriais: K_T × J, 10 K_Q × J e eta_0 × J. Eta é uma fração; valores não físicos/não finitos são omitidos, produzindo interrupções na curva.
- Marcador vermelho no ponto operacional, geometria, RPM, eficiência, potência, consumo, motor e estado de compatibilidade.
- Detalhes numéricos, cavitação, limites ativos, configuração e proveniência. Categorias sem curva continuam aparecendo no comparativo.
- Anexo **dados_propulsao.json**, UTF-8, com valores de ponto flutuante completos, amostras, configurações, categorias e metadados. Rótulos e coordenadas gráficas servem à apresentação; os dados científicos completos permanecem no anexo.
- O PDF é produzido localmente por `naval-pdf.js`, sem servidor, biblioteca remota de PDF, captura de tela ou diálogo de impressão. Usa páginas A4, fonte padrão e desenhos vetoriais. Para compatibilidade da fonte, textos exibidos são transliterados; strings originais permanecem no JSON.

**Backtest:** chama a função `serie_b` Python existente, com D e RPM fixos. Amostra J de 0 a 1,5 (301 pontos) e acrescenta o J operacional exato; usa Va=J·n·D e recalcula Reynolds por amostra. Se o ponto estiver além da faixa, sua amostra é incluída e identificável pelos valores. Não é recalculado um novo equilíbrio de empuxo em cada J.

**Simulação:** usa `calculateAtJ` JavaScript existente, como no CSV, com Reynolds e rugosidade do ponto fixados, amostrando até J de empuxo zero. Isso não é uma nova otimização nem uma aprovação do motor após edição manual. O PDF identifica a compatibilidade como não reavaliada; consumo fora da faixa válida aparece indisponível. As diferenças de correções entre Python/JavaScript documentadas no manual continuam aplicáveis.

As curvas são varreduras de coeficientes, não uma missão de velocidades com cavitação e envelope do motor verificados em cada amostra. No comparativo, cada Z possui seus próprios D, área, P/D e RPM: trata-se de comparação das melhores geometrias encontradas, não de um experimento que isola apenas o efeito do número de pás.

## Arquivos e contratos

- `propulsao_auditoria.py`: contagens, rankings e resumo por Z, sem modificar filtros.
- `propulsao.py`: inclui `por_pas` nos registros CLI.
- Worker: retorna `bladeSummary` e `propellerCurves`; recebe opcionalmente `bladeState` para continuar o resumo observacional. O registro JSON inclui `por_pas` e o histórico inclui resumos por categoria.
- Controlador/HTML/CSS: painel, filtros, seleção, carregamento de alternativa e PDFs responsivos.
- `naval.js`: PDF da configuração atual com as funções já existentes.
- `naval-pdf.js`: gráficos vetoriais, páginas, configuração e anexo numérico.
- `test_propulsao_pas.py`: contagens, domínio, categorias sem solução, retenção e equivalência com o ranking integral.
- Testes Worker/browser: igualdade dos coeficientes no ponto, estados entre rodadas, downloads e seleção de alternativa fora do top global.
- `validar_pdf_propulsao.py`: verificador independente via pypdf, opcional para desenvolvimento; não é dependência do simulador.

## Verificação executada

36 testes Python aprovados; Worker real em Pyodide 0.29.2 aprovado; navegador Edge/Playwright aprovado. O teste inclui top global 1 com alternativas preservadas em outros Z, transferência exata de RPM/pás, parada, todos os downloads PDF e largura móvel de 390 px. Uma falha inicial de largura nos selects foi corrigida e o teste repetido passou.

PDFs de simulação, hélice de backtest e comparativo foram lidos com pypdf em modo estrito. A verificação confirmou o anexo JSON, conteúdo textual, operadores de desenho e ausência de imagens raster. Para o backtest, a amostra no J operacional coincide com KT/KQ do candidato em tolerância absoluta de 1e-12. Os testes Python de regressão seguem comparando os pontos de referência com `atol=1e-9`, `rtol=1e-10`.

```powershell
python -m unittest discover -s projects -p "test_propulsao*.py"
node --check naval-pdf.js
node --check naval.js
node --check naval-backtest.js
node --check naval-backtest-worker.js
node projects/test_propulsao_worker.cjs <caminho-pyodide>
node projects/test_propulsao_browser.cjs <caminho-playwright-core> http://127.0.0.1:8080
# Opcional: requer pypdf instalado no ambiente de validação.
python projects/validar_pdf_propulsao.py <arquivo.pdf>
```
