# AEON Bridge — cabine clara com monitores interativos

Esta versão substitui exclusivamente os arquivos da pasta `projects/aeon-bridge/`.

## Novidades
- Novo modelo GLB de passadiço completo com janelas, consoles, cadeiras, manetes, instrumentos, iluminação e equipamentos.
- Cinco monitores centrais e dois laterais com telas dinâmicas (radar, carta, propulsão, energia, estado da embarcação).
- Cenário marítimo diurno, câmera do comandante, visão geral, bombordo e boreste.
- Clique nos monitores para aproximar, controle por mouse, ajustes de manete, mar e carga.
- Exportação e importação de cenários JSON.

## Como testar
Na raiz do site: `python -m http.server 8000`, depois abra `http://localhost:8000/projects/aeon-bridge/`.
A página precisa de internet para carregar Three.js via CDN. Não abra o HTML diretamente com `file://`.

## Limites
O modelo é procedural, não uma réplica certificada de passadiço real. Telemetria e otimização são demonstrativas; não há conexão ativa com o backend AEON ou com dados reais. Não usar para navegação.
