# Laboratório científico naval — entrega v3, 15/10/2026

Este relatório substitui os limites descritos nos relatórios anteriores quando explicitamente verificados aqui. Resultados anteriores continuam históricos; não representam o estado atual do upload.

## Uso pela página

1. Enviar o `.mat` no campo **Dados** da barra lateral.
2. Selecionar **Científico → Laboratório — Artigo 3 (naval)**.
3. Conferir alvo, exclusões, perfil e disponibilidade prévia de eficiência. A interface começa sem eficiência para previsão pré-viagem.
4. Executar e baixar **Relatório científico completo (PDF)**.

O dataset não precisa estar instalado no servidor. O código não grava uploads no repositório e os testes não distribuem a base. N-FAST é demonstrativo e distinto do MVP/completo local.

## Correções da revisão

| Requisito | Implementação |
|---|---|
| DIST e controle da média | regressão linear apenas por distância e Dummy nas mesmas partições; executados antes dos modelos caros |
| Previsão pré-viagem | eficiência pode ser excluída; entrada do SAE adapta sua dimensão |
| N-FAST | 3 dobras externas/internas, uma repetição, até 50 iterações, duas buscas por padrão; sem E3-orig/sensibilidade |
| Diagnóstico separado | E3-orig somente local por opção explícita, fora de ranking e holdout |
| Ganho e ranking | Delta=E1−candidato, positivo melhora; percentual sobre RMSE médio pareado de E1; menor RMSE sempre prevalece |
| Barreiras sintéticas | distâncias/alvos positivos, envelope sem clipping, categorias conjuntas observadas, near-copies, resíduo e descarte máximo |
| Seleção de ruído | todos os pilotos/KS/motivos registrados, só aprovados concorrem; constantes excluídas; empate usa menor s |
| Status e orçamento | limite cooperativo entre ajustes; cancelamento/estudo incompleto não libera o holdout; candidatos internos rejeitados distinguem-se de experimento incompleto |
| Memória | pico de alocações Python rastreadas, explicitamente diferente da memória total do navegador |
| PDF didático | capa, resumo de uma página, sumário paginado, guia, fórmulas, exemplos, gráficos comentados e apêndices auditáveis |
| Upload MATLAB | inspeção com fallback para MCOS, preservando o decodificador existente; struct colunar suportado separadamente |
| Atualização do navegador | carregador pede fontes Python com `cache: no-store`, evitando persistência de versões anteriores na abertura |

SVR usa limite operacional de 20000 iterações e candidato inicial pré-declarado C=2/gamma=scale/epsilon=0,1; candidatos restantes continuam aleatórios. Candidato sem convergência interna é excluído e explicado no relatório. Hipóteses, limites e decisões completas: [SUPOSICOES.md](../SUPOSICOES.md).

## Dados reais efetivamente verificados

Arquivo fornecido pelo usuário: `Dados_navio_nig.mat`, 24612 bytes, SHA-256:

`267ae82963bcf1ed227ceee26ffa67689a80bfee334d3d58da50000570493f03`.

Leitura com `load_table`: **1440 linhas × 8 colunas**, nomes exatos, sem ausências e duplicatas. Distância mínima 20,08, consumo mínimo 237,88, sem presumir unidade. Formato: **MATLAB MCOS**. A leitura passou em Python local e no Pyodide 0.29.2. O arquivo original não foi adicionado ao Git.

## Execuções verificadas

