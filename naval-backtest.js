(() => {
  const editor = document.getElementById('backtestConfig');
  if (!editor) return;
  const status = document.getElementById('backtestStatus');
  const start = document.getElementById('backtestStart');
  const cancel = document.getElementById('backtestCancel');
  const load = document.getElementById('backtestLoad');
  const file = document.getElementById('backtestFile');
  const profile = document.getElementById('backtestProfile');
  const objective = document.getElementById('backtestObjective');
  const apply = document.getElementById('backtestApply');
  const progress = document.getElementById('backtestProgress');
  const summary = document.getElementById('backtestSummary');
  let worker, results;
  function busy(value) { start.disabled=value || !editor.value; load.disabled=value; file.disabled=value || !editor.value; profile.disabled=value; objective.disabled=value; cancel.hidden=!value; progress.hidden=!value; }
  function table(rows) {
    const table=document.createElement('table');
    if (!rows.length) { const p=document.createElement('p'); p.textContent='Nenhuma combinação encontrada.'; return p; }
    const keys=Object.keys(rows[0]);
    const head=table.createTHead().insertRow();
    keys.forEach(key=>{const th=document.createElement('th'); th.scope='col'; th.textContent=key; head.append(th);});
    const body=table.createTBody();
    rows.forEach(row=>{const tr=body.insertRow(); keys.forEach(key=>{tr.insertCell().textContent=typeof row[key]==='number'?row[key].toLocaleString('pt-BR',{maximumFractionDigits:4}):String(row[key]??'—');});});
    return table;
  }
  function getWorker() {
    if (worker) return worker;
    worker=new Worker('naval-backtest-worker.js?v=diagnostic-1');
    worker.onerror=()=>{status.textContent='Falha ao carregar o cálculo. Verifique sua conexão e tente novamente.'; worker.terminate(); worker=null; busy(false);};
    worker.onmessage=({data})=>{
      if(data.type==='progress') {progress.value=data.total?data.completed/data.total:0; status.textContent=`Analisando ${data.completed.toLocaleString('pt-BR')} de ${data.total.toLocaleString('pt-BR')} combinações (${Math.round(progress.value*100)}%).`; return;}
      busy(false);
      if(data.type==='error') {status.textContent=data.message; return;}
      if(data.type==='config') {editor.value=JSON.stringify(data.config,null,2); objective.value=data.config.backtest.objetivo; start.disabled=false; file.disabled=false; status.textContent='Configuração pronta. Edite os dados do seu navio antes de executar.'; return;}
      results=data.result;
      document.getElementById('backtestResults').hidden=false;
      status.textContent=results.warning || 'Cálculo concluído. Potências por motor; consumo total em t/h.';
      document.getElementById('backtestFunnel').replaceChildren(table(results.funnel.map(([Etapa,Combinações])=>({Etapa,Combinações}))));
      const columns=['Z','P/D','Ae/Ao','D','rpm','eta0','BHP_kW','MCR_kW','RPM_MCR','FOC_t_h','Motores','motor_proximo','viol_rpm','viol_kw','viol_total','motivo_motor'];
      document.getElementById('backtestRanking').replaceChildren(table(results.ranking.map(row=>Object.fromEntries(columns.map(key=>[key,row[key]])))));
      document.getElementById('backtestCurve').replaceChildren(table(results.curve));
      apply.disabled=!results.ranking.length;
      const best=results.ranking[0];
      const label={rapido:'Rápido',completo:'Completo',detalhado:'Extremamente detalhado',personalizado:'Personalizado'}[results.profile];
      summary.textContent=best?`${label} · melhor resultado: ${best.Z} pás · D ${best.D.toFixed(3)} m · P/D ${best['P/D'].toFixed(3)} · AE/AO ${best['Ae/Ao'].toFixed(3)} · η₀ ${(best.eta0*100).toFixed(2)}% · ηD ${(best.etaD*100).toFixed(2)}% · BHP ${best.BHP_kW.toFixed(0)} kW/motor. ${results.warning}`:'Nenhuma hélice atende às restrições. Revise os intervalos e os dados do navio.';
      if(best)summary.textContent+=` Motor mais próximo: ${best.motor_proximo}; violação RPM ${(best.viol_rpm*100).toFixed(2)}%, potência ${(best.viol_kw*100).toFixed(2)}%, total ${(best.viol_total*100).toFixed(2)}%. ${results.limits.join('; ')}.`;
      document.getElementById('backtestMargins').textContent=`Margens: fator MCR/BHP ${results.marginFactors.bhp3.toFixed(9)}, fator RPM_MCR/rpm ${results.marginFactors.rpm3.toFixed(9)}. Potência após mar: ${(results.margins.bhp1??0).toFixed(1)} kW; após rotação: ${(results.margins.bhp2??0).toFixed(1)} kW; MCR: ${(results.margins.bhp3??0).toFixed(1)} kW. A margem de rotação entra na potência pelo cubo.`;
    };
    return worker;
  }
  function configuration() {const cfg=JSON.parse(editor.value); if(!cfg.navio || !cfg.helice) throw new Error('Informe uma configuração completa em JSON.'); return cfg;}
  load.onclick=()=>{busy(true); status.textContent='Carregando o cálculo e suas dependências…'; getWorker().postMessage({action:'init'});};
  start.onclick=()=>{try {const config=configuration(); config.backtest.objetivo=objective.value; results=null; apply.disabled=true; progress.value=0; document.getElementById('backtestResults').hidden=true; busy(true); status.textContent='Preparando a busca…'; getWorker().postMessage({action:'run',config,profile:profile.value});} catch(error) {status.textContent=error.message; busy(false);}};
  apply.onclick=()=>{if(!results?.ranking.length)return; document.dispatchEvent(new CustomEvent('naval:load-backtest',{detail:results})); document.querySelector('.sim-layout').scrollIntoView({behavior:'smooth',block:'start'}); status.textContent='Melhor hélice carregada na simulação acima. Clique em ATUALIZAR SIMULAÇÃO para iniciar a animação.';};
  cancel.onclick=()=>{worker?.terminate(); worker=null; busy(false); status.textContent='Cálculo cancelado.';};
  file.onchange=async()=>{const selected=file.files[0]; if(!selected)return; try{const config=configuration(); busy(true); status.textContent='Importando dados da planilha…'; getWorker().postMessage({action:'import',config,name:selected.name,bytes:await selected.arrayBuffer()});}catch(error){status.textContent=error.message; busy(false);}finally{file.value='';}};
  document.querySelectorAll('[data-backtest-download]').forEach(button=>{button.onclick=()=>{if(!results)return; const key=button.dataset.backtestDownload; const names={rankingCsv:'ranking.csv',diagnosticCsv:'diagnostico_motor.csv',configJson:'config_execucao.json',curveCsv:'curva_velocidades.csv',html:'relatorio.html'}; const url=URL.createObjectURL(new Blob([results[key]],{type:key==='html'?'text/html;charset=utf-8':key==='configJson'?'application/json;charset=utf-8':'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=names[key]; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);};});
})();
