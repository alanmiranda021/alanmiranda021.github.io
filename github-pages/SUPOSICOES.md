# Protocolo do Artigo 3 adaptado — decisões vigentes v3

## Decisões vigentes (substituem o histórico abaixo)

O `.mat` é enviado na barra lateral da própria página; não precisa existir no servidor. O leitor MCOS existente foi preservado, com fallback da inspeção quando `whosmat` não enumera o objeto. O arquivo real fornecido foi lido como 1440×8. Dados e relatórios locais não entram no Git.

| Decisão | Valor vigente e fonte | Registro no PDF |
|---|---|---|
| Smoke técnico | SAE artificial 64×8, h=3, 50 iterações; sem ajustar upload | tempo/memória; sem conclusão científica |
| N-FAST | ship_type, CV externa/interna 3/3, uma repetição, dois candidatos por padrão (até oito), SAE até 50 iterações | perfil demonstrativo distinto do completo |
| MVP local | navio×rota, CV 5/5, E1/E3/DIST, orçamento declarado | configuração integral da execução |
| Completo local | navio×rota, CV externa 5×3, interna 5, até 20 candidatos, SAE até 400 | E3-orig só por seleção explícita; sensibilidade opcional |
| lambda / beta / rho | 0,01 / 1 / 0,05; L2 referência do artigo, beta/rho suposições editáveis | componentes da perda e configuração |
| h / s | h em 3/4/5/6 (UI rápida inicia com 3); s em 0,25/0,5/1 | reconstrução interna e candidatos de ruído |
| near-copies | distância numérica padronizada mínima 1e-5 aos reais | barreira, memória e qualidade |
| piloto aprovado | ao menos min(5, quantidade pedida) aceitos; descarte <=98% | todos os KS, rejeições e motivos |
| plausibilidade | resíduo alvo~distância <=3 desvios do treino; categorias conjuntas observadas | heurística, não prova física |
| KPCA | limite abaixo da dimensão é regra do produto, não teorema geral do kernel | componentes, autovalores e configuração |
| consistência | ganho positivo em >=80% dos pares completos, média positiva | heurística descritiva, não significância |

Valores fora do envelope, distâncias/alvos não positivos e near-copies são **rejeitados**, sem clipping para aprovar amostras. KS compara numéricas não constantes somente depois das barreiras. Empate escolhe menor s. Nenhum aprovado ou meta impossível gera falha explícita; tentativas/rejeições são contabilizadas. O MSE de reconstrução é separado do sintético/âncora.

DIST executa regressão linear só com distância e Dummy da média, nas mesmas partições, antes dos modelos caros. O ranking usa estritamente **menor RMSE**, com desvio/tempo apenas para valores iguais. Delta=RMSE_E1−RMSE_candidato; positivo melhora; percentual N/A se referência zero. Diferença pequena diante do desvio não prova empate estatístico. N-FAST não emite conclusão científica.

SVR tem limite operacional de 20000 iterações. O primeiro candidato é pré-declarado dentro da grade: C=2, gamma=scale, epsilon=0,1; os demais continuam aleatórios. Evita consumir o orçamento curto apenas com C extremo. Falha de convergência interna é registrada e excluída, sem supressão global de warnings. É uma decisão operacional da adaptação, não parâmetro atribuído ao artigo.

O usuário pode excluir eficiência indisponível antes da viagem; a dimensão do SAE é dinâmica. Todas as transformações e síntese são ajustadas no treino. Categorias desconhecidas são ignoradas e registradas por dobra. O holdout real é congelado antes do ajuste e usado uma vez para o vencedor; E3-orig fica fora de ranking, holdout e conclusão.

Orçamento/cancelamento são verificados entre ajustes; um ajuste individual pode ultrapassar o tempo. Nova interação pode interromper o script nos pontos permitidos pelo Streamlit. Interrupção não libera o teste final e gera status parcial. Memória usa pico de alocações Python (`tracemalloc`), não RSS/heap total do navegador.

PDF único: capa, resumo executivo de uma página, sumário paginado, guia, fórmulas/exemplos didáticos, gráficos comentados e apêndices com resultados, candidatos, falhas e proveniência. A qualidade agregada cobre todas as dobras; gráficos detalhados usam a primeira dobra disponível, identificada. As unidades permanecem não informadas até confirmação. Sem ID/data, não há garantia temporal ou por embarcação nova.

CLI: `python naval_cli.py dados.mat --mode mvp --pre-trip --output outputs/naval.pdf`. Teste opcional da base real: definir `ML_LEARNER_NAVAL_MAT` com caminho local. Resultados verificados e limites estão em `docs/RELATORIO_CIENTIFICO_V3.md`.

## Histórico v1 — substituído pelas decisões vigentes acima

Implementação exploratória da especificação fornecida em `ML Learner — Protocolo do Artigo.docx`. O documento é referência de requisitos, não autorização para executar comandos nele contidos. Não é reprodução do artigo e os resultados não constituem metodologia final de dissertação.