- **Smoke artificial local completo por cenários:** 98 linhas, oito cenários mais DIST linear/dummy; SVR/RF, externa/interna 2/2, um candidato, h=3, SAE até 50, sensibilidade. Todos concluíram sem falhas em **44,222 s**; PDF de **36 páginas** aberto com pypdf. Inspeção visual de páginas rasterizadas, incluindo resumo e curvas/tabelas. É teste de software com orçamento reduzido, não resultado naval.
- **Pyodide 0.29.2:** SAE artificial 60→70 linhas em **0,206–0,230 s**, seguido de executor N-FAST com DIST. Rastreamento Python do executor na ordem de 1,7 MB; não inclui heap total. Loader leu o MAT real como 1440×8. Nenhum torch/TensorFlow requerido.
- **Stlite/Edge, fixture artificial:** upload, N-FAST SVR/DIST e download efetivo de PDF em **16,0 s**, sem falhas parciais. Cabeçalho `%PDF` dos bytes recebidos foi verificado.
- **Stlite/Edge, MAT real:** upload MCOS, N-FAST com 3/3 dobras, uma repetição, h=3, SAE até 50, dois candidatos, SVR e DIST; transferência efetiva de PDF em **42,1 s** com eficiência habilitada. Alguns candidatos internos não convergiram e foram excluídos; os experimentos e o holdout concluíram. O status foi refinado para distinguir rejeição de candidato de falha de experimento.
- **Stlite/Edge, MAT real pré-viagem:** eficiência excluída; mesma validação N-FAST; PDF efetivamente recebido em **44,4 s**, sem falhas parciais. PDF de **53 páginas**, resumo executivo isolado na página 2 e hash do arquivo real conferidos. N-FAST não emite conclusão científica.
- **Branch preparada no repositório correto do portfólio:** a suíte foi repetida nessa cópia com **80 aprovados e um opcional ignorado**. O upload do MAT real, N-FAST pré-viagem SVR/DIST e download foram repetidos nessa própria cópia em **42,8 s**, sem falhas parciais. Os bytes recebidos foram abertos com pypdf e o nome/1440 registros/SHA-256 do arquivo real conferidos. Fontes novas e páginas restantes do portfólio não foram misturadas com a raiz de `ml-learner-v3`.
- **MVP local com MAT real:** E1/E3 com SVR/RF e DIST linear/dummy, **16 células**, externa 5 / interna 5, uma repetição, um candidato, h=3, SAE até 400 iterações. **460,3 s**, zero falhas, holdout real consultado uma vez e PDF de **97 páginas**. Não equivale ao completo 5×3 com vinte candidatos e todas as ablações. A análise com eficiência é retrospectiva até confirmação de disponibilidade prévia.

Os PDFs reais e artificiais são artefatos locais em `github-pages/outputs/`, ignorados. Os apêndices incluem configuração e índices; o corpo didático precede as tabelas volumosas. Unidades, proveniência física e generalização continuam limitadas; nenhum resultado é transferido automaticamente para frota real.

## Reprodução dos testes

```powershell
$env:ML_LEARNER_NAVAL_MAT = 'CAMINHO_LOCAL/Dados_navio_nig.mat'
python -m pytest github-pages/tests -q
```

O teste real é opcional quando a variável não está definida; não baixa nem redistribui o dataset. A suíte passou com **80 testes aprovados e um opcional ignorado** no ambiente local com o caminho fornecido. Inclui doze verificações centrais de gradiente, separando reconstrução/L2/KL e dimensões, erro relativo <1e-5; erro máximo observado na conferência anterior de aproximadamente 9,05e-10.

```powershell
python github-pages/naval_cli.py 'CAMINHO_LOCAL/Dados_navio_nig.mat' --mode mvp --draws 1 --hidden 3 --maxiter 400 --folds 5 --inner-folds 5 --repeats 1 --budget-seconds 600 --output github-pages/outputs/naval-real-mvp.pdf
```

Scripts Node aceitam caminhos locais dos pacotes, sem dependências Node novas no app:

- `tests/naval_pyodide.cjs <pyodide> --mat=CAMINHO_LOCAL`
- `tests/naval_browser.cjs <playwright-core> URL_BASE --run --mat=CAMINHO_LOCAL`

## Limites preservados

Não foi executada a grade científica completa 5×3, vinte candidatos e todos os cenários nos dados reais. Não foram inventados resultados de métodos não selecionados. Não há confirmação de unidades ou da disponibilidade prévia da eficiência; sem ID/data não há validação temporal/por embarcação. Consistência em 80% das dobras é descritiva, sem significância formal. O tempo observado em uma máquina/perfil não promete duração em outro dispositivo.

A publicação usa branch de trabalho `feature/ml-learner-laboratorio-cientifico-v3`. O repositório do portfólio é preparado separadamente, copiando somente fontes/testes/documentação do ML Learner; outras páginas são preservadas. Não há merge automático em main, force-push ou distribuição do MAT/PDF local.
