# AEON AQUA — simulador de operações com ROV

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
