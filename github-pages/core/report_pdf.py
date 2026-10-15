"""Relatório PDF detalhado (reportlab puro: funciona no PC e no navegador/Pyodide)."""
import io
import sys
from datetime import datetime
from xml.sax.saxutils import escape

import numpy as np
import pandas as pd
from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.lineplots import ScatterPlot
from reportlab.graphics.shapes import Drawing, Line, String
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle)

INK, ACC, ACC2, SOFT = colors.HexColor("#1b1f3b"), colors.HexColor("#6c5ce7"), colors.HexColor("#00b8a9"), colors.HexColor("#f1f0ff")
SS = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=SS["Heading1"], fontName="Helvetica-Bold", fontSize=17, textColor=ACC, spaceBefore=6, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=SS["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=INK, spaceBefore=8, spaceAfter=4)
BODY = ParagraphStyle("B", parent=SS["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK)
SMALL = ParagraphStyle("S", parent=BODY, fontSize=8, leading=10.5, textColor=colors.HexColor("#555a7a"))
CELL = ParagraphStyle("C", parent=BODY, fontSize=8, leading=10)


def T(x):  # texto seguro para fontes padrão (Latin-1/cp1252) e para o parser XML do Paragraph
    return escape(str(x).encode("cp1252", "replace").decode("cp1252"))


def naval_pdf(result):
    """Relatório único do laboratório naval; não modifica o relatório legado."""
    import json
    from reportlab.platypus import SimpleDocTemplate
    buf = io.BytesIO()
    story = []
    def title(text):
        story.extend([Spacer(1, 8), P(text, H1)])
    def table(rows, columns=None):
        frame = pd.DataFrame(rows)
        if frame.empty:
            story.append(P("Sem resultados nesta execução; consulte falhas e limitações."))
            return
        if columns:
            frame = frame.reindex(columns=columns)
        for c in frame:
            frame[c] = frame[c].map(lambda v: _fmt(v, 5))
        story.append(_table(frame, [16.5*cm/len(frame.columns)]*len(frame.columns), font=6.5))
    def graph_xy(x, y, label):
        if not len(x):
            return
        drawing = Drawing(460, 180)
        plot = ScatterPlot()
        plot.x, plot.y, plot.width, plot.height = 55, 25, 380, 130
        plot.data = [list(zip(map(float, x), map(float, y)))]
        plot.lines[0].strokeColor = None
        plot.lines[0].symbol = makeMarker("FilledCircle", size=2.5, fillColor=ACC, strokeColor=None)
        plot.xValueAxis.labels.fontSize = plot.yValueAxis.labels.fontSize = 6
        plot.xLabel = plot.yLabel = ""
        plot.lineLabelFormat = None
        drawing.add(plot)
        drawing.add(String(5, 165, label, fontSize=9))
        story.append(drawing)
        story.append(P(f"O que mostra: {label}. {len(x)} observações desta execução. Como foi calculado: pares dos vetores registrados no treino/teste identificado no título. Em termos simples: compare tendência, dispersão e valores extremos; este gráfico isolado não demonstra ganho preditivo. Unidades não confirmadas e observações dependentes limitam interpretações físicas.", SMALL))
    cfg, prov = result["config"]["effective"], result["manifest"]
    from reportlab.platypus.tableofcontents import TableOfContents
    title("Laboratório Científico Naval - Artigo 3")
    story.append(P("protocolo do Artigo 3 adaptado a dados navais"))
    story.append(P(f"Arquivo: {cfg['filename']}; perfil: {result.get('profile', cfg['mode'])}; status: {result.get('status', 'concluído')}."))
    story.append(P(f"Execução: {prov['timestamp']}; commit: {prov['git_commit']}; idioma: português; ambiente: {prov['hardware']['platform']}."))
    story.append(P(f"SHA-256 da tabela: {result['dataset_sha256']}"))
    story.append(P(f"Unidades: {cfg['units']}. Estudo exploratório; não estabelece generalização para embarcações novas ou para o futuro."))
    story.append(PageBreak())
    title("Resumo executivo")
    story.append(P("Pergunta: o aumento sintético com SAE e a redução KPCA diminuem o erro de previsão do consumo em relação aos dados originais? Um resultado sem ganho demonstrado é válido."))
    story.append(P(f"Dados: {result['audit']['rows']} registros; arquivo {cfg['filename']}. Perfil {result.get('profile', cfg['mode'])}, {cfg['outer_folds']} dobras externas, {cfg['inner_folds']} internas, {cfg['repeats']} repetição(ões). {cfg['units']}."))
    story.append(P(f"Formulação: prever {cfg['target']}; eficiência {'habilitada (confirmar disponibilidade prévia; caso contrário retrospectiva)' if cfg.get('use_efficiency', True) else 'excluída: previsão pré-viagem'}. O teste final real foi separado antes dos ajustes."))
    if result['ranking']:
        best = result['ranking'][0]
        story.append(P(f"Menor RMSE de validação: {best['scenario']} / {best['model']}, RMSE={best['RMSE']:.5f}, desvio={best['RMSE_std']:.5f}, MAE={best['MAE']:.5f}, R²={best['R2']:.5f}. Estabilidade e tempo são mostrados, mas não substituem o menor RMSE."))
    else:
        story.append(P("Nenhum candidato com todas as dobras concluídas está elegível. Não há vencedor confirmado."))
    if result['test']:
        summary_metrics = '; '.join(f'{k}={v:.5f}' for k,v in result['test']['metrics'].items())
        story.append(P(f"Teste final do vencedor, consultado uma vez: {summary_metrics}. São observações reais reservadas, nunca sintéticas."))
    else:
        story.append(P("Teste final não avaliado nesta execução. Consulte interrupções e falhas."))
    summary_comparisons = sorted(result['comparisons'], key=lambda c: (c['scenario'] != 'E3', c['model'] != cfg['models'][0], c['scenario']))
    for comparison in summary_comparisons[:3]:
        relative = f"{comparison['delta_percent']:.4f}%" if comparison.get('delta_percent') is not None else 'N/A'
        story.append(P(f"{comparison['scenario']} / {comparison['model']}: E1 RMSE={comparison.get('baseline_rmse')}; ganho RMSE={comparison['delta_rmse']:.5f}; ganho relativo={relative}; melhora em {comparison.get('improved_pairs')}/{comparison.get('fold_pairs')} pares ({comparison['fraction_improved']:.0%}). {comparison['conclusion']}."))
    story.append(P("Conclusão: a regra de 80% é heurística descritiva pré-declarada, não teste de significância nem prova estatística. Dobras repetidas compartilham observações. E3-orig é diagnóstico contaminado e nunca determina o vencedor."))
    story.append(P("Limites decisivos: unidades e origem incompletas, ausência de ID/data, possível dominância da distância e coerência física apenas heurística. N-FAST é demonstrativo e não equivale ao completo. Próximo passo: confirmar metadados, examinar DIST e controles, depois executar a validação local completa."))
    story.append(PageBreak())
    title("Sumário")
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle("toc", parent=BODY, fontSize=9, leftIndent=6, firstLineIndent=-6, spaceBefore=4)]
    story.extend([toc, PageBreak()])
    title("Guia de leitura: em termos simples")
    story.append(P("RMSE e MAE medem erro na escala original do alvo; menor é melhor. RMSE dá mais peso a erros grandes. R² compara o modelo com prever uma média: não é porcentagem de acerto e pode ser negativo. Alvo constante exige cautela; um número produzido pela biblioteca não comprova qualidade."))
    story.append(P("SAE comprime e reconstrói registros; sintetizar exige perturbação e filtros adicionais. KPCA cria coordenadas de um kernel e pode ajudar ou prejudicar. CV alterna treino/validação; holdout é a amostra final reservada. Síntese não acrescenta observações independentes à validação. Adaptação usa outro problema e dados; não replica numericamente o estudo original."))
    title("Pré-processamento e exemplo de z-score")
    story.append(P("Detalhe matemático: z=(x-mu_treino)/sigma_treino. Exemplo didático, não é resultado do arquivo naval: x=120, mu=100, sigma=20 resulta z=1. A imputação aprende medianas/modas do treino; one-hot cria indicadores de categorias vistas nele; categorias novas são ignoradas na codificação, não aprendidas do teste. Escalas do alvo SVR/MLP são invertidas antes de calcular métricas."))
    title("SAE: arquitetura, perda e gradiente")
    story.append(P("Em termos simples: a camada oculta usa sigmoid, o decoder é linear; L2 limita pesos e KL incentiva ativação esparsa. Reconstrução boa não demonstra previsão boa. Neurônios, ruído, beta e rho são adaptações/suposições."))
    story.append(P("Detalhe matemático: H=sigmoid(XW1+b1); Xhat=HW2+b2. Jrec=sum((Xhat-X)^2)/(2m); JL2=lambda*(||W1||²+||W2||²)/2; JKL=beta*sum[rho*log(rho/rhohat)+(1-rho)*log((1-rho)/(1-rhohat))]. rhohat é a ativação média no treino. J=Jrec+JL2+JKL, sem divisão adicional pela dimensão d. D=(Xhat-X)/m; dW2=H.T D+lambda W2; dH=[D W2.T+beta*(-rho/rhohat+(1-rho)/(1-rhohat))/m]*H*(1-H); dW1=X.T dH+lambda W1. Vieses usam somas por observação."))
    story.append(P(f"lambda={cfg.get('alpha', .01)}, beta={cfg.get('beta', 1.)}, rho={cfg.get('rho', .05)}; L-BFGS-B, até {cfg['maxiter']} iterações. Iteração L-BFGS-B não é época SGD. KL usa clipping numérico para evitar log(0); gradientes são testados fora da saturação. Testes numéricos constam no repositório; este PDF não inventa erro de gradiente por execução."))
    title("Síntese, qualidade e seleção de ruído")
    story.append(P("A âncora é uma linha real do treino. Perturba-se a pré-ativação por N(0, s²*std(z)²), decodifica-se e rejeitam-se linhas inválidas, fora do envelope, próximas demais dos reais ou com resíduo alvo~distância maior que três desvios do treino. São filtros estatísticos, não prova de validade física."))
    story.append(P("Exemplo didático de contagem: célula com 60 linhas e referência de 100; parcial=60+round(0,9*(100-60))=96; completo=100. São 90% da lacuna, não do total. KS=sup_x|F_real(x)-F_sint(x)|. Exemplo didático: pilotos aprovados com s=0,25/0,5/1 e KS=0,20/0,15/0,18 escolheriam 0,5; empate escolhe menor s. Os valores reais e motivos de rejeição aparecem nos apêndices."))
    story.append(P("O KS considera marginais não constantes, não estrutura conjunta nem utilidade preditiva. As barreiras incluem distância normalizada mínima 1e-5 aos reais, ao menos min(5, quantidade pedida) pilotos aceitos e descarte máximo de 98%. Limiares operacionais pré-declarados; podem falhar. MSE de reconstrução é separado da distância sintético/âncora; Pearson indefinido é N/A. Controle gaussiano deve ser comparado antes de atribuir vantagem específica ao SAE."))
    title("KPCA, kernel e interpretação")
    story.append(P("Em termos simples: distâncias entre linhas se tornam similaridades RBF, a matriz é centralizada e projetada em autovetores. Diagrama didático: X permitido -> imputação/one-hot/z-score -> aumento só no treino -> kernel centralizado -> componentes -> regressor."))
    story.append(P("Detalhe matemático: K(x,z)=exp(-gamma*||x-z||²); Kc=K-1K-K1+1K1; Kc v=lambda v. Gamma controla a escala das similaridades. A exigência de componentes abaixo da dimensão original é regra do produto para chamar redução, não proibição matemática geral do KPCA. Autovalores descrevem o espaço do kernel; não representam porcentagem de variância física original."))
    title("Modelos, validação e orçamento")
    story.append(P("SVR procura uma função suave com faixa de tolerância; C regula penalização, gamma a influência local e epsilon a tolerância no alvo padronizado. RF combina árvores; folhas pequenas podem ajustar ruído. MLP aprende camadas; KNN compara vizinhos e depende da escala. DIST usa apenas distância em regressão linear e inclui Dummy da média. Todos usam as mesmas dobras reais; cada escolha de hiperparâmetro ocorre na CV interna."))
    title("Métricas: cálculo numérico didático")
    story.append(P("Exemplo didático, não é resultado do arquivo naval: reais=[100,120,80], previstos=[110,115,85]."))
    table([dict(real=100, previsto=110, erro=10, absoluto=10, quadrado=100), dict(real=120, previsto=115, erro=-5, absoluto=5, quadrado=25), dict(real=80, previsto=85, erro=5, absoluto=5, quadrado=25)])
    story.append(P("MAE=(10+5+5)/3=6,6667; MSE=(100+25+25)/3=50; RMSE=sqrt(50)=7,0711. Média real=100; SSE=150; SST=0²+20²+(-20)²=800; R²=1-150/800=0,8125. Métricas reais abaixo vêm de sklearn.metrics e dos vetores registrados."))
    story.append(P("Delta RMSE=RMSE_E1-RMSE_candidato: positivo indica melhora; Delta%=100*Delta/RMSE_E1 quando o denominador é positivo, caso contrário N/A. Menor RMSE define o ranking; diferenças pequenas diante do desvio não provam empate estatístico. Melhora em >=80% dos pares é consistência descritiva, sem valor-p."))
    title("Dominância da distância e interpretação dos gráficos")
    story.append(P(f"Correlações recalculadas: {result['audit'].get('correlations', {})}. Correlação não é acurácia; r=0,945 implicaria r²=0,893 em uma relação linear simples ilustrativa, não R² garantido do holdout. DIST é o controle de dominância. Consumo/distância é índice empírico apenas para distância positiva, sem presumir litros ou milhas."))
    story.append(P("Nos gráficos real×previsto, proximidade à linha y=x indica erros menores. Resíduos×previsto sondam viés e dispersão; histogramas mostram a distribuição dos erros. Erro por célula destaca heterogeneidade. Histogramas real×sintético avaliam marginais, não substituem validação externa. Leia sempre etapa, tamanho da amostra, unidade não informada e números da execução."))
    title("Métodos dos cinco artigos: alcance da adaptação")
    table([dict(artigo="1", uso="RF regressor; sem diagnóstico de falha sem rótulo"), dict(artigo="2", uso="RF e MLP na mesma validação"), dict(artigo="3", uso="SAE, KPCA, SVR/RF adaptados"), dict(artigo="4", uso="MLP/RF/SVR; CNN não aplicável à tabela"), dict(artigo="5", uso="KNN regressor; SMOTE/ADASYN não aplicados ao alvo contínuo")])
    story.append(P("As origens/tarefas são diferentes. Métodos extras só têm resultado quando selecionados e executados; os demais permanecem não executados. Não foram inventados resultados dos artigos 1/2/4/5."))
    story.append(PageBreak())
    title("Apêndices técnicos e resultados desta execução")
    title("ML Learner - Laboratório naval exploratório")
    story.append(P("protocolo do Artigo 3 adaptado"))
    story.append(P(f"Arquivo: {cfg['filename']} | Data: {prov['timestamp']} | App: naval-v3"))
    story.append(P(f"SHA-256 da tabela normalizada: {result['dataset_sha256']}"))
    story.append(P(f"SHA-256 do arquivo: {result.get('source_sha256') or 'não disponível (entrada DataFrame)'}"))
    title("Resumo e formulação")
    story.append(P(f"Prever {cfg['target']} em combinações conhecidas. Features: {', '.join(result['config']['features'])}. Exclusões: {cfg['excluded']}."))
    story.append(P("A tarefa original era classificação de vibrações; aqui é regressão tabular, com RMSE principal, MAE e R² na escala original. Sem filtros de sinais ou segmentação."))
    story.append(P(f"Modo: {cfg['mode']}; células: {cfg['cell_columns']}; unidades: {cfg['units']}."))
    title("Dados e auditoria de vazamento")
    table(result["audit"]["dictionary"])
    table([dict(cell=k, count=v) for k, v in result["audit"]["cells"].items()])
    for key in ("rows", "missing", "duplicates", "co2_fuel_ratio", "co2_fuel_correlation", "correlations"):
        if key in result["audit"]:
            story.append(P(f"{key}: {result['audit'][key]}"))
    title("Protocolo e partições")
    story.append(P("Teste final real: 20%, estratificado por célula. CV externa estratificada, com CV interna e aumento refeito apenas no treino de cada dobra. Pré-processador e vocabulário ajustados somente no treino. E3-orig é a exceção deliberadamente contaminada, apresentada separadamente."))
    story.append(P(f"Semente: {cfg['seed']}; repetições: {cfg['repeats']}; dobras externas/internas: {cfg['outer_folds']}/{cfg['inner_folds']}; sorteios: {cfg['draws']}; teste avaliado {result['config']['final_test_evaluations']} vez(es); sintéticos no teste: 0."))
    story.append(P("Asserções de separação: " + str(all(set(d['train_indices']).isdisjoint(d['validation_indices']) for d in result['folds'])) + "; diagnóstico E3-orig mantém dependências de origem apesar de índices disjuntos. Testes de software são registrados no repositório, não inferidos deste relatório."))
    title("Sparse Autoencoder e qualidade sintética")
    story.append(P("Sigmoide/linear; perda = soma do erro quadrático / (2m) + L2 + beta KL. L2=0,01, beta=1, rho=0,05. Beta e rho são suposições do projeto. L-BFGS-B; neurônios escolhidos por reconstrução em validação interna da célula. Ruído na pré-ativação; s escolhido pelo menor KS médio somente no treino. Categorias por argmax, envelope observado, consumo positivo, filtro do resíduo consumo~distância em 3 desvios. Ruído gaussiano é controle independente."))
    story.append(P("Curvas e histogramas abaixo: primeira dobra externa disponível por experimento/modelo, identificada como exemplo representativo do treino. O resumo por dobra inclui todas as gerações executadas."))
    quality_summary = []
    for fold in result["folds"]:
        generated = [d for d in fold["augmentation"] if d.get("synthetic")]
        if generated:
            quality_summary.append(dict(scenario=fold["scenario"], model=fold["model"], fold=fold["fold"],
                synthetic=sum(d["synthetic"] for d in generated),
                KS=float(np.mean([np.mean(d["quality"]["ks"]) for d in generated])),
                rejected=float(np.mean([d["rejected_fraction"] for d in generated])),
                memory=float(np.mean([d["quality"]["memory_fraction"] for d in generated]))))
    table(quality_summary)
    # Record a representative external training fold for each experiment/model;
    # all fold scores remain in the validation tables below.
    seen = set()
    for fold in result["folds"]:
        key = (fold["scenario"], fold["model"])
        if key in seen or not fold["augmentation"]:
            continue
        seen.add(key)
        story.append(P(f"{key[0]} / {key[1]} - dobra {fold['fold']} (treino)"))
        quality_rows = []
        for d in fold["augmentation"]:
            if not d.get("synthetic"):
                continue
            q = d["quality"]
            table(d.get("noise_candidates", []))
            story.append(P(f"Arquitetura: m={d['real']}, d={d.get('input_dim')}, h={d['hidden_dim']}; iterações={d.get('iterations')}, duração={d.get('seconds')} s; parada={d.get('optimizer_message')}. Barreiras: {d.get('barriers')}; tentativas={d.get('attempts')}, rejeitadas={d.get('rejected')}, aceitas={d.get('accepted')}. MSE reconstrução={d.get('reconstruction_mse')}; validação interna da reconstrução={d.get('reconstruction_validation_mse')}; frequências categóricas={d.get('categorical_frequencies')}. Pearson indefinido é N/A.", SMALL))
            quality_rows.append(dict(cell=d["cell"], real=d["real"], synthetic=d["synthetic"],
                hidden=d["hidden_dim"], noise=d["noise_scale"], rejected=d["rejected_fraction"],
                KS=float(np.mean(q["ks"])), memory=q["memory_fraction"], corr=q["correlation_frobenius"]))
            story.append(P(f"{d['cell']}: MSE por coluna={q['mse']}; Pearson={q['pearson']}; KS={q['ks']}; vizinho médio={q['nearest_distance_mean']}; colunas={d['numeric_columns']}; convergiu={d['optimizer_success']}."))
            history = d.get("history", [])
            if history:
                graph_xy(range(len(history)), [v["total"] for v in history], "Perda total SAE por iteração - " + str(d["cell"])[:60])
                table([dict(iteration=i, **v) for i, v in enumerate(history) if i in {0, len(history)-1}])
            real, synth = np.array(d["real_numeric"]), np.array(d["synthetic_numeric"])
            # Comparative histograms are vector charts, independent of matplotlib.
            for col, label in enumerate(d["numeric_columns"]):
                edges = np.linspace(min(real[:, col].min(), synth[:, col].min()), max(real[:, col].max(), synth[:, col].max())+1e-9, 9)
                a = np.histogram(real[:, col], edges)[0]/len(real)
                b = np.histogram(synth[:, col], edges)[0]/len(synth)
                drawing = Drawing(460, 130)
                chart = VerticalBarChart()
                chart.x, chart.y, chart.width, chart.height = 35, 20, 400, 85
                chart.data = [a.tolist(), b.tolist()]
                chart.bars[0].fillColor, chart.bars[1].fillColor = ACC, ACC2
                chart.categoryAxis.categoryNames = [f"{v:.2g}" for v in edges[:-1]]
                chart.categoryAxis.labels.fontSize = 5
                drawing.add(chart)
                drawing.add(String(5, 117, f"{label}: real (roxo) x sintético (verde)", fontSize=8))
                story.append(drawing)
                story.append(P(f"O que mostra: distribuição marginal de {label} no treino da célula. Alturas são proporções em oito intervalos comuns; roxo real, verde sintético. Nesta execução: médias real={real[:, col].mean():.5f}, sintética={synth[:, col].mean():.5f}; KS={q['ks'][col]:.5f}. Similaridade marginal não demonstra utilidade, independência ou coerência física. {cfg['units']}.", SMALL))
        table(quality_rows)
    title("KPCA gaussiano")
    story.append(P("Componentes são coordenadas do kernel, não variáveis físicas. Ajuste somente após aumento do treino. A regra de produto exige reduzir dimensão; KPCA em geral não impõe esse limite matemático."))
    for fold in result["folds"]:
        if fold["eigenvalues"]:
            story.append(P(f"{fold['scenario']} / {fold['model']}, dobra {fold['fold']}: parâmetros={fold['params']}; autovalores={fold['eigenvalues']}"))
    title("Resultados de validação")
    table(result.get('outcomes', []))
    table([r for r in result["validation"] if r["scenario"] != "E3-orig"],
          ["scenario", "model", "RMSE", "RMSE_std", "MAE", "MAE_std", "R2", "R2_std", "complete"])
    story.append(P("Métricas e hiperparâmetros por dobra externa (E3-orig identificado separadamente):"))
    table([dict(scenario=d["scenario"], model=d["model"], fold=d["fold"],
        RMSE=d["metrics"]["RMSE"], MAE=d["metrics"]["MAE"], R2=d["metrics"]["R2"],
        inner_RMSE=d["inner_rmse"], params=str(d["params"])) for d in result["folds"]])
    for fold in result['folds']:
        if fold.get('unknown_categories'):
            story.append(P(f"Categorias não vistas no treino de {fold['scenario']} / {fold['model']}, dobra {fold['fold']}: {fold['unknown_categories']}. One-hot ignora essas categorias, sem aprender com a validação."))
    title("Ranking exploratório por menor RMSE")
    story.append(P("Menor RMSE médio; desvio e duração desempatarão apenas RMSE igual. Diferenças pequenas em relação à dispersão não demonstram empate estatístico. E3-orig não participa."))
    table(result["ranking"], ["scenario", "model", "RMSE", "RMSE_std", "seconds", "small_difference"])
    title("E3 e E3-orig: diagnóstico possivelmente otimista")
    table([r for r in result["validation"] if r["scenario"] in ("E3", "E3-orig")], ["scenario", "model", "RMSE", "RMSE_std", "MAE", "R2"])
    title("Diferenças pareadas contra E1")
    table(result["comparisons"], ["scenario", "model", "delta_rmse", "delta_percent", "std", "fraction_improved", "conclusion"])
    title("Teste final do vencedor da validação")
    if result["test"]:
        test = result["test"]
        story.append(P(f"{test['scenario']} / {test['model']}: {test['metrics']}; parâmetros={test['params']}"))
        pred = result["predictions"]
        actual, predicted = np.array(pred["actual"]), np.array(pred["predicted"])
        residual = actual-predicted
        story.extend([_scatter(actual, predicted), _hist(residual)])
        story.append(P(f"Teste final: {len(actual)} observações; MAE={np.mean(np.abs(residual)):.5f}, RMSE={np.sqrt(np.mean(residual**2)):.5f}, resíduo médio={residual.mean():.5f}. A linha y=x é referência de previsão perfeita. O histograma agrupa real-previsto; viés médio próximo de zero não garante ausência de padrões ou generalização. {cfg['units']}.", SMALL))
        graph_xy(predicted, residual, "Resíduos (y) x previsto (x)")
        if pred.get('distance'):
            distance = np.asarray(pred['distance'])
            graph_xy(distance, np.abs(residual), "Erro absoluto (y) x distância (x), teste final")
            valid = distance > 0
            graph_xy(distance[valid], actual[valid]/distance[valid], "Consumo por unidade de distância (y) x distância (x), teste final")
            story.append(P("O índice consumo/distância é empírico, calculado somente para distâncias positivas, sem presumir litros, toneladas ou milhas náuticas. Uma tendência não comprova eficiência física.", SMALL))
        errors = pd.DataFrame(dict(cell=pred["cells"], absolute=np.abs(residual), squared=residual**2))
        table([dict(cell=c, MAE=float(g.absolute.mean()), RMSE=float(np.sqrt(g.squared.mean()))) for c, g in errors.groupby("cell")])
    else:
        story.append(P("Teste não avaliado: nenhum vencedor completo ou ajuste falhou."))
    title("Sensibilidade: rota e tipo de navio deixados de fora")
    table(result["sensitivity"])
    title("Publicado x adaptado: métricas não comparáveis")
    story.append(P("Contexto fornecido pelo protocolo: DOI 10.1007/s10921-024-01131-3. Acurácia publicada em classificação não se compara a RMSE naval."))
    table([dict(experiment=e, SVM_accuracy_percent=s, RF_accuracy_percent=r) for e, s, r in [("E1",90.83,95.),("E2",98.03,99.83),("E3",98.72,99.94),("E4",98.72,96.06)]])
    title("Discussão e conclusão")
    gains = [r for r in result["comparisons"] if cfg['mode'] != 'rapido' and r["complete"] and r["fraction_improved"] >= .8 and r["delta_rmse"] > 0]
    story.append(P("Melhora consistente em pelo menos 80% das dobras: " + str([(r['scenario'], r['model']) for r in gains]) if gains else "Sem ganho demonstrado pela regra de 80% das dobras."))
    story.append(P("N-FAST: demonstração técnica, sem conclusão científica." if cfg['mode'] == 'rapido' else "Consistência é heurística descritiva, não significância estatística."))
    title("Limitações e falhas")
    for limitation in result["limitations"]:
        story.append(P(limitation))
    table(result["failures"], ["scenario", "model", "stage", "fold", "error"])
    title("Proveniência e configuração completa")
    story.append(P(f"Perfil/status: {result.get('profile')}/{result.get('status')}; memória: {result.get('memory')}. Não interpretar memória Python como pico total do navegador."))
    story.append(P(f"Duração: {result['seconds']:.3f} s; Python: {prov['python']}; versões: {prov['versions']}; commit: {prov['git_commit']}; hash código: {prov['core_source_hash']}"))
    for line in json.dumps(result["config"], ensure_ascii=False, indent=2, default=str).splitlines():
        story.append(P(line, SMALL))
    class LabDocument(SimpleDocTemplate):
        def afterFlowable(self, flowable):
            if isinstance(flowable, Paragraph) and flowable.style.name == H1.name:
                self.notify('TOCEntry', (0, flowable.getPlainText(), self.page))
    LabDocument(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                topMargin=1.8*cm, bottomMargin=1.8*cm).multiBuild(story, onFirstPage=_page, onLaterPages=_page)
    return buf.getvalue()


def P(x, st=BODY):
    return Paragraph(T(x), st)


def _table(df, col_w=None, zebra=True, font=7.5):
    data = [[Paragraph(f"<b>{T(c)}</b>", ParagraphStyle("th", parent=CELL, textColor=colors.white, fontSize=font)) for c in df.columns]]
    for row in df.itertuples(index=False):
        data.append([Paragraph(T(v), ParagraphStyle("td", parent=CELL, fontSize=font)) for v in row])
    t = Table(data, colWidths=col_w, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), ACC), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#d9d7f5")),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if zebra:
        st += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT])]
    t.setStyle(TableStyle(st))
    return t


