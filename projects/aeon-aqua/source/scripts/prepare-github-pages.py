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

print('Prepared:', project)
