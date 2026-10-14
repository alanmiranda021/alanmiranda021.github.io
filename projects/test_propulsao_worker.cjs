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
    fetch: async (url, options) => {
      assert.ok(url.includes('?v=exploration-4'));
      assert.equal(options.cache,'no-store');
      return {ok:true, text:async () => fs.readFileSync(path.join(__dirname, '..', url.split('?')[0]), 'utf8')};
    },
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
  assert.ok(completed.result.diagnosticCsv.includes('viol_total'));
  assert.ok(completed.result.rejectionCsv.includes('analisado_motor'));
  assert.equal(completed.result.history[0].avaliados_brutos,1);
  assert.equal(completed.result.history[0].analisados_motor,1);
  assert.equal(JSON.parse(completed.result.historyJson).length,1);
  assert.ok(completed.result.historyCsv.includes('rejeitados_antes_motor'));
  assert.equal(completed.result.viability.rpm_motor_servico,completed.result.ranking[0].rpm);
  assert.equal(completed.result.bladeSummary.length,6);
  assert.equal(completed.result.bladeSummary.find(entry=>entry.Z===4).geradas_rodada,1);
  assert.equal(completed.result.bladeSummary.find(entry=>entry.Z===2).status,'EXCLUIDA_CONFIG');
  const entry=completed.result.propellerCurves[0];
  const operatingSample=entry.curve.find(sample=>sample.J===entry.row.J);
  assert.ok(Math.abs(operatingSample.KT-entry.row.KTs)<1e-12);
  assert.ok(Math.abs(operatingSample.KQ-entry.row.KQs)<1e-12);
  assert.ok(Math.abs(operatingSample.eta0-entry.row.eta0)<1e-12);
  const pdf=require('../naval-pdf.js');
  const report={title:'Curvas de teste calculadas no Pyodide',config:JSON.parse(completed.result.configJson),entries:[entry]};
  const pdfBytes=pdf.build(report);
  assert.equal(Buffer.from(pdfBytes).subarray(0,8).toString(),'%PDF-1.7');
  fs.writeFileSync(path.join(require('node:os').tmpdir(),'naval-curvas-teste.pdf'),pdfBytes);
  const record=JSON.parse(completed.result.configJson);
  assert.equal(record.catalogo.length,56);
  assert.equal(record.perfil,'personalizado');
  assert.equal(record.config.helice.diametro.max,8);
  assert.equal(record.combinacoes_geradas,1);
  assert.equal(record.fontes_sha256['naval.js'].bytes_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..','naval.js'))).digest('hex'));
  assert.equal(record.fontes_sha256['projects/propulsao_busca.py'].bytes_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'propulsao_busca.py'))).digest('hex'));
  assert.ok(completed.result.limits.some(warning=>warning.includes('limite de D')));
  assert.ok(completed.result.curve.some(row=>row.status_envelope==='abaixo da faixa SFOC'&&row.FOC_t_h===null));
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
  await context.self.onmessage({data:{action:'calibrate',config,motor:'8G90ME-C10.5',level:'rapido'}});
  const calibration=messages.at(-1);
  assert.equal(calibration.type,'result',calibration.message);
  assert.equal(calibration.result.calibrationState.iteracao,1);
  assert.equal(calibration.result.config.calibracao.motor,'8G90ME-C10.5');
  assert.ok(calibration.result.ranking.every(row=>row.motor_proximo==='8G90ME-C10.5'));
  await context.self.onmessage({data:{action:'calibrate',config,motor:'8G90ME-C10.5',level:'completo',state:calibration.result.calibrationState,history:calibration.result.history,bladeState:calibration.result.bladeSummary}});
  const second=messages.at(-1);
  assert.equal(second.type,'result',second.message);
  assert.equal(second.result.history.length,2);
  assert.equal(second.result.history[1].rodada,2);
  assert.equal(second.result.history[1].avaliados_brutos,second.result.funnel[0][1]);
  assert.equal(second.result.bladeSummary.find(entry=>entry.Z===4).avaliacoes_acumuladas,2);
  await context.self.onmessage({data:{action:'calibrate',config,motor:'',level:'infinita'}});
  const general=messages.at(-1);
  assert.equal(general.type,'result',general.message);
  assert.equal(general.result.config.calibracao.motor,null);
  assert.equal(JSON.parse(general.result.configJson).catalogo.length,56);
  // A stale module must fail at initialization with a clear message, before
  // the worker calls backtest_perfil with unsupported keyword arguments.
  py.runPython('original_backtest = busca.backtest_perfil\nbusca.backtest_perfil = lambda cfg: None');
  const staleMessages=[];
  const staleContext=vm.createContext({importScripts:context.importScripts,loadPyodide:context.loadPyodide,fetch:context.fetch,self:{postMessage:message=>staleMessages.push(message)},Uint8Array});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','naval-backtest-worker.js'),'utf8'),staleContext);
  await staleContext.self.onmessage({data:{action:'init'}});
  assert.equal(staleMessages.at(-1).type,'error');
  assert.match(staleMessages.at(-1).message,/versões diferentes/);
  assert.ok(!staleMessages.at(-1).message.includes('Traceback'));
  py.runPython('busca.backtest_perfil = original_backtest');
  console.log('PASS: worker initialization, progress, backtest, downloads and simulation parity (single/twin propellers) passed in Pyodide.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
