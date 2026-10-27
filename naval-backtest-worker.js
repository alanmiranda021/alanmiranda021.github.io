/* Python runs off the main thread so the simulator remains responsive. */
let runtime;
const MODEL_VERSION = 'exploration-4';
const DELIVERY_VERSION = 'exploration-4-pas-pdf';
async function initialize() {
  if (!runtime) runtime = (async () => {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.29.2/full/pyodide.js');
    const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/'});
    await py.loadPackage(['numpy', 'pandas']);
    // Write into Python's working directory, which is on its import path.
    const moduleDirectory = py.runPython('import os\nos.getcwd()');
    for (const name of ['propulsao', 'propulsao_busca', 'propulsao_auditoria']) {
      const response = await fetch(`projects/${name}.py?v=${DELIVERY_VERSION}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`Não foi possível carregar ${name}.py.`);
      py.FS.writeFile(`${moduleDirectory}/${name}.py`, await response.text());
    }
    const catalog = await fetch(`projects/motores.csv?v=${DELIVERY_VERSION}`, {cache:'no-store'});
    if (catalog.ok) py.FS.writeFile(`${moduleDirectory}/motores.csv`, await catalog.text());
    else if (catalog.status !== 404) throw new Error('Falha ao carregar o catálogo de motores.');
    const browserSources = {};
    for (const name of ['naval.js','naval-pdf.js','naval-backtest.js','naval-backtest-worker.js','naval.html','naval.css']) {
      const source = await fetch(`${name}?v=${DELIVERY_VERSION}`, {cache:'no-store'});
      if (!source.ok) throw new Error(`Não foi possível registrar a versão de ${name}.`);
      browserSources[name] = await source.text();
    }
    py.globals.set('browser_sources_json', JSON.stringify(browserSources));
    py.runPython('import importlib\nimportlib.invalidate_caches()\nimport propulsao as p\nimport propulsao_busca as busca\nimport propulsao_auditoria as audit\nimport json, copy, hashlib\nbrowser_hashes = {name: dict(bytes_sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(), lf_sha256=hashlib.sha256(content.replace("\\r\\n", "\\n").encode("utf-8")).hexdigest()) for name, content in json.loads(browser_sources_json).items()}');
    const compatible = py.runPython(`
import inspect
getattr(p, 'WEB_API_VERSION', None) == 4 and getattr(busca, 'WEB_API_VERSION', None) == 4 and 'diagnostico_destino' in inspect.signature(busca.backtest_perfil).parameters and 'auditoria' in inspect.signature(busca.backtest_perfil).parameters and 'auditoria' in inspect.signature(p.backtest).parameters and hasattr(busca, 'calibrar_motor') and hasattr(audit.AuditoriaFunil, 'resumo_pas')
`);
    if (!compatible) throw new Error('Os arquivos de cálculo estão em versões diferentes. Aguarde a atualização do site e recarregue a página com Ctrl+F5.');
    return py;
  })();
  return runtime;
}
self.onmessage = async ({data}) => {
  try {
    const py = await initialize();
    if (data.action === 'init') {
      self.postMessage({type:'config', config:JSON.parse(py.runPython('json.dumps(p.CONFIG)')), motors:JSON.parse(py.runPython('json.dumps([dict(zip(["modelo", "n_min", "n_max", "p_max_kw", "p_min_kw"], row)) for row in p.carregar_motores(p.CONFIG)], default=float)'))});
      return;
    }
    if (data.action === 'import') {
      const extension = data.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls';
      await py.loadPackage(extension === 'xlsx' ? 'openpyxl' : 'xlrd');
      py.FS.writeFile('/entrada.' + extension, new Uint8Array(data.bytes));
      py.globals.set('input_path', '/entrada.' + extension);
      py.globals.set('config_json', JSON.stringify(data.config));
      const config = py.runPython('cfg = json.loads(config_json)\nnv, hel = p.importar_planilha(input_path)\ncfg["navio"].update(nv)\njson.dumps(cfg)');
      self.postMessage({type:'config', config:JSON.parse(config)});
      return;
    }
    py.globals.set('config_json', JSON.stringify(data.config));
    py.globals.set('search_profile', data.profile || 'completo');
    py.globals.set('calibration_enabled', data.action === 'calibrate');
    py.globals.set('calibration_motor', data.motor || '');
    py.globals.set('calibration_level', data.level || 'rapido');
    py.globals.set('calibration_state_json', JSON.stringify(data.state || null));
    py.globals.set('search_history_json', JSON.stringify(data.history || []));
    py.globals.set('blade_state_json', JSON.stringify(data.bladeState || []));
    py.globals.set('search_progress', (completed, total) => self.postMessage({type:'progress', completed, total}));
    const result = await py.runPythonAsync(`
cfg = json.loads(config_json)
calibration_state = None
history = json.loads(search_history_json)
observer = audit.AuditoriaFunil('/diagnostico_restricoes.csv', len(history)+1, cfg)
if calibration_enabled:
    g, fallback, funnel, resistance, cfg, calibration_state = busca.calibrar_motor(cfg, calibration_motor, calibration_level, json.loads(calibration_state_json), search_progress, '/diagnostico_motor.csv', auditoria=observer.registrar)
else:
    g, fallback, funnel, resistance, cfg = busca.backtest_perfil(cfg, search_profile, search_progress, diagnostico_destino='/diagnostico_motor.csv', auditoria=observer.registrar)
top = (g if len(g) else fallback).head(cfg['backtest']['top'])
best_record = None if top.empty else busca.json_records(top.head(1))[0]
round_record = observer.finalizar(cfg, funnel, best_record, cfg.get('calibracao', dict(perfil=search_profile, malha=cfg['helice'])))
round_record['fontes_sha256'] = audit.hashes_fontes(browser_hashes)
round_record['RT'] = float(resistance['RT'])
round_record['EHP_kW'] = float(resistance['EHP_kW'])
history.append(round_record)
blade_summary = observer.resumo_pas(cfg, json.loads(blade_state_json))
round_record['por_pas'] = [{key:value for key,value in entry.items() if key != 'ranking'} for entry in blade_summary]
def propeller_curve(row):
    js = sorted(set([float(value) for value in p.np.linspace(0, 1.5, 301)] + [float(row['J'])]))
    n = float(row['rpm']) / 60
    va = p.np.array(js) * n * float(row['D'])
    kt, kq, efficiency, rn = p.serie_b(p.np.array(js), row['P/D'], row['Ae/Ao'], row['Z'], row['D'], va, n, cfg['agua']['mu']/cfg['agua']['rho'])
    return [dict(J=j, KT=audit.seguro(float(kt[i])), KQ=audit.seguro(float(kq[i])), eta0=audit.seguro(float(efficiency[i])) if kt[i]>0 and kq[i]>0 and 0<=efficiency[i]<=1 else None) for i,j in enumerate(js)]
curve_candidates = list(top.to_dict(orient='records')) + [row for category in blade_summary for row in category['ranking']]
propeller_curves = {}
for candidate in curve_candidates:
    identity = '|'.join(str(candidate[key]) for key in ('Z','D','Ae/Ao','P/D'))
    if identity not in propeller_curves:
        propeller_curves[identity] = dict(row={key:audit.seguro(value) for key,value in candidate.items()}, curve=propeller_curve(candidate), diagnostic=audit.diagnosticar_viabilidade(candidate,cfg))
viability = None if top.empty else audit.diagnosticar_viabilidade(best_record, cfg)
warning = '' if len(top) and bool(top.iloc[0]['cabe_motor']) else ('Nenhuma combinação atende ao catálogo de motores. Ranking exploratório ordenado pela menor violação total.' if len(top) else 'Nenhuma hélice atende às restrições hidrodinâmicas.')
best = None if top.empty else (float(top.iloc[0]['D']), int(top.iloc[0]['Z']), float(top.iloc[0]['Ae/Ao']), float(top.iloc[0]['P/D']))
curve = p.curva_velocidades(cfg, best, float(top.iloc[0]['MCR_kW']) if best else None)
record = p.registro_execucao(cfg, funnel, search_profile)
record['fontes_sha256'] = audit.hashes_fontes(browser_hashes)
record['historico_busca'] = history
record['diagnostico_viabilidade'] = viability
record['por_pas'] = blade_summary
if calibration_enabled:
    record['perfil'] = 'calibracao_' + calibration_level
    record['calibracao_estado'] = calibration_state
p.relatorio_html(cfg, top, funnel, curve, '/relatorio.html', warning, record)
limits = [] if top.empty else p.avisos_limites(cfg, top.iloc[0])
margin_chain = {} if top.empty else p.margens(float(top.iloc[0]['BHP_kW']), float(top.iloc[0]['rpm']), cfg['margens'])
simulation_curve = [{'speed': 0.0, 'resistance': 0.0}]
speeds = sorted(set([float(v) for v in p.np.linspace(0.5, max(40, cfg['navio']['velocidade_nos']), 100)] + [float(cfg['navio']['velocidade_nos'])]))
for speed in speeds:
    simulation_curve.append(dict(speed=speed, resistance=float(p.resistencia(cfg['navio'], cfg['agua'], speed, cfg['compat_planilha'])['RT']) * 1000))
json.dumps(dict(bladeSummary=blade_summary, propellerCurves=list(propeller_curves.values()), history=history, historyJson=json.dumps(history, ensure_ascii=False, indent=2, allow_nan=False), historyCsv=audit.historico_csv(history), rejectionCsv=open('/diagnostico_restricoes.csv', encoding='utf-8').read(), viability=viability, config=cfg, profile=search_profile, calibrationState=calibration_state, limits=limits, margins=margin_chain, marginFactors=p.margens(1, 1, cfg['margens']), resistanceCurve=simulation_curve, funnel=funnel, ranking=busca.json_records(top), curve=busca.json_records(curve), warning=warning, rankingCsv=top.to_csv(index=False), diagnosticCsv=open('/diagnostico_motor.csv', encoding='utf-8').read(), configJson=json.dumps(record, ensure_ascii=False, indent=2, default=float), curveCsv=curve.to_csv(index=False), html=open('/relatorio.html', encoding='utf-8').read()))
`);
    self.postMessage({type:'result', result:JSON.parse(result)});
  } catch(error) {
    runtime = undefined;
    self.postMessage({type:'error', message:String(error.message || error)});
  }
};
