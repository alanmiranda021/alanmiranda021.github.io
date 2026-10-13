# Catálogo de motores

`motores.csv` contém 56 variantes com número de cilindros definido, cobrindo as 12 famílias do catálogo anterior. A fonte efetivamente consultada foi o **MAN Energy Solutions, Marine Engine Programme 2021**, páginas 22, 28, 32, 38, 46, 54, 60, 68, 78, 86, 90 e 94:

[Documento oficial](https://man-es.com/docs/default-source/document-sync-archive/marine-engine-programme-eng.pdf).

O Project Guide do G90ME-C10.5 identificado na busca (edição outubro de 2024) retornou HTTP 404 na consulta. Portanto, estes dados são de um programa oficial **histórico de 2021**, e não foram rotulados como Project Guide atual ou seleção final de fabricante. O catálogo não inclui todos os motores existentes.

Cada linha tem família, cilindros, edição, página e URL. `p_max_kw` é L1 por cilindro × cilindros; `p_min_kw` é L2 por cilindro × cilindros, ambos na rotação máxima. As bordas continuam no modelo simplificado P ∝ n, sujeito ao arredondamento dos diagramas. A variante/emissões, disponibilidade e envelope final devem corresponder ao motor específico do projeto.

No G90ME-C10.5, a página 28 fornece 72–84 rpm, L1 = 6240 kW/cilindro e L2 = 4670 kW/cilindro. Assim, o 8G90ME-C10.5 tem 49920/37360 kW em 84 rpm. Isso evita representar a família inteira pelo retângulo aproximado antigo de 76000/30000 kW. Os valores anteriores permanecem em `MOTORES` apenas como reserva quando o CSV não existe.

O CSV é buscado primeiro no caminho configurado e depois junto de `propulsao.py`; no navegador é carregado pelo Worker. Um registro de execução contém os números realmente usados e o SHA-256 do catálogo. Ao trocar o CSV por dados de um Project Guide/CEAS específico, mantenha as cinco colunas obrigatórias e atualize a origem dos dados.

O diagnóstico usa:

- `viol_rpm = max(0, (n_min - rpm)/rpm, (rpm - n_max)/rpm)`.
- `rpm_layout = clip(rpm, n_min, n_max)`.
- `P_min/max = p_min/max_kw × rpm_layout/n_max`.
- `viol_kw = max(0, (P_min - MCR)/MCR, (MCR - P_max)/MCR)`.
- `viol_total = max(viol_rpm, viol_kw)`.

O motor mais próximo minimiza o máximo das violações; zero indica atendimento ao layout simplificado. O critério corresponde às fórmulas da aba `Folga_motor` da planilha fornecida, estendido também aos limites inferiores. Os limites de potência não são extrapolados para uma rotação fora do layout. Em empate, prevalece a ordem do catálogo. A violação é uma métrica de diagnóstico, não uma probabilidade nem um percentual de aprovação.