def _fmt(v, nd=4):
    return f"{v:.{nd}f}" if isinstance(v, (float, np.floating)) else str(v)


def _bar_h(labels, values, title, w=15.5 * cm, color=ACC, h=None):
    h = h or max(4.5 * cm, 0.62 * cm * len(labels) + 1.6 * cm)
    d = Drawing(w, h)
    ch = HorizontalBarChart()
    ch.x, ch.y, ch.width, ch.height = 4.6 * cm, 0.6 * cm, w - 5.4 * cm, h - 1.5 * cm
    ch.data = [list(values)[::-1]]
    ch.categoryAxis.categoryNames = [str(l)[:28] for l in list(labels)[::-1]]
    ch.categoryAxis.labels.fontSize = 7
    ch.valueAxis.labels.fontSize = 7
    lo, hi = min(0, min(values)), max(values)
    ch.valueAxis.valueMin, ch.valueAxis.valueMax = lo, hi * 1.08 if hi > 0 else 1
    ch.bars[0].fillColor = color
    ch.bars.strokeColor = None
    ch.barLabelFormat = "%.3f"
    ch.barLabels.fontSize = 6.5
    ch.barLabels.nudge = 14
    d.add(ch)
    d.add(String(0, h - 9, title, fontSize=9, fontName="Helvetica-Bold", fillColor=INK))
    return d


