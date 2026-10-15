# Alan Miranda — Pesquisa & Sistemas

Portfólio estático para GitHub Pages. Sem build, sem dependências: basta publicar a raiz do repositório.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Home em painéis de tela cheia (`home.css`, `home.js`): hero, navio, IA, robótica, dados, livro e manifesto |
| `projetos-navais.html` | Navio interativo, simulador, ML Learner, radar de notícias e contato |
| `outros-projetos.html` | AEON, INCLUDE e Alpha App |
| `sobre.html` | Formação, trajetória, competências e links |
| `arquivos-uteis.html` | Pastas do Google Drive e acervo de audiobooks |
| `manifesto.html` | Texto completo do manifesto |
| `naval.html` | Simulador de propulsão (`naval.css`, `naval.js`) |
| `projects/` | Páginas dos projetos (`aeon`, `alpha`, `include`, `ml-learner`) |
| `github-pages/` | Aplicativo ML Learner (Stlite/Pyodide) — veja `github-pages/LEIAME.md` |
| `assets/` | Imagens, ilustrações SVG e arquivos da oficina (`assets/robo/`) |

Estilos compartilhados: `minimal.css`, `pages.css`, `manifesto.css`, `project-pages.css` e `minimal.js` (cabeçalho, menu e popup de alerta do manifesto, exibido uma vez por sessão).

## Visualizar localmente

```bash
python -m http.server 8080
```

Abra http://localhost:8080. Mantenha o arquivo `.nojekyll` na raiz.

## AEON AQUA

- Simulador publicado em `projects/aeon-aqua/index.html` (HTML autossuficiente).
- Fontes, assets otimizados e testes em `projects/aeon-aqua/source/`.
- A home abre com o manifesto; o AEON AQUA fica em projetos-navais.html, junto ao cargueiro e aos links de ROV, propulsao e ML Learner.

## Propulsão automatizada

Em `naval.html`, a seção **Holtrop → Série B → Burrill → Motor** executa o modelo Python no navegador com Pyodide em um Worker. Clique em carregar configuração, edite o JSON ou importe uma planilha Holtrop e execute o backtest. O ranking, o perfil de velocidades e o relatório podem ser baixados. O carregamento inicial usa o CDN jsDelivr; sirva a página por HTTP, não por `file://`.

Para execução local:

```bash
pip install -r projects/requirements-propulsao.txt
python projects/propulsao.py validar
python projects/propulsao.py tudo
python projects/propulsao.py tudo --planilha "Navio.xlsx"
python -m unittest discover -s projects -p test_propulsao.py
```

Resultados locais são gravados em `saida/`. O CSV de motores usa variantes do programa oficial MAN de 2021, com layout simplificado; o catálogo interno aproximado é apenas reserva. O SFOC é simplificado e a interpolação de ondas para Fn entre 0,4 e 0,55 mantém a fórmula da planilha, ainda pendente de conferência. A validação compara valores de referência do material fornecido; a planilha original Holtrop não está incluída. Importar uma planilha atualiza o navio, sem alterar a malha da busca. O modo com caixa altera a eficiência de transmissão e ainda não modela uma relação de redução.

Em Jupyter, Colab ou VS Code interativo, com `propulsao.py` no caminho de importação:

```python
import propulsao
propulsao.main(["backtest"])
propulsao.main(["validar"])  # retorna True/False sem encerrar o notebook
# propulsao.main([]) executa tudo e gera os arquivos em saida/
```

`main(argv=None)` aceita argumentos explícitos e tolera os argumentos adicionais do kernel. O CONFIG padrão é o Navio Holtrop a 25 nós (RT ≈ 1787 kN), que não encontra motor no catálogo usado; o ranking exibido nesse caso não atende à restrição de motor. O exemplo Aurora Spirit no material usa outro navio e não representa o CONFIG padrão.

### Níveis de busca e teste da melhor hélice

O seletor **Tipo de backtest** oferece Rápido (D / AE/AO / P/D: 0,25 m / 0,10 / 0,10), Completo (0,10 m / 0,05 / 0,05), Extremamente detalhado (0,05 m / 0,025 / 0,025) e Personalizado (passos do JSON). Os três perfis usam os mesmos limites e critérios físicos; muda a resolução da busca. A busca é processada em lotes com progresso, cancelamento e ranking global, até 2 milhões de combinações estimadas. Escolha separadamente o objetivo de menor BHP ou menor consumo.

Ao terminar, **Testar melhor hélice na simulação** transfere a geometria, rpm, velocidade, w, t, ηR, água, motores e hélices. A resistência usa uma curva Holtrop interpolada com o ponto de serviço incluído exatamente. O painel exibe eficiência propulsiva, potência, consumo e Burrill; o MCR e a seleção de motor permanecem referências do backtest quando os campos são editados. A potência é recalculada a partir do torque e o consumo usa a carga sobre o MCR de referência. O botão de restaurar volta à missão didática. A melhor opção de um ranking sem motor continua identificada como exploratória.

O Worker carrega `projects/propulsao.py` e `projects/propulsao_busca.py`. Testes adicionais:

```bash
python -m unittest discover -s projects -p "test_propulsao*.py"
node projects/test_propulsao_worker.cjs <caminho-do-pacote-pyodide-0.29.2>
node projects/test_propulsao_browser.cjs <caminho-do-pacote-playwright-core>
```

O teste de navegador usa Edge em modo headless e requer o site servido em `http://127.0.0.1:8080` (ou outro endereço passado como segundo argumento).

### Diagnóstico de motor e reprodutibilidade

