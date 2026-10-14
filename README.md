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

Em **Modo de análise**, mantenha **Backtest atual** para comparar o catálogo inteiro e encontrar o motor mais próximo, ou selecione **Calibrar para um motor específico**. O seletor lista variantes com cilindros definidos e limites de RPM/potência. A calibração restringe o catálogo ao motor escolhido, ajusta D, P/D, AE/AO e pás dentro dos limites do JSON e resolve a RPM de equilíbrio. Navio, margens e restrições físicas permanecem configurados pelo usuário.

- **Rápida:** uma busca ampla com malha rápida.
- **Completa:** busca completa e três rodadas de refinamento local.
- **Infinita:** busca inicial rápida seguida de refinamentos e exploração de novas regiões a cada cinco rodadas, até clicar em parar.

O melhor resultado encontrado é preservado entre rodadas; candidatos compatíveis têm prioridade e o objetivo BHP/FOC desempata. Se nada couber, a menor violação frente ao motor alvo fica explícita. Parar mantém o último melhor resultado para simulação e downloads. A busca contínua não garante encontrar solução nem ótimo global. O funil e o diagnóstico CSV se referem à última rodada; o contador acumulado mede avaliações e pode repetir pontos. O JSON registra motor, nível, rodada e malha da rodada. Os refinamentos usam uma sequência determinística de exploração.
