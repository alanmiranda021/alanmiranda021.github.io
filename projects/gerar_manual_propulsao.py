"""Atualiza anexos integrais do manual e verifica sua transcrição."""
from pathlib import Path
import argparse
import ast
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / 'projects/Manual_Completo_Simulador_Propulsao.md'
MARKER = '<!-- ANEXOS_GERADOS_PROPULSAO -->'
FILES = [
    'naval.html', 'naval.css', 'naval.js', 'naval-backtest.js',
    'naval-backtest-worker.js', 'projects/propulsao.py',
    'projects/propulsao_busca.py', 'projects/motores.csv',
    'projects/requirements-propulsao.txt', 'projects/CATALOGO_MOTORES.md',
    'minimal.css', 'minimal.js', 'favicon.svg',
    'projects/test_propulsao.py', 'projects/test_propulsao_busca.py',
    'projects/test_propulsao_diagnostico.py', 'projects/test_propulsao_calibracao.py',
    'projects/test_propulsao_worker.cjs', 'projects/test_propulsao_browser.cjs',
    'projects/gerar_manual_propulsao.py',
]


def digest(value):
    return hashlib.sha256(value).hexdigest()


def normalized(path):
    return path.read_bytes().decode('utf-8').replace('\r\n', '\n')


def cell(value):
    return str(value).replace('|', '&#124;').replace('\n', ' ')


def config_leaves(node, prefix='CONFIG'):
    if isinstance(node, ast.Dict):
        for key, value in zip(node.keys, node.values):
            yield from config_leaves(value, prefix + '.' + str(ast.literal_eval(key)))
    else:
        yield prefix, ast.unparse(node)


def generate(published=None):
    sources = [(name, ROOT / name) for name in FILES]
    if published:
        sources += [('publicado/' + name, published / name)
                    for name in ['naval.html', 'i18n.css', 'i18n.js']]
    out = ['\n\n## 29. Manifesto das transcrições integrais\n',
           'Os hashes brutos identificam os bytes lidos. Os hashes LF identificam o texto incluído nos anexos. O suplemento `publicado/` preserva os recursos adicionais do site publicado.\n',
           '| Arquivo | Bytes originais | Linhas | LF final | SHA-256 bruto | SHA-256 LF |',
           '|---|---:|---:|---|---|---|']
    for name, path in sources:
        raw = path.read_bytes()
        content = normalized(path)
        out.append(f'| `{name}` | {len(raw)} | {len(content.splitlines())} | '
                   f'{"sim" if content.endswith(chr(10)) else "não"} | '
                   f'`{digest(raw)}` | `{digest(content.encode("utf-8"))}` |')
    out += ['\n## 30. Inventário exato dos parâmetros CONFIG\n',
            'Expressões transcritas da árvore sintática do Python; nomes como `RHO` referem-se às constantes do código integral.\n',
            '| Caminho | Expressão padrão |', '|---|---|']
    tree = ast.parse(normalized(ROOT / 'projects/propulsao.py'))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'CONFIG' for t in node.targets):
            out += [f'| `{cell(key)}` | `{cell(value)}` |' for key, value in config_leaves(node.value)]
    out += ['\n## 31. Índice de funções e assinaturas\n',
            'As linhas referem-se aos arquivos originais, não à numeração deste Markdown. Os capítulos anteriores explicam os fluxos; os anexos permitem consultar cada implementação inteira.\n']
    for name, path in sources:
        if path.suffix not in ['.py', '.js', '.cjs']:
            continue
        content = normalized(path)
        rows = []
        if path.suffix == '.py':
            for node in ast.walk(ast.parse(content)):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    rows.append((node.lineno, node.name + '(' + ast.unparse(node.args) + ')'))
        else:
            pattern = r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>'
            for match in re.finditer(pattern, content):
                rows.append((content.count('\n', 0, match.start()) + 1,
                             (match.group(1) or match.group(3)) + '(' + (match.group(2) or match.group(4) or '') + ')'))
        if rows:
            out += [f'\n### `{name}`\n', '| Linha | Assinatura |', '|---:|---|']
            out += [f'| {line} | `{cell(signature)}` |' for line, signature in sorted(rows)]
    out += ['\n## 32. Código-fonte integral\n',
            'Cada arquivo aparece completo em seu próprio bloco. Nenhum trecho foi omitido; os testes e o gerador deste documento também estão incluídos.\n']
    for index, (name, path) in enumerate(sources, 1):
        content = normalized(path)
        fence = '`' * max(4, 1 + max((len(m.group()) for m in re.finditer(r'`+', content)), default=0))
        language = {'.py': 'python', '.js': 'javascript', '.cjs': 'javascript',
                    '.html': 'html', '.css': 'css', '.csv': 'csv', '.md': 'markdown',
                    '.svg': 'xml', '.txt': 'text'}.get(path.suffix, 'text')
        out += [f'\n### 32.{index}. `{name}`\n',
                f'<!-- SOURCE {name} SHA256_LF {digest(content.encode("utf-8"))} FINAL_LF {int(content.endswith(chr(10)))} -->',
                fence + language, content + ('' if content.endswith('\n') else '\n') + fence,
                f'<!-- END_SOURCE {name} -->']
    prefix = MANUAL.read_text(encoding='utf-8').split(MARKER, 1)[0]
    MANUAL.write_text(prefix + MARKER + '\n'.join(out) + '\n', encoding='utf-8', newline='\n')
    return verify(compare_sources=True)


def verify(compare_sources=False):
    text = MANUAL.read_text(encoding='utf-8')
    pattern = r'<!-- SOURCE (.*?) SHA256_LF ([a-f0-9]{64}) FINAL_LF ([01]) -->\n(`{4,})[^\n]*\n(.*?)\n\4\n<!-- END_SOURCE \1 -->'
    matches = list(re.finditer(pattern, text, re.S))
    for match in matches:
        content = match.group(5) + ('\n' if match.group(3) == '1' else '')
        if digest(content.encode('utf-8')) != match.group(2):
            raise ValueError('Transcrição divergente: ' + match.group(1))
        name = match.group(1)
        if compare_sources and not name.startswith('publicado/') and content != normalized(ROOT / name):
            raise ValueError('Arquivo modificado após geração: ' + name)
    names = {match.group(1) for match in matches}
    if not set(FILES).issubset(names):
        raise ValueError('Anexos ausentes: ' + str(set(FILES) - names))
    print(f'Verificado: {len(matches)} arquivos integrais; {len(text.splitlines())} linhas; {MANUAL.stat().st_size} bytes.')
    return len(matches)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publicado', type=Path, help='Checkout publicado opcional com os recursos i18n.')
    parser.add_argument('--verificar', action='store_true', help='Verifica anexos existentes sem regenerar.')
    parser.add_argument('--comparar-fontes', action='store_true', help='Também exige igualdade com os arquivos locais; a cópia publicada do HTML pode diferir da transcrição local.')
    args = parser.parse_args()
    verify(args.comparar_fontes) if args.verificar else generate(args.publicado)