Cada candidato que passou pelas restrições hidrodinâmicas recebe `motor_proximo`, `viol_rpm`, `viol_kw` e `viol_total`. O cálculo segue a aba `Folga_motor` de `analise_propulsao.xlsx`: denominadores são RPM/MCR solicitados, e a violação total é o **máximo** das duas. A potência admissível é avaliada na rotação limitada ao layout do motor. O ranking exploratório é ordenado por menor violação, com o objetivo BHP/FOC como desempate. Zero indica atendimento ao layout simplificado.

As saídas incluem `diagnostico_motor.csv` com todos os candidatos hidrodinamicamente válidos, `config_execucao.json` com CONFIG efetivo, data UTC, perfil, funil, catálogo usado e hashes, além do ranking, curva e relatório. No navegador, há downloads próprios para diagnóstico e registro. O relatório mostra as margens intermediárias e o fator de potência `1,15 × 1,05³ × 1,10 = 1,464395625` para as margens padrão. Os avisos de limite identificam o último ponto amostrado de D, P/D e AE/AO, considerando os limites por número de pás.

`FOC_t_h` fica vazio fora da faixa de carga SFOC configurada (padrão 25–100%). `FOC_limitado_t_h` é uma estimativa separada com carga limitada para o SFOC; não aprova operação fora do envelope. Pontos acima de 100% são marcados “fora do envelope”. `consumo_confiavel` indica apenas a validade da faixa de carga para o modelo simplificado, não consumo validado pelo fabricante.

```bash
python projects/propulsao.py tudo --perfil detalhado
python projects/propulsao.py tudo --config saida/config_execucao.json
```

A reprodução usa o catálogo incorporado ao registro, mesmo que o CSV instalado tenha mudado. Malhas grandes são executadas em lotes; `validar_config` informa o tamanho real e o limite por lote. Veja [fonte e limites do catálogo](projects/CATALOGO_MOTORES.md): o Project Guide procurado não estava disponível, portanto o CSV não é apresentado como catálogo atual de fabricante. A planilha de análise foi consultada e preservada, sem executar instruções ou alterar cenários nela.

### Calibrar para um motor específico

Em **Modo de análise**, mantenha **Backtest atual** para comparar o catálogo inteiro e encontrar o motor mais próximo, ou selecione **Calibrar até encontrar a melhor alternativa**. O motor é opcional: sem seleção compara todo o catálogo; com seleção restringe a busca à variante escolhida. **Alternativas de pás** permite explorar todas de 2 a 7 (padrão) ou respeitar a lista do JSON. As faixas de área válidas de cada número de pás continuam aplicadas. A busca ajusta D, P/D, AE/AO e resolve RPM, preservando navio, margens e restrições físicas.

- **Rápida:** uma busca ampla com malha rápida.
- **Completa:** busca completa e três rodadas de refinamento de cada número de pás permitido.
- **Infinita:** busca inicial ampla seguida de refinamentos por número de pás e varreduras sistemáticas de toda a malha por blocos, até clicar em parar. Depois de completar uma passagem global, reduz os passos até o mínimo de 0,0001. Está disponível também no backtest como **Explorar até parar**, sem motor específico.

O melhor resultado global e os melhores de cada número de pás são preservados. Candidatos compatíveis têm prioridade e o objetivo BHP/FOC desempata; se nada couber, a menor violação fica explícita. A interface mostra a etapa, as pás avaliadas e o bloco global atual. Um bloco pode excluir pás cuja faixa de área não intersecta aquela região, mas a passagem completa cobre todas as combinações válidas na resolução vigente. O funil e o diagnóstico CSV se referem à última rodada; avaliações acumuladas podem repetir pontos. O JSON registra motor, nível, rodada, malhas, posição da varredura e candidatos preservados.

**Ao concluir ou parar a calibração, o último melhor resultado concluído é carregado automaticamente na simulação.** Isso transfere o navio da configuração, água, pás, D, P/D, AE/AO, RPM, w, t, ηR, motores e hélices, com a curva Holtrop usada pela simulação. Sem motor alvo, informa o mais próximo; com alvo, preserva a avaliação frente a ele. Se parar antes de existir um candidato válido, não substitui a simulação por dados vazios. A exploração de uma malha finita não garante solução nem ótimo global contínuo.

### Manual completo do simulador de propulsão

Consulte o [Manual completo do simulador de propulsão](projects/Manual_Completo_Simulador_Propulsao.md) para arquitetura, fórmulas, parâmetros, funis, ranking de motores, calibração, simulação, saídas, limitações e código integral de 43 arquivos. Confira as transcrições SHA-256 com `python projects/gerar_manual_propulsao.py --verificar`.


### Entrega P0: baseline e auditoria

[Relatório comparativo da entrega P0](projects/Relatorio_Entrega_P0.md): hashes, diagnóstico das rejeições do funil e histórico exportável. API v4 e equações preservadas.


### Comparação por pás e curvas em PDF

O painel distingue categorias excluídas, rejeições e aprovações por Z. Selecione ranking global ou por pás para carregar uma alternativa e exportar curvas vetoriais K_T, 10K_Q e eta_0 em PDF com dados JSON completos anexados. [Métodos e testes desta entrega](projects/Relatorio_Comparacao_Pas_PDF.md).


### Modo FOC automático: Sprints 0/1

Orquestrador Python com CONFIG preservado, melhores viável/diagnóstico separados e cobertura da malha ampla declarada antes de estagnação. A cobertura global profunda, cache e integração web ficam para os próximos sprints. [Relatório e evidências](projects/Relatorio_Auto_Sprints_0_1.md).
