/* Run with: node projects/test_propulsao_worker.cjs <path-to-pyodide-package> */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const {loadPyodide} = require(process.argv[2] || 'pyodide');
  const py = await loadPyodide();
  // Reproduce the original import failure using a minimal module.
  py.FS.writeFile('/propulsao_probe.py', 'value = 42');
  assert.throws(() => py.runPython('import propulsao_probe'), /ModuleNotFoundError/);
  const messages = [];
  const context = vm.createContext({
    importScripts() {},
    loadPyodide: async () => py,
    fetch: async () => ({ok:true, text:async () => fs.readFileSync(path.join(__dirname, 'propulsao.py'), 'utf8')}),
    self:{postMessage:message => messages.push(message)},
    Uint8Array,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'naval-backtest-worker.js'), 'utf8'), context);
  await context.self.onmessage({data:{action:'init'}});
  const ready = messages.at(-1);
  assert.equal(ready.type, 'config', ready.message);
  assert.equal(ready.config.navio.nome, 'Navio Holtrop');
  assert.equal(py.runPython('p.__file__'), '/home/pyodide/propulsao.py');
  assert.equal(py.runPython('bool(p.validar(p.CONFIG))'), true);
  // Exercise the real worker protocol, numerical pipeline, and downloads.
  const config = ready.config;
  config.helice.z = [4];
  config.helice.diametro = {min:8, max:8, passo:0.1};
  config.helice.ae_ao = {min:0.7, max:0.7, passo:0.05};
  config.helice.p_d = {min:0.85, max:0.85, passo:0.05};
  await context.self.onmessage({data:{action:'run', config}});
  const completed = messages.at(-1);
  assert.equal(completed.type, 'result', completed.message);
  assert.equal(completed.result.ranking.length, 1);
  assert.ok(completed.result.rankingCsv.includes('BHP_kW'));
  assert.ok(completed.result.curveCsv.includes('V_nos'));
  assert.ok(completed.result.html.includes('<!doctype html>'));
  console.log('PASS: original failure reproduced; worker initialization, validation, backtest and downloads passed in Pyodide.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
