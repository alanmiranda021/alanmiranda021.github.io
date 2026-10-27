# Publicação e limpeza

O simulador utiliza apenas a hélice original do cargueiro. A obstrução é posicionada a partir do nó `Object_8` do GLB otimizado e desaparece durante a missão. A posição inicial do ROV acompanha esse alvo.

As colisões do navio usam suas superfícies reais com BVH, permitindo acesso ao espaço vazio da popa. Fundo e rochas continuam usando aproximações. Foram removidos do cenário a hélice separada, o ventilador e o navio antigo.

Fontes originais, arquivos intermediários, modelos antigos e decoder Draco sem uso foram transferidos para `../AEON_AQUA_BACKUP_20261011/`. O projeto atual utiliza apenas `cargo.glb`, `hercules.glb`, `rocks.glb` e `sand.webp`.

## GitHub Pages

- Site: https://alanmiranda021.github.io/
- Simulador: https://alanmiranda021.github.io/projects/aeon-aqua/
- Projetos navais: https://alanmiranda021.github.io/projetos-navais.html
- Fontes: `projects/aeon-aqua/source/` no repositório `alanmiranda021/alanmiranda021.github.io`.

A página inicial destaca o AEON AQUA. A página de projetos navais mostra o cargueiro atual e links para o simulador. O HTML do simulador é autossuficiente; modelos e código ficam embutidos no arquivo publicado.

## Validação

20 testes unitários aprovados. Build e verificações no Edge aprovados para HTML direto, servidor local e a estrutura de publicação. A missão inteira também foi executada com teclado real. Home e projetos navais foram verificados em desktop, e a home em tela de celular.