def _scatter(y, p, w=8.4 * cm, h=7.2 * cm):
    n = len(y)
    idx = np.random.RandomState(0).choice(n, min(n, 600), replace=False)
    y, p = np.asarray(y)[idx], np.asarray(p)[idx]
    lo, hi = float(min(y.min(), p.min())), float(max(y.max(), p.max()))
    d = Drawing(w, h)
    sp = ScatterPlot()
    sp.x, sp.y, sp.width, sp.height = 1.3 * cm, 1.0 * cm, w - 1.8 * cm, h - 1.9 * cm
    sp.data = [list(zip(map(float, y), map(float, p))), [(lo, lo), (hi, hi)]]
    sp.xValueAxis.valueMin = sp.yValueAxis.valueMin = lo
    sp.xValueAxis.valueMax = sp.yValueAxis.valueMax = hi
    sp.xValueAxis.labels.fontSize = sp.yValueAxis.labels.fontSize = 6.5
    sp.lineLabelFormat = None
    sp.xValueAxis.labelTextFormat = sp.yValueAxis.labelTextFormat = "%.2f"
    sp.xLabel = sp.yLabel = ""
    sp.lines[0].strokeColor = None
    sp.lines[0].symbol = makeMarker("FilledCircle", size=2.6, fillColor=ACC, strokeColor=None)
    sp.lines[1].strokeColor, sp.lines[1].strokeWidth, sp.lines[1].strokeDashArray = ACC2, 1, [3, 2]
    sp.lines[1].symbol = None
    d.add(sp)
    d.add(String(0, h - 9, "Real x Previsto (teste)", fontSize=9, fontName="Helvetica-Bold", fillColor=INK))
    d.add(String(w / 2 - 28, 0.15 * cm, "real (eixo x) x previsto (eixo y)", fontSize=6.5, fillColor=INK))
    return d


