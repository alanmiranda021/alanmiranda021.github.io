# Alan Miranda — Pesquisa & Sistemas

Portfólio estático para GitHub Pages. Sem build, sem dependências: basta publicar a raiz do repositório.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página inicial (manifesto, hero, projetos, livro) |
| `projetos-navais.html` | Navio interativo, simulador, ML Learner, radar de notícias e contato |
| `outros-projetos.html` | AEON, INCLUDE e Alpha App |
| `sobre.html` | Formação, trajetória, competências e links |
| `arquivos-uteis.html` | Pastas do Google Drive e acervo de audiobooks |
| `manifesto.html` | Texto completo do manifesto |
| `naval.html` | Simulador de propulsão (`naval.css`, `naval.js`) |
| `projects/` | Páginas dos projetos (`aeon`, `alpha`, `include`, `ml-learner`) |
| `github-pages/` | Aplicativo ML Learner (Stlite/Pyodide) — veja `github-pages/LEIAME.md` |
| `assets/` | Imagens, ilustrações SVG e arquivos da oficina (`assets/robo/`) |

Estilos compartilhados: `minimal.css`, `pages.css`, `manifesto.css`, `minimal.js`. Páginas de projeto usam `alan-os`, `future-interface`, `omni-interface`, `project`, `project-modern`, `style` e `library-news` (CSS).

## Visualizar localmente

```bash
python -m http.server 8080
```

Abra http://localhost:8080. Mantenha o arquivo `.nojekyll` na raiz.
