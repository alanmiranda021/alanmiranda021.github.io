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

Resultados locais são gravados em `saida/`. O catálogo de motores é aproximado, o SFOC é simplificado e a interpolação de ondas para Fn entre 0,4 e 0,55 mantém a fórmula da planilha, ainda pendente de conferência. A validação compara valores de referência do material fornecido; a planilha original não está incluída. Importar uma planilha atualiza o navio, sem alterar a malha da busca. O modo com caixa altera a eficiência de transmissão e ainda não modela uma relação de redução.

Em Jupyter, Colab ou VS Code interativo, com `propulsao.py` no caminho de importação:

```python
import propulsao
propulsao.main(["backtest"])
propulsao.main(["validar"])  # retorna True/False sem encerrar o notebook
# propulsao.main([]) executa tudo e gera os arquivos em saida/
```

`main(argv=None)` aceita argumentos explícitos e tolera os argumentos adicionais do kernel. O CONFIG padrão é o Navio Holtrop a 25 nós (RT ≈ 1787 kN), que não encontra motor no catálogo aproximado; o ranking exibido nesse caso não atende à restrição de motor. O exemplo Aurora Spirit no material usa outro navio e não representa o CONFIG padrão.

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