def _hist(res, w=7.6 * cm, h=7.2 * cm, bins=12):
    cnt, edges = np.histogram(res, bins=bins)
    d = Drawing(w, h)
    ch = VerticalBarChart()
    ch.x, ch.y, ch.width, ch.height = 1.1 * cm, 1.0 * cm, w - 1.5 * cm, h - 1.9 * cm
    ch.data = [list(map(int, cnt))]
    ch.categoryAxis.categoryNames = [f"{e:.2g}" for e in edges[:-1]]
    ch.categoryAxis.labels.fontSize = 5.5
    ch.categoryAxis.labels.angle = 45
    ch.categoryAxis.labels.dy = -6
    ch.valueAxis.labels.fontSize = 6.5
    ch.bars[0].fillColor = ACC2
    ch.bars.strokeColor = None
    ch.groupSpacing = 1
    d.add(ch)
    d.add(String(0, h - 9, "Distribuicao dos residuos (teste)", fontSize=9, fontName="Helvetica-Bold", fillColor=INK))
    return d


def _confusion(cm_, labels):
    labels = [str(l)[:10] for l in labels]
    data = [["real \\ prev."] + labels] + [[labels[i]] + [int(v) for v in row] for i, row in enumerate(cm_)]
    mx = max(cm_.max(), 1)
    k = len(labels)
    cw = min(1.3 * cm, 15.5 * cm / (k + 1))
    t = Table(data, colWidths=[cw * 1.4] + [cw] * k, rowHeights=cw * 0.7)
    st = [("FONTSIZE", (0, 0), (-1, -1), 6.5), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("BACKGROUND", (0, 0), (-1, 0), SOFT), ("BACKGROUND", (0, 0), (0, -1), SOFT), ("GRID", (0, 0), (-1, -1), 0.25, colors.white)]
    for i in range(k):
        for j in range(k):
            a = cm_[i, j] / mx
            base = ACC2 if i == j else colors.HexColor("#ff7675")
            c = colors.Color(1 - (1 - base.red) * a, 1 - (1 - base.green) * a, 1 - (1 - base.blue) * a)
            st.append(("BACKGROUND", (j + 1, i + 1), (j + 1, i + 1), c))
    t.setStyle(TableStyle(st))
    return t


