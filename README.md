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
