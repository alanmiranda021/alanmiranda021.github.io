from pathlib import Path
import shutil
import re

root = Path(__file__).resolve().parents[1]
site = Path('C:/Users/Alan/Documents/Site/aeon-aqua-publish')
(root / 'README.md').write_text('''# AEON AQUA — simulador de operações com ROV

Simulador 3D em Three.js/TypeScript: ROV Hercules, cargueiro carregado, câmera externa e de bordo, corrente, inércia e missão de remoção de rede da hélice do próprio navio.

## Executar

- Windows: abra `INICIAR_SIMULADOR.cmd` para iniciar o servidor e abrir o Edge.
- Desenvolvimento: `npm install`, `npm run dev` e http://127.0.0.1:5173.
- Build: `npm run build`. O `dist/index.html` é autossuficiente e pode abrir sem servidor.
- Testes: `npm test` e `npm run check`.

## Operação

W/S: avançar/recuar; A/D: lateral; R/F: subir/descer; Q/E: giro; Espaço: cortador.
Arraste/role para movimentar a câmera externa. VER CARGUEIRO alterna a visão geral. REINICIAR MISSÃO restaura rede e pontuação.

O veículo inicia junto à popa. Aproxime-se devagar, inspecione por 3 s, corte a rede por 4 s e recue para verificar a hélice livre por 2 s. O painel mostra dicas e progresso.

## Assets e limites

ROV Hercules — EVNautilus, CC BY 4.0. Cargo Ship Loaded — gogiart, CC BY 4.0. Créditos completos em `assets/LICENSES.md` e na interface.

A física é simplificada em quatro graus de liberdade, com dimensões e parâmetros estimados. Não substitui treinamento certificado ou planejamento operacional. Colisões do navio usam sua malha com BVH; fundo, superfície e rochas usam aproximações.

Apenas quatro assets são importados: Hercules, cargueiro, rochas e areia. Originais e modelos anteriores foram preservados fora do projeto em `../AEON_AQUA_BACKUP_20261011/`.
''', encoding='utf-8')
(root / 'assets/LICENSES.md').write_text('''# Assets usados nesta versão

| Arquivo | Autor / fonte | Licença e alterações |
| --- | --- | --- |
| `src/assets/hercules.glb` | EVNautilus, [ROV Hercules](https://sketchfab.com/3d-models/rov-hercules-b182d28a62854465b6574e7edb743dfc) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), conforme metadados; convertido, simplificado, comprimido e escala ajustada |
| `src/assets/cargo.glb` | gogiart, [Cargo Ship Loaded](https://sketchfab.com/3d-models/cargo-ship-loaded-c14144edcd6f4827a84be12456b51e18) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), conforme metadados; convertido, simplificado, comprimido e escala ajustada |
| `src/assets/sand.webp` | texturelib.com / Dmitriy Chugai; arquivo fornecido no RovSimulator | Termos em `licenses/RovSimulator-third-party.txt`; redimensionado e convertido para WebP; distribuição integrada ao simulador |
| `src/assets/rocks.glb` | Arquivo `water-rocks.glb` fornecido pelo usuário | Autor/licença não informados; material substituído porque a textura original não foi fornecida; geometria comprimida |

Integração em 11/10/2026. Originais e licenças de assets anteriores preservados no backup externo. Apenas os modelos acima são usados no build atual.
''', encoding='utf-8')
project = site / 'projects/aeon-aqua'
source = project / 'source'
source.mkdir(parents=True, exist_ok=True)
shutil.copy2(root / 'dist/index.html', project / 'index.html')
for name in ['src', 'tests', 'scripts', 'assets']:
    shutil.copytree(root / name, source / name, dirs_exist_ok=True)