def _page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(ACC); canvas.rect(0, A4[1] - 0.5 * cm, A4[0], 0.5 * cm, stroke=0, fill=1)
    canvas.setFillColor(ACC2); canvas.rect(A4[0] * 0.72, A4[1] - 0.5 * cm, A4[0] * 0.28, 0.5 * cm, stroke=0, fill=1)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(colors.HexColor("#555a7a"))
    canvas.drawString(2 * cm, 1.1 * cm, "AutoML Academico - Relatorio automatico")
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def _insights(r):
    task, tm, board = r["task"], r["test_metrics"], r["leaderboard"]
    key = "R2" if task == "regression" else "F1 (macro)"
    out = []
    cv = float(board.loc[board["Modelo"] == r["best"], key].iloc[0])
    te = tm[key]
    out.append(f"O melhor modelo foi <b>{T(r['best'])}</b>, com {key} de {te:.3f} no teste (validacao cruzada: {cv:.3f}).")
    gap = cv - te
    out.append("A diferenca entre validacao cruzada e teste e pequena neste experimento; validade externa exige dados independentes."
               if abs(gap) < 0.05 else f"Atencao: diferenca de {gap:+.3f} entre validacao cruzada e teste; com poucos dados isso e comum, interprete com cautela.")
    if len(board) > 1:
        d = float(board[key].iloc[0] - board[key].iloc[1])
        out.append("O 1o e o 2o colocados estao praticamente empatados (diferenca %.3f); considere o mais simples/rapido." % d if d < 0.01
                   else f"O 1o colocado supera o 2o por {d:.3f} em {key}.")
    if task == "classification" and r["profile"].get("imbalance", 1) < 0.5:
        out.append("As classes sao desbalanceadas; por isso a metrica principal e o F1 macro e foram usados pesos de classe.")
    if r["profile"].get("n", r["n_train"]) < 300:
        out.append("A base e pequena (menos de 300 linhas): os resultados tem alta variabilidade.")
    return out


