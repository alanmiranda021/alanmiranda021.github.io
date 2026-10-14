# Otimização FOC automática — Sprints 0 e 1

## Escopo entregue

O protótipo citado na especificação estava em Downloads, fora do repositório. As cópias originais de `propulsao_auto.py` e de seus quatro testes foram preservadas em `baselines/auto_sprint0/`, com manifesto de hashes, configuração e logs. Foram reutilizados os baselines científicos P0 e acrescentada uma fixture artificial explicitamente identificada, com motor de teste aprovado.

O modo automático está disponível em Python/CLI. A integração de um novo botão/ação Worker continua no Sprint 3. Os fluxos existentes de backtest, calibração, PDF e simulação não receberam novos controles nesta entrega.

## Mudanças

- `propulsao_auto.py`: mantém `otimizar`, `resumo`, auxiliares e CLI do protótipo; expõe API v4. Cenários hipotéticos são opt-in, erros de entrada propagam e os textos não afirmam impossibilidade ou minimalidade global.
- `propulsao_auto_nucleo.py`: implementação isolada do orquestrador, com cópias original/efetiva do CONFIG, FOC obrigatório, Z=2–7 e catálogo completo por padrão. Um motor explícito restringe o escopo e é registrado.
- `propulsao_busca.py`: observa candidatos antes dos cortes dos lotes e conserva até cinco viáveis e cinco diagnósticos por Z em reservatórios científicos independentes do `top` da interface e do beam de refinamento. O aprovado de apresentação é selecionado antes do corte global. O retorno permanece com seis elementos, e o ranking legado continua existindo.
- `propulsao_auditoria.py`: inclui hashes dos módulos automáticos quando presentes.
- `test_propulsao_auto.py`: doze testes para imutabilidade, objetivo, catálogo, candidatos separados, rodada vazia, estagnação condicionada à cobertura, parâmetros inválidos, NaN/Inf, JSON, cancelamento, empates, alternativas e reservatórios com `top=1`.

Os nomes dos quatro testes do protótipo foram preservados, mas suas expectativas foram atualizadas quando contradiziam o contrato revisado: sugestões automáticas agora ficam desligadas, o status deixa de afirmar inviabilidade comprovada e a monotonicidade é verificada em todas as rodadas. Os quatro testes originais estão arquivados; não são apresentados como quatro testes adicionais aprovados sem alterações.

## Cobertura e parada: limite explícito desta fase

Para `rapido`/`completo`, o orquestrador certifica apenas a malha ampla inicial do perfil escolhido: todas as pás admissíveis precisam constar nas pás avaliadas, a etapa precisa ser `varredura ampla`, e a contagem executada deve coincidir com `tamanho_malha(configurar_perfil(...))`. A estagnação só pode encerrar depois dessa cobertura declarada. Sem essa evidência, a execução termina apenas por orçamento de rodadas ou cancelamento.

`cobertura.global_discreta_concluida=false` é explícito. **Isso não certifica os blocos globais finos do modo infinito.** `nivel='profundo'` é recusado com mensagem explicativa até o Sprint 2; não é traduzido para doze refinamentos completos. Avaliações únicas e cache hits ficam `null`, pois não foram medidos nesta fase. Não são apresentados percentuais de cobertura global inventados.

O melhor viável é escolhido por FOC finito e desempates BHP/Z/D/área/passo/motor. O diagnóstico é escolhido separadamente por violação finita e FOC. Ambos sobrevivem a rodadas vazias. A melhoria significativa controla a paciência, mas ganhos pequenos continuam atualizando o incumbente. Não há arredondamento científico da violação.

## Uso

```powershell
python projects/propulsao_auto.py --nivel rapido --max-rodadas 3 --json
python projects/propulsao_auto.py --config navio.json --nivel completo --motor 8G90ME-C10.5
python projects/propulsao_auto.py --nivel rapido --analisar-alternativas
```

O último comando executa buscas adicionais em hipóteses modificadas; não faz parte da execução padrão. As alternativas são rotuladas como cenários hipotéticos e não alteram o CONFIG original. O JSON inclui CONFIG original/efetivo, estado, histórico, hashes, resultados separados e cobertura declarada. O modelo SFOC é genérico, não economia específica de fabricante.

## Evidência e testes

- Antes: 36 testes existentes aprovados; log em `baselines/auto_sprint0/testes_antes.log`.
- Depois: 46 testes Python aprovados na execução integral registrada em `baselines/auto_sprint0/testes_depois.log`; após acrescentar dois cenários, os doze novos testes foram executados separadamente, com log em `testes_auto.log`. A suíte passa a conter 48 testes.
- Worker real em Pyodide 0.29.2 aprovado, preservando API v4, retornos, transferência e exportações.
- Teste real de Edge/Playwright: backtest, calibração, parada, seleção por Z, PDFs e largura móvel.
- Fixture artificial com motor aprovado: `baselines/auto_sprint0/caso_artificial_aprovado.json`, sem alegação de que seu motor existe.
- Caso real adversarial com `top=1`: catálogo artificial limita RPM a 84 e conserva simultaneamente viável e diagnóstico nos reservatórios, mesmo que a tabela apresente apenas uma linha.

As equações, margens, domínio, catálogo original e solver não foram alterados. O baseline de referência continua verificando RPM MCR aproximadamente 90,27403, limite real 84 e ausência de aprovação no cenário original.

## Próximas fases, sem alegação de conclusão

Sprint 2: cobertura global discreta com orçamento finito, custos estimados, cache, contagem de únicos e testes específicos. Sprint 3: nova ação Worker, interface e checkpoints/retomada compatível. Os PDFs já existentes permanecem operacionais; esta entrega não os usa como evidência de otimização profunda concluída.