for name in ['README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'INICIAR_SIMULADOR.cmd', '.gitignore']:
    shutil.copy2(root / name, source / name)
docs = source / 'docs'
docs.mkdir(exist_ok=True)
shutil.copy2(root / 'docs/COMO_JOGAR.md', docs / 'COMO_JOGAR.md')
shutil.copy2(root / 'docs/previews/cargo-ship.webp', site / 'assets/aeon-cargo.webp')
shutil.copy2(root / 'docs/previews/aeon-preview.webp', site / 'assets/aeon-preview.webp')

home = site / 'index.html'
s = home.read_text(encoding='utf-8')
hero = '''<section class="panel" id="inicio" data-title="AEON AQUA"><canvas id="c-hero" aria-hidden="true"></canvas><img class="bg aeon-hero" src="assets/aeon-cargo.webp" alt="Cargueiro carregado do simulador AEON AQUA"><div class="copy"><p class="eyebrow">Projeto em destaque · Engenharia oceânica</p><h1>AEON AQUA.<br>Operações com ROV.</h1><p class="lead">Pilote o ROV Hercules e libere a hélice de um cargueiro em uma missão subaquática 3D.</p><p>Câmera de bordo, telemetria, inércia, corrente e corte de uma rede presa à hélice do próprio navio. Uma experiência de simulação executada no navegador.</p><div class="cta"><a class="button solid" href="projects/aeon-aqua/">Abrir simulador <span>↗</span></a><a class="button" href="projetos-navais.html">Projetos navais <span>↗</span></a></div></div><div class="scroll-hint" aria-hidden="true"></div><div class="ticker" aria-hidden="true"><span>Alan Miranda · Pesquisa e engenharia</span><span>ROV Hercules · Cargueiro 3D</span><span>Rio de Janeiro · <b id="clock">--:--:--</b></span><span>Simulação no navegador ●</span></div></section>'''
s, count = re.subn(r'<section class="panel" id="inicio".*?</section>', lambda _: hero, s, count=1, flags=re.S)
assert count == 1
s = s.replace('Simule a propulsão de um navio de apoio offshore, compare modelos de machine learning e acompanhe as notícias de ROV e engenharia naval.', 'Opere um ROV junto a um cargueiro no AEON AQUA, explore o simulador de propulsão e compare modelos de machine learning.')
s = s.replace('Pesquisa & Sistemas — Alan Miranda</title>', 'AEON AQUA · Pesquisa & Sistemas — Alan Miranda</title>')
home.write_text(s, encoding='utf-8')
css = site / 'home.css'
extra='\n#inicio .aeon-hero{object-fit:cover;object-position:70% center;opacity:.65}#inicio #c-hero{opacity:.12}#inicio .copy h1{font-size:clamp(38px,5.5vw,84px)}\n'
if '#inicio .aeon-hero' not in css.read_text(encoding='utf-8'):
    with css.open('a', encoding='utf-8') as f:f.write(extra)

naval = site / 'projetos-navais.html'
s = naval.read_text(encoding='utf-8')
s = s.replace('<div class="ship-map">','<div class="ship-map aeon-ship-map">')
s = s.replace('assets/navio.svg', 'assets/aeon-cargo.webp').replace('Navio de apoio offshore em perfil', 'Cargueiro carregado do simulador AEON AQUA')
s = s.replace('<a class="ship-point point-propulsion" href="naval.html" aria-label="Abrir simulador de propulsão"><span>Simulador de propulsão ↗</span></a>', '<a class="ship-point point-propulsion" href="projects/aeon-aqua/" aria-label="Abrir simulador AEON AQUA"><span>AEON AQUA · Operar ROV ↗</span></a>')
card = '''<a class="card reveal" href="projects/aeon-aqua/"><div class="thumb"><img src="assets/aeon-preview.webp" alt="ROV Hercules operando junto à hélice do cargueiro" loading="lazy" decoding="async"></div><div><span class="tag">Simulação 3D · ROV</span><h3>AEON AQUA</h3><p>Pilote o Hercules, inspecione a hélice do navio e corte a rede que impede sua operação.</p><span class="more">Operar ROV ↗</span></div></a>'''
if '<h3>AEON AQUA</h3>' not in s:s = s.replace('<div class="card-grid two">', '<div class="card-grid two">' + card, 1)
s = s.replace('Explore as ferramentas a partir do navio ou pelos links abaixo.', 'Explore o cargueiro do AEON AQUA e opere o ROV na missão de desobstrução da hélice, ou acesse as outras ferramentas abaixo.')
naval.write_text(s, encoding='utf-8')
css=site/'pages.css'
if '.aeon-ship-map' not in css.read_text(encoding='utf-8'):
    with css.open('a', encoding='utf-8') as f:f.write('\n.aeon-ship-map>img{width:100%;height:auto;border-radius:8px}.aeon-ship-map .point-propulsion{left:28%;top:70%}.aeon-ship-map .point-ml{left:72%;top:30%}\n')
print('Prepared:', project)