def build_pdf(r, filename="dados", importance=True) -> bytes:
    from sklearn.inspection import permutation_importance
    from sklearn.metrics import classification_report, confusion_matrix
    task, tm, board, df = r["task"], r["test_metrics"], r["leaderboard"], r["data"]
    key = "R2" if task == "regression" else "F1 (macro)"
    buf = io.BytesIO()
    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                          title="Relatorio AutoML", author="AutoML Academico")
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(2 * cm, 1.8 * cm, A4[0] - 4 * cm, A4[1] - 3.6 * cm, id="f")], onPage=_page)])
    S = []
    # ---- capa
    S += [Spacer(1, 3.2 * cm), Paragraph("Relatorio de Modelagem Automatica",
          ParagraphStyle("t", parent=H1, fontSize=28, leading=33, textColor=INK)),
          Paragraph("Regressao e Classificacao com validacao rigorosa", ParagraphStyle("st", parent=BODY, fontSize=13, textColor=ACC)),
          Spacer(1, 1.2 * cm)]
    cover = [["Arquivo", filename], ["Problema", "Regressao" if task == "regression" else "Classificacao"], ["Variavel alvo", r["target"]],
             ["Linhas x colunas", f"{len(df)} x {df.shape[1] - 1} caracteristicas"], ["Gerado em", datetime.now().strftime("%d/%m/%Y %H:%M")],
             ["Tempo de execucao", f"{r['seconds']} s"], ["Semente aleatoria", str(r["seed"])]]
    ct = Table([[P(a, SMALL), P(b)] for a, b in cover], colWidths=[4 * cm, 11 * cm])
    ct.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9d7f5")), ("TOPPADDING", (0, 0), (-1, -1), 6)]))
    S += [ct, Spacer(1, 1.2 * cm), P("Melhor modelo", SMALL), Paragraph(T(r["best"]), ParagraphStyle("bm", parent=H1, fontSize=22, textColor=ACC2))]
    kp = [[P(k, SMALL) for k in tm], [Paragraph(f"<b>{v:.4f}</b>", ParagraphStyle("kv", parent=BODY, fontSize=14, textColor=ACC)) for v in tm.values()]]
    kt = Table(kp, colWidths=[15.5 * cm / len(tm)] * len(tm)); kt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SOFT), ("TOPPADDING", (0, 0), (-1, -1), 8)]))
    S += [kt, PageBreak()]
    # ---- resumo
    S += [P("1. Resumo executivo", H1)] + [P("- " + i.replace("<b>", "").replace("</b>", ""), BODY) for i in _insights(r)]
    # ---- dados
    S += [P("2. Dados", H1), P(f"Foram usadas {len(r['features'])} caracteristicas e {len(df)} linhas validas. "
          f"Treino: {r['n_train']} linhas. Teste (nunca visto durante a escolha do modelo): {r['n_test']} linhas.")]
    S += [P("Decisoes automaticas sobre as colunas", H2)] + [P("- " + x, SMALL) for x in r["log"]]
    num = df.select_dtypes("number")
    if num.shape[1]:
        ds = num.describe().T[["mean", "std", "min", "50%", "max"]].round(3)
        ds.insert(0, "coluna", ds.index); ds["ausentes"] = df[ds.index].isna().sum().values
        ds = ds.head(25)
        S += [P("Estatisticas descritivas" + (" (25 primeiras colunas numericas)" if num.shape[1] > 25 else ""), H2),
              _table(ds.rename(columns={"mean": "media", "std": "desvio", "50%": "mediana"}), [4.2 * cm] + [1.9 * cm] * 6)]
    # ---- metodologia
    protocol = r.get("manifest", {}).get("config", {})
    split_strategy = (r.get("task_config") or {}).get("split_strategy", "random")
    cv_description = f"{protocol['folds']} folds" if "folds" in protocol else "validacao cruzada de 5 folds (repeticoes conforme orcamento)"
    S += [P("3. Metodologia e auto-ajustes", H1),
          P(f"Treino: {r['n_train']} linhas. Teste: {r['n_test']} linhas. Divisao: {split_strategy}. "
            f"Comparacao por {cv_description} apenas no treino externo. "
            "Imputacao, limitacao de outliers, escala, aumento e reducao, quando configurados, "
            "sao ajustados dentro de cada particao de treino. O vencedor e avaliado uma vez no teste externo."),
          P("Ajustes feitos automaticamente pelo sistema", H2)] + [P("- " + x, SMALL) for x in r["adjustments"]]
    if protocol:
        S += [P("Protocolo", H2), P(protocol.get("methodology", "Configuracao registrada no manifesto."))]
    # ---- ranking
    metr = [c for c in board.columns if c not in ("Modelo", "tempo (s)") and "(+-)" not in c and "(±)" not in c]
    show = board[["Modelo"] + metr + ["tempo (s)"]].copy()
    for c in metr:
        std = f"{c} (±)"
        show[c] = [f"{a:.4f} +- {b:.4f}" for a, b in zip(board[c], board[std])] if std in board else show[c].round(4)
    S += [KeepTogether([P("4. Comparacao dos algoritmos", H1), _bar_h(board["Modelo"], board[key], f"{key} medio na validacao cruzada")]),
          Spacer(1, 6), _table(show.round(4), [3.6 * cm] + [(15.5 - 3.6 - 1.6) * cm / max(len(metr), 1)] * len(metr) + [1.6 * cm])]
    # ---- melhor modelo
    S += [P(f"5. Melhor modelo: {r['best']}", H1),
          P("Hiperparametros escolhidos: " + (", ".join(f"{k.replace('model__', '')} = {v}" for k, v in r["best_params"].items()) or "padrao do algoritmo")),
          Spacer(1, 4)]
    yt, yp = np.asarray(r["y_true"]), np.asarray(r["y_pred"])
    if task == "regression":
        res = yt - yp
        pair = Table([[_scatter(yt, yp), _hist(res)]], colWidths=[8.4 * cm, 7.6 * cm])
        S += [pair, Spacer(1, 4), P(f"Residuos: media {res.mean():.4g}, desvio {res.std():.4g}, maior erro absoluto {np.abs(res).max():.4g}. "
              "Pontos proximos da linha tracejada indicam boas previsoes; residuos centrados em zero indicam ausencia de vies.", SMALL)]
    else:
        labels = sorted(pd.unique(yt))
        S += [KeepTogether([P("Matriz de confusao (teste)", H2), _confusion(confusion_matrix(yt, yp, labels=labels), labels)]), Spacer(1, 8)]
        rep = pd.DataFrame(classification_report(yt, yp, labels=labels, output_dict=True, zero_division=0)).T
        rep = rep.loc[[str(l) for l in labels] + ["macro avg"]].round(3)
        rep.insert(0, "classe", rep.index); rep["support"] = rep["support"].astype(int)
        S += [P("Desempenho por classe", H2), _table(rep.rename(columns={"precision": "precisao"}), [3 * cm] + [2.4 * cm] * 4)]
    # ---- importancia
    if importance:
        try:
            Xte = r["X_test"]
            if len(Xte) > 500:  # subamostra: importancia por permutacao e cara
                _ix = np.random.RandomState(0).choice(len(Xte), 500, replace=False)
                Xte, yt = Xte.iloc[_ix], yt[_ix]
            pi = permutation_importance(r["model"], Xte, yt, n_repeats=2 if Xte.shape[1] > 50 else 4, random_state=0, n_jobs=1,
                                        scoring="r2" if task == "regression" else "f1_macro")
            imp = pd.Series(pi.importances_mean, index=Xte.columns).sort_values(ascending=False).head(15)
            S += [KeepTogether([P("6. Importancia das caracteristicas", H1),
                  P("Queda do desempenho no teste quando os valores de cada coluna sao embaralhados (importancia por permutacao). "
                    "Quanto maior, mais o modelo depende da coluna.", SMALL), _bar_h(imp.index, imp.values, "Top 15 caracteristicas", color=ACC2)])]
        except Exception as e:
            S += [P(f"Importancia por permutacao indisponivel ({e}).", SMALL)]
    # ---- conclusoes
    S += [P("7. Conclusoes e limitacoes", H1)] + [P("- " + i.replace("<b>", "").replace("</b>", "")) for i in _insights(r)]
    S += [P("- O resultado vale para a distribuicao dos dados fornecidos; novos dados com outro comportamento exigem reavaliacao."),
          P("- Correlacao nao implica causalidade: a importancia das colunas descreve o modelo, nao o fenomeno fisico."),
          P("- Os resultados podem diferir de outras ferramentas (ex.: MATLAB) por inicializacao e hiperparametros padrao distintos.")]
    # ---- apendice
    import sklearn
    recipe = r.get("config")
    preprocessing_description = (f"{recipe['scaler']}, outliers {'limitados (IQR)' if recipe['winsor'] else 'mantidos'}"
                                 + (", PCA 95%" if recipe.get("pca") else "")) if recipe else "consulte os cenarios no manifesto"
    S += [P("Apendice: reprodutibilidade e glossario", H1),
          P(f"Python {sys.version.split()[0]}, scikit-learn {sklearn.__version__}, pandas {pd.__version__}, numpy {np.__version__}. "
            f"Semente {r['seed']}. Pre-processamento: {preprocessing_description}.", SMALL),
          P("Metricas: <b>R2</b> = fracao da variancia explicada (1 e perfeito). <b>RMSE</b> = erro quadratico medio, na unidade do alvo. "
            "<b>MAE</b> = erro absoluto medio. <b>Acuracia</b> = acertos totais. <b>Precisao</b> = dos previstos como classe X, quantos eram X. "
            "<b>Recall</b> = das amostras X, quantas foram achadas. <b>F1</b> = media harmonica de precisao e recall; <b>macro</b> = media simples entre classes.".replace("<b>", "").replace("</b>", ""), SMALL)]
    doc.build(S)
    return buf.getvalue()


