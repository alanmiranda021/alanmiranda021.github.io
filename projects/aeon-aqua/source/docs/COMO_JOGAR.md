# Abrir e jogar

Na raiz do projeto, dê dois cliques em `INICIAR_SIMULADOR.cmd`.
O atalho espera o servidor ficar pronto e abre uma janela isolada do Microsoft Edge.
Mantenha a janela de comando aberta. Fechar o Edge encerra o servidor iniciado pelo atalho.
Se o servidor já estiver ativo, o atalho reutiliza-o sem encerrá-lo depois.

Alternativa: `npm.cmd run dev` e abra http://127.0.0.1:5173.
O HTML autossuficiente continua em `dist/index.html`. O `index.html` da raiz é para desenvolvimento e não abre sozinho por duplo clique.

## Missão

O veículo começa próximo da hélice, apontado para o alvo marcado pelo círculo verde.
A câmera de bordo aparece no canto inferior esquerdo da área 3D.

1. Use W/S para avançar/recuar, A/D para lateral, R/F para subir/descer e Q/E para girar.
2. A menos de 4 m do centro da hélice, solte os comandos e aguarde velocidade abaixo de 0,35 m/s.
3. Mantenha a frente do ROV apontada para a rede por 3 segundos.
4. A menos de 3,2 m, com velocidade abaixo de 0,5 m/s, segure Espaço por 4 segundos. A rede desaparece conforme o corte avança.
5. Solte Espaço, recue para 3,2–4 m e inspecione por 2 segundos para concluir.

O painel mostra a etapa, o progresso, tempo, distância, velocidade e pontuação.
Impactos fortes descontam 100 pontos (intervalo mínimo de 1 s); depois de 120 s, há desconto de 5 pontos/s.
O botão Reiniciar missão restaura veículo, rede, etapas e pontuação.

## Verificação

- `npm.cmd test`: testes de física, assets e missão.
- `npm.cmd run build`: verificação de tipos e geração do HTML único.
- `node scripts/verify-browser.mjs`: verifica servidor e HTML direto no Edge (modelos, teclado, cortador e reset).
- `node scripts/verify-mission-browser.mjs`: executa a missão usando teclado no navegador, com o servidor ativo.
- Capturas de tela em `docs/previews/`.

Playwright foi instalado como ferramenta de verificação e abertura visual. Ele usa o Microsoft Edge já instalado, sem precisar baixar outro navegador.

Se houver falha de WebGL, a página exibe o erro. Confira a aceleração de hardware nas configurações do navegador e o driver da placa de vídeo.
