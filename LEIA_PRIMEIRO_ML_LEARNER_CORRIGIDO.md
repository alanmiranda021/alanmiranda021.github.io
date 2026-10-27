# ML Learner — laboratório naval corrigido e auditável

**Data:** 15/10/2026. **Origem:** projeto completo de
`alanmiranda021.github.io-main (3).zip` com as correções de auditoria e as
correções complementares recebidas em `files (1).zip`. Os demais componentes
do site são preservados.

## O que foi implementado

1. Proteção do vazamento de CO₂/consumo na execução e no gerador, inclusive
   quando a API é chamada sem Streamlit. Rejeição de cabeçalhos duplicados e
   normalização segura de exclusões passadas como texto.
2. Checagens do isolamento do holdout e das dobras antes do treinamento;
   registro de tentativas e avaliações do teste final (incluindo exceções).
3. Testes novos de ciência e de vazamento, mantendo os testes pré-existentes.
4. Ajuste do resumo executivo do PDF para formatar RMSE e identificar
   ostensivamente dados artificiais de demonstração.
5. Ferramenta `github-pages/scripts/verify_naval_release.py`: executa
   E1/E3/DIST em protocolo demonstrativo, checa invariantes e gera evidências.
6. Documentação com comandos de execução e diferenças entre N-FAST e o
   protocolo completo local.

## Evidência de validação, sem promessas de resultado científico

- **95 testes passaram, 3 foram ignorados, 0 falharam** na suíte Python.
- **13 verificações locais passaram** no portão de aceitação; foi gerado
  `github-pages/verification/resultado_ARTIFICIAL_demonstrativo.pdf` com
  **20 páginas** e **resumo executivo de uma página**.
- Os resultados numéricos desse PDF referem-se a **dados artificiais** e
  **não demonstram melhora real para navios**.
- **Não verificado:** `.mat` original, Stlite executado em navegador, validação
  física, commit e push. O pacote contém a estrutura necessária à execução
  desses ensaios, mas a inexistência dessas evidências impede o aceite
  científico definitivo previsto na especificação.

## Como testar no VS Code (PowerShell)

Abra a pasta `github-pages` no VS Code e execute no terminal:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
python scripts/verify_naval_release.py --out verification
python -m streamlit run app.py
```

Para usar o arquivo original (não incluído):

```powershell
python scripts/verify_naval_release.py --input "C:\dados\Dados_navio_nig(1).mat" --out verification-real --budget 600
```

O modo Stlite exige um teste **no navegador**, acessando o site através
de HTTP. Este ZIP não é um commit, e não contém credenciais nem arquivos
`.git`; faça revisão e publicação em sua branch de trabalho.

Veja também `github-pages/docs/RELATORIO_CORRECOES_AUDITORIA.md`,
`github-pages/docs/REQUISITOS_IMPLEMENTACAO_CODEX.md` e
`github-pages/verification/RELATORIO_VERIFICACAO.md`.