def _minimal_pdf(r, filename="dados", motivo="") -> bytes:
    """Último recurso: PDF simples (só texto) para o usuário nunca ficar sem relatório."""
    buf = io.BytesIO()
    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=1.8 * cm)
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(2 * cm, 1.8 * cm, A4[0] - 4 * cm, A4[1] - 3.6 * cm, id="f")], onPage=_page)])
    S = [P("Relatorio de Modelagem Automatica (versao simplificada)", H1), P(f"Arquivo: {filename}"),
         P(f"Alvo: {r['target']} | Tipo: {r['task']} | Melhor modelo: {r['best']}")]
    S += [P(f"{k}: {v:.4f}") for k, v in r["test_metrics"].items()]
    S += [P("Ranking", H2), _table(r["leaderboard"].round(4))]
    S += [P("Decisoes automaticas", H2)] + [P("- " + x, SMALL) for x in r["log"] + r["adjustments"]]
    if motivo:
        S += [P(f"Observacao: o relatorio completo falhou ({motivo}).", SMALL)]
    doc.build(S)
    return buf.getvalue()


def safe_pdf(r, filename="dados"):
    """Gera o PDF sem nunca levantar erro. Devolve (bytes, aviso). Tenta: completo -> sem importancia -> minimo."""
    try:
        return build_pdf(r, filename), ""
    except Exception as e1:
        try:
            return build_pdf(r, filename, importance=False), f"PDF gerado sem alguns itens ({type(e1).__name__}: {str(e1)[:120]})"
        except Exception as e2:
            try:
                return _minimal_pdf(r, filename, str(e2)[:120]), f"PDF simplificado ({type(e2).__name__}: {str(e2)[:120]})"
            except Exception as e3:
                raise RuntimeError(f"Falha ao gerar o PDF: {e3}") from e3


def save_pdf(data: bytes, base="relatorio_automl"):
    """Grava uma copia em ./relatorios/ quando roda no computador. No navegador nao ha disco: devolve None."""
    import sys
    if sys.platform == "emscripten":
        return None
    try:
        from pathlib import Path
        d = Path("relatorios"); d.mkdir(exist_ok=True)
        f = d / f"{base}_{datetime.now():%Y%m%d_%H%M%S}.pdf"
        f.write_bytes(data)
        return str(f.resolve())
    except Exception:
        return None
