/* Python runs off the main thread so the simulator remains responsive. */
let runtime;
const MODEL_VERSION = 'exploration-4';
async function initialize() {
  if (!runtime) runtime = (async () => {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.29.2/full/pyodide.js');
    const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/'});
    await py.loadPackage(['numpy', 'pandas']);
    // Write into Python's working directory, which is on its import path.
    const moduleDirectory = py.runPython('import os\nos.getcwd()');
    for (const name of ['propulsao', 'propulsao_busca']) {
      const response = await fetch(`projects/${name}.py?v=${MODEL_VERSION}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`Não foi possível carregar ${name}.py.`);
      py.FS.writeFile(`${moduleDirectory}/${name}.py`, await response.text());
    }
    const catalog = await fetch(`projects/motores.csv?v=${MODEL_VERSION}`, {cache:'no-store'});
    if (catalog.ok) py.FS.writeFile(`${moduleDirectory}/motores.csv`, await catalog.text());
    else if (catalog.status !== 404) throw new Error('Falha ao carregar o catálogo de motores.');
    py.runPython('import importlib\nimportlib.invalidate_caches()\nimport propulsao as p\nimport propulsao_busca as busca\nimport json, copy');
    const compatible = py.runPython(`
import inspect
getattr(p, 'WEB_API_VERSION', None) == 4 and getattr(busca, 'WEB_API_VERSION', None) == 4 and 'diagnostico_destino' in inspect.signature(busca.backtest_perfil).parameters and hasattr(busca, 'calibrar_motor')
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
    py.globals.set('search_progress', (completed, total) => self.postMessage({type:'progress', completed, total}));
    const result = await py.runPythonAsync(`
cfg = json.loads(config_json)
calibration_state = None
if calibration_enabled:
    g, fallback, funnel, resistance, cfg, calibration_state = busca.calibrar_motor(cfg, calibration_motor, calibration_level, json.loads(calibration_state_json), search_progress, '/diagnostico_motor.csv')
else:
    g, fallback, funnel, resistance, cfg = busca.backtest_perfil(cfg, search_profile, search_progress, diagnostico_destino='/diagnostico_motor.csv')
top = (g if len(g) else fallback).head(cfg['backtest']['top'])
warning = '' if len(top) and bool(top.iloc[0]['cabe_motor']) else ('Nenhuma combinação atende ao catálogo de motores. Ranking exploratório ordenado pela menor violação total.' if len(top) else 'Nenhuma hélice atende às restrições hidrodinâmicas.')
best = None if top.empty else (float(top.iloc[0]['D']), int(top.iloc[0]['Z']), float(top.iloc[0]['Ae/Ao']), float(top.iloc[0]['P/D']))
curve = p.curva_velocidades(cfg, best, float(top.iloc[0]['MCR_kW']) if best else None)
record = p.registro_execucao(cfg, funnel, search_profile)
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
json.dumps(dict(config=cfg, profile=search_profile, calibrationState=calibration_state, limits=limits, margins=margin_chain, marginFactors=p.margens(1, 1, cfg['margens']), resistanceCurve=simulation_curve, funnel=funnel, ranking=busca.json_records(top), curve=busca.json_records(curve), warning=warning, rankingCsv=top.to_csv(index=False), diagnosticCsv=open('/diagnostico_motor.csv', encoding='utf-8').read(), configJson=json.dumps(record, ensure_ascii=False, indent=2, default=float), curveCsv=curve.to_csv(index=False), html=open('/relatorio.html', encoding='utf-8').read()))
`);
    self.postMessage({type:'result', result:JSON.parse(result)});
  } catch(error) {
    runtime = undefined;
    self.postMessage({type:'error', message:String(error.message || error)});
  }
};
