/* Python runs off the main thread so the simulator remains responsive. */
let runtime;
async function initialize() {
  if (!runtime) runtime = (async () => {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.29.2/full/pyodide.js');
    const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/'});
    await py.loadPackage(['numpy', 'pandas']);
    const response = await fetch('projects/propulsao.py');
    if (!response.ok) throw new Error('Não foi possível carregar o modelo Python.');
    py.FS.writeFile('/propulsao.py', await response.text());
    py.runPython('import propulsao as p\nimport json, copy');
    return py;
  })();
  return runtime;
}
self.onmessage = async ({data}) => {
  try {
    const py = await initialize();
    if (data.action === 'init') {
      self.postMessage({type:'config', config:JSON.parse(py.runPython('json.dumps(p.CONFIG)'))});
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
    const result = await py.runPythonAsync(`
cfg = json.loads(config_json)
p.validar_config(cfg)
g, fallback, funnel, resistance = p.backtest(cfg, verbose=False)
top = (g if len(g) else fallback).head(cfg['backtest']['top'])
warning = '' if len(g) else 'Nenhuma combinação atende ao catálogo de motores. O ranking abaixo é exploratório, sem aprovação de motor.'
best = None if top.empty else (float(top.iloc[0]['D']), int(top.iloc[0]['Z']), float(top.iloc[0]['Ae/Ao']), float(top.iloc[0]['P/D']))
curve = p.curva_velocidades(cfg, best, float(top.iloc[0]['MCR_kW']) if best else None)
p.relatorio_html(cfg, top, funnel, curve, '/relatorio.html', warning)
json.dumps(dict(funnel=funnel, ranking=json.loads(top.to_json(orient='records')), curve=json.loads(curve.to_json(orient='records')), warning=warning, rankingCsv=top.to_csv(index=False), curveCsv=curve.to_csv(index=False), html=open('/relatorio.html', encoding='utf-8').read()))
`);
    self.postMessage({type:'result', result:JSON.parse(result)});
  } catch(error) {
    runtime = undefined;
    self.postMessage({type:'error', message:String(error.message || error)});
  }
};
