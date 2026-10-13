/* Run with: node projects/test_propulsao_worker.cjs <path-to-pyodide-package> */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const simulation = require('../naval.js');

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
    fetch: async url => ({ok:true, text:async () => fs.readFileSync(path.join(__dirname, path.basename(url)), 'utf8')}),
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
  await context.self.onmessage({data:{action:'run', config, profile:'personalizado'}});
  const completed = messages.at(-1);
  assert.equal(completed.type, 'result', completed.message);
  assert.equal(completed.result.ranking.length, 1);
  assert.ok(completed.result.rankingCsv.includes('BHP_kW'));
  assert.ok(completed.result.curveCsv.includes('V_nos'));
  assert.ok(completed.result.html.includes('<!doctype html>'));
  const input=simulation.backtestInput(completed.result);
  const result=simulation.calculate(input);
  const row=completed.result.ranking[0];
  assert.ok(Math.abs(result.eta-row.eta0)<1e-8, 'Simulation efficiency differs from Python');
  assert.ok(Math.abs(result.etaD-row.etaD)<1e-8, 'Propulsive efficiency differs from Python');
  assert.ok(Math.abs(result.margin/result.resistance)<1e-8, 'Imported propeller is not in thrust balance');
  const details=simulation.operatingDetails(input,result);
  assert.ok(Math.abs(details.bhp/row.BHP_kW-1)<1e-8);
  assert.ok(Math.abs(details.foc/row.FOC_t_h-1)<1e-8);
  assert.ok(Math.abs(details.tau-row.tau_c)<1e-8);
  assert.equal(details.cavitation,true);
  // Verify scaling for two engines and two propellers, including mass units.
  config.navio.n_helices=2;
  config.navio.n_motores=2;
  config.navio.velocidade_nos=15;
  await context.self.onmessage({data:{action:'run',config,profile:'personalizado'}});
  const twin=messages.at(-1);
  assert.equal(twin.type,'result',twin.message);
  assert.equal(twin.result.ranking.length,1);
  const twinInput=simulation.backtestInput(twin.result);
  const twinResult=simulation.calculate(twinInput);
  assert.equal(twinInput.displacement,38437.5);
  assert.ok(Math.abs(twinResult.margin/twinResult.resistance)<1e-8);
  assert.ok(Math.abs(simulation.operatingDetails(twinInput,twinResult).bhp/twin.result.ranking[0].BHP_kW-1)<1e-8);
  assert.ok(messages.some(message=>message.type==='progress'&&message.completed===message.total));
  console.log('PASS: worker initialization, progress, backtest, downloads and simulation parity (single/twin propellers) passed in Pyodide.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
