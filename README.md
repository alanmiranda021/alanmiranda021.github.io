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
