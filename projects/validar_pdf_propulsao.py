"""Valida PDFs vetoriais e os dados JSON com um leitor independente (pypdf)."""
import argparse
import json
import math
from pathlib import Path


def validar(path):
    from pypdf import PdfReader
    reader=PdfReader(path,strict=True)
    report=json.loads(reader.attachments['dados_propulsao.json'][0].decode('utf-8'))
    text='\n'.join(page.extract_text() for page in reader.pages)
    plotted=0
    for entry in report['entries']:
        if not entry.get('row'):
            continue
        plotted+=1
        assert len(entry['curve'])>=200
        assert 'K_T' in text and '10 K_Q' in text and 'eta_0' in text
        if entry.get('method','').startswith('Série B Python') or 'KTs' in entry['row']:
            row=entry['row']
            sample=next((point for point in entry['curve'] if point['J']==row['J']),None)
            if sample:
                assert math.isclose(sample['KT'],row['KTs'],rel_tol=1e-10,abs_tol=1e-12)
                assert math.isclose(sample['KQ'],row['KQs'],rel_tol=1e-10,abs_tol=1e-12)
        for sample in entry['curve']:
            if sample['eta0'] is not None:
                assert math.isfinite(sample['eta0']) and 0<=sample['eta0']<=1
    for page in reader.pages:
        assert page.get_contents() is not None
        operations=page.get_contents().operations
        assert any(operator==b'Tj' for _,operator in operations)
        assert not any(operator==b'Do' for _,operator in operations),'Captura raster inesperada'
    print(f'PASS: {path.name}: {len(reader.pages)} páginas, {plotted} hélices; JSON completo e operadores PDF válidos.')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf',type=Path,nargs='+')
    args=parser.parse_args()
    for path in args.pdf:validar(path)
