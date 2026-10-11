from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
site=Path('C:/Users/Alan/Documents/Site/aeon-aqua-publish')
keys=list(json.loads((root/'docs/i18n-extracted.json').read_text(encoding='utf-8')))
translations={}
for line in (root/'docs/i18n-translations.txt').read_text(encoding='utf-8').splitlines():
    if not line.strip():continue
    index,english=line.split('|',1)
    translations[keys[int(index)]]=english
translations.update({
    'Painéis do simulador':'Simulator panels',
    'Missão':'Mission',
    'Telemetria':'Telemetry',
    'Navio':'Ship',
    'Controles por toque':'Touch controls',
    'Joystick de avanço e movimento lateral':'Forward and lateral movement joystick',
    'Joystick de giro e profundidade':'Yaw and depth joystick',
    'Mover':'Move',
    'CORTAR':'CUT',
    'Segure':'Hold',
    'Girar / profundidade':'Turn / depth',
    'Explore projetos de engenharia naval, simulação, propulsão e modelos de machine learning.':'Explore projects in marine engineering, simulation, propulsion and machine learning.',
    'Fechar menu':'Close menu',
    'Fechar alerta':'Close alert',
    'Alerta · Manifesto':'Notice · Manifesto',
    'Tecnologia e humanidade':'Technology and humanity',
    'Ler o manifesto':'Read the manifesto',
    'Continuar no site':'Continue to the site',
    'Nenhuma notícia disponível agora. Consulte as fontes abaixo ou tente atualizar.':'No news available right now. Visit the sources below or try refreshing.',
    'Notícias de ROV ↗':'ROV news ↗',
    'Notícias de engenharia naval ↗':'Marine engineering news ↗',
    'Notícias atualizadas.':'News updated.',
    'Parte das fontes está indisponível. Exibindo notícias disponíveis.':'Some sources are unavailable. Showing available news.',
    'Não foi possível atualizar. Exibindo a última consulta.':'Unable to refresh. Showing the last update.',
    'As fontes estão indisponíveis no momento.':'The sources are currently unavailable.',
    'Interface disponível — confira o laboratório abaixo':'Interface available — see the laboratory below',
    'Falha ao carregar — tente abrir em nova aba':'Loading failed — try opening in a new tab',
    'Chegue a menos de 4 m e reduza a velocidade abaixo de 0,35 m/s.':'Move within 4 m and reduce speed below 0.35 m/s.',
    'Aponte a frente do ROV para a rede por 3 s, a menos de 4 m.':'Point the front of the ROV toward the net for 3 s, within 4 m.',
    'A menos de 3,2 m do centro da hélice, segure Espaço por 4 s, devagar e apontando para a rede.':'Within 3.2 m of the propeller center, hold Space for 4 s, moving slowly and facing the net.',
    'Solte Espaço e recue para 3,2–4 m. Inspecione a hélice livre por 2 s.':'Release Space and move back to 3.2–4 m. Inspect the cleared propeller for 2 s.',
    'Missão concluída! Reinicie para tentar melhorar sua pontuação.':'Mission complete! Restart to try to improve your score.',
    'VOLTAR AO ROV':'RETURN TO ROV',
    'Carregando veículo…':'Loading vehicle…',
    'Veículo pronto':'Vehicle ready',
    'Modelo indisponível · veículo básico ativo':'Model unavailable · basic vehicle active',
    'Avanço / recuo':'Forward / reverse',
    'Lateral':'Lateral',
    'Vertical':'Vertical',
    'Guinada':'Yaw',
    'EXCESSO DE EMPUXO':'EXCESS THRUST',
    'FALTA DE EMPUXO':'INSUFFICIENT THRUST',
    'SIMULAÇÃO EM EXECUÇÃO':'SIMULATION RUNNING',
    'ENTRADA INVÁLIDA':'INVALID INPUT',
    'Corrija os campos destacados para calcular.':'Correct the highlighted fields to calculate.',
    'J ALÉM DO EMPUXO NULO':'J BEYOND ZERO THRUST',
    'EXTRAPOLAÇÃO / AVISO':'EXTRAPOLATION / WARNING',
    'Equilíbrio dentro de 2%.':'Balance within 2%.',
    'Falta empuxo: aumente RPM ou revise o passo.':'Insufficient thrust: increase RPM or adjust the pitch.',
    'Empuxo excedente: ajuste a rotação para a resistência da missão.':'Excess thrust: adjust RPM to the mission resistance.',
    'Alvo η₀ ≥ 65% atendido.':'Target η₀ ≥ 65% reached.',
    'Meta da missão: η₀ ≥ 65%.':'Mission target: η₀ ≥ 65%.',
    'A velocidade deve ser maior que zero.':'Speed must be greater than zero.',
    'A rotação informada não é válida para esta simulação.':'The specified RPM is invalid for this simulation.',
    'O diâmetro deve ser maior que zero.':'Diameter must be greater than zero.',
    'A densidade deve ser maior que zero.':'Density must be greater than zero.',
    'A viscosidade cinemática deve ser maior que zero.':'Kinematic viscosity must be greater than zero.',
    'O deslocamento deve ser maior que zero.':'Displacement must be greater than zero.',
    'O coeficiente de esteira deve ser maior ou igual a zero e menor que 1.':'The wake coefficient must be at least zero and less than 1.',
    'A Série B cobre de 2 a 7 pás.':'The B-series covers 2 to 7 blades.',
    'Velocidade fora da faixa recomendada (0,1–40 kn).':'Speed outside the recommended range (0.1–40 kn).',
    'Rotação fora da faixa recomendada (5–600 rpm).':'RPM outside the recommended range (5–600 rpm).',
    'Diâmetro fora da faixa recomendada (0,1–12 m).':'Diameter outside the recommended range (0.1–12 m).',
    'P/D fora da faixa de referência (0,50–1,40).':'P/D outside the reference range (0.50–1.40).',
    'Coeficiente de esteira acima de 0,50; confira a condição do casco.':'Wake coefficient above 0.50; check the hull condition.',
    'Coeficiente de esteira acima do limite de interface (0,60).':'Wake coefficient above the interface limit (0.60).',
    'Redução de empuxo fora da faixa recomendada (0–0,35).':'Thrust deduction outside the recommended range (0–0.35).',
    'Densidade fora da faixa recomendada (990–1035 kg/m³).':'Density outside the recommended range (990–1035 kg/m³).',
    'Deslocamento acima da faixa recomendada para a simulação dinâmica.':'Displacement above the recommended range for dynamic simulation.',
    'Viscosidade fora da faixa recomendada (0,8–1,8 × 10⁻⁶ m²/s).':'Viscosity outside the recommended range (0.8–1.8 × 10⁻⁶ m²/s).',
    'Rn ≤ 2×10⁶: correções de Reynolds e rugosidade não aplicadas; usando o polinômio A.':'Rn ≤ 2×10⁶: Reynolds and roughness corrections not applied; using polynomial A.',
    'KT ou KQ não positivo; eficiência em águas abertas indefinida.':'KT or KQ is not positive; open-water efficiency is undefined.',
    'Consultando último concurso da Lotofácil...':'Fetching the latest Lotofácil draw...',
    'Primeiro puxe os últimos concursos da Lotofácil.':'Fetch the latest Lotofácil draws first.',
    'Não foi possível acessar a API da Lotofácil.':'Unable to access the Lotofácil API.',
})
(site/'i18n-en.json').write_text(json.dumps(translations,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
files=list(site.glob('*.html'))+list((site/'projects').glob('*.html'))+[site/'projects/aeon-aqua/index.html']
for path in files:
    source=path.read_text(encoding='utf-8')
    if path.name=='index.html' and path.parent==site:
        source=source.replace('simula??o, propuls?o','simula&#231;&#227;o, propuls&#227;o')
    prefix='../' if path.parent==site/'projects' else '../../' if path.parent==site/'projects/aeon-aqua' else './'
    if path.name=='404.html':prefix='/'
    if 'src="'+prefix+'i18n.js"' not in source:
        source=source.replace('</head>',f'<link rel="stylesheet" href="{prefix}i18n.css"><script src="{prefix}i18n.js" defer></script></head>',1)
    path.write_text(source,encoding='utf-8')
print('English dictionary:',len(translations),'entries; language selection added to',len(files),'pages')