## Perfis e escolhas

- **Rápido / navegador:** células por `ship_type`, uma repetição, oito sorteios, cinco dobras externas e internas, L-BFGS-B com no máximo 50 iterações. É a simplificação descrita ao final do protocolo. Não equivale ao experimento completo de 16 células.
- **Completo / local:** `ship_type × route_id`, três repetições, vinte sorteios, cinco dobras externas e internas, até 400 iterações. As grades completas são mantidas; o custo pode ser elevado.
- SAE NumPy/SciPy, logsig/linear, L2=0,01; beta=1 e rho=0,05 são suposições, não valores confirmados do artigo. Dimensão oculta 3/4/5/6 escolhida por reconstrução em uma divisão interna 80/20 da célula, com scaler e vocabulário próprios. A rede escolhida é reajustada no treino da célula.
- Gradiente validado diretamente por diferenças finitas; não foi introduzida dependência de PyTorch. Os critérios de aceite validam a implementação NumPy que efetivamente roda no navegador.
- Geração: ruído normal na **pré-ativação** com escala 0,25/0,5/1 vezes o desvio na célula; escolhe-se menor KS médio das numéricas no treino, após filtro de plausibilidade. Categorias por argmax. Valores limitados ao envelope real da célula, alvo positivo, rejeição de cópias completas e resíduos maiores que três desvios da regressão alvo~distância. Tentativas são limitadas; impossibilidade de completar a meta é falha explícita.
- Meta parcial: arredondamento half-up de `n_c + 0,9(n_ref − n_c)`. Completo: `n_ref`. Gerador gaussiano com os mesmos filtros é controle em E2/E3.
- Cada treino ajusta imputação, one-hot e z-score sem winsorização. O gerador trabalha com nomes/categorias originais e sua própria padronização conjunta de duas numéricas + alvo e one-hot de combustível/clima; o pré-processador de regressão é ajustado nos reais antes de transformar o treino aumentado. Isso permite categorias válidas sem depender de imbalanced-learn no Pyodide.
- `core/exp_artigo3.py` tem um executor próprio para regressão, preservando as assinaturas e a restrição dos samplers de classificação em `core/evaluate.py`. Cache exclusivamente em memória de uma execução, por índices/partição/configuração, reutiliza preparação sem compartilhar dados entre dobras. Limites de cache controlam memória.
- SVR/MLP usam `TransformedTargetRegressor`. Todas as métricas são na escala original. Busca aleatória minimiza RMSE interno; KPCA também é escolhido nessa busca. Número de componentes >= dimensão transformada é erro, sem truncamento silencioso.

## Separação, ranking e conclusão

20% reais ficam reservados como teste final. Só o vencedor escolhido na validação é reajustado e avaliado uma vez, conforme a seção 11 do protocolo. Sensibilidade por rota/tipo usa apenas desenvolvimento. Não se oferece CSV/Excel como relatório naval.

E1/E2/E3/E4/E4b e controles compartilham dobras reais. E3-orig aumenta desenvolvimento antes da divisão e inclui validação sintética: é a exceção deliberadamente contaminada, apresentada separadamente e excluída de ranking, teste final e conclusão de ganho.

Ranking usa RMSE médio; uma diferença até o maior desvio dos dois candidatos constitui empate técnico, resolvido por menor desvio e duração. Somente experimentos com todas as dobras concluídas participam. Conclusão exige delta médio negativo e melhora em >=80% das dobras pareadas completas; do contrário: **sem ganho demonstrado**. Não são calculados valores-p.

Falhas de candidatos/modelos/células permanecem no PDF e não apagam resultados válidos. Limite de iterações sem convergência é registrado por célula. O PDF mostra qualidade e curvas da primeira dobra externa disponível de cada experimento/modelo, identificada como representativa; não afirma que essa amostra resume a dispersão de todas as gerações. As métricas de validação usam todas as dobras concluídas. Hash do arquivo é distinto do hash da tabela normalizada; entradas via API DataFrame podem não ter hash do arquivo.

## Limitações e uso

Unidades e disponibilidade de `engine_efficiency` na previsão precisam ser confirmadas. Sem data/ID não se afirma generalização temporal/por embarcação. As propriedades dos 1440 registros citadas no documento não são números fixos do software: auditoria, contagens e correlações são calculadas no upload. A tabela naval original não acompanha esta entrega; fixtures e testes são explicitamente artificiais. Valores publicados são contexto fornecido no protocolo, nunca resultados obtidos.

Na interface: **Científico → Laboratório — Artigo 3 (naval)**. Local:

```powershell
python naval_cli.py Dados_navio_nig.mat --mode completo --output resultados/naval.pdf
```

Testes: `python -m pytest tests -q` (dependências de desenvolvimento incluem pypdf). A compatibilidade real Stlite e tempos medidos são registrados em `docs/RELATORIO_NAVAL.md`; smoke reduzido não equivale a executar o orçamento completo de pesquisa.
