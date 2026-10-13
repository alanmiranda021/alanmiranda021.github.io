(() => {
  const editor = document.getElementById('backtestConfig');
  if (!editor) return;
  const status = document.getElementById('backtestStatus');
  const start = document.getElementById('backtestStart');
  const cancel = document.getElementById('backtestCancel');
  const load = document.getElementById('backtestLoad');
  const file = document.getElementById('backtestFile');
  let worker, results;
  function busy(value) { start.disabled=value || !editor.value; load.disabled=value; file.disabled=value || !editor.value; cancel.hidden=!value; }
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
    worker=new Worker('naval-backtest-worker.js');
    worker.onerror=()=>{status.textContent='Falha ao carregar o cálculo. Verifique sua conexão e tente novamente.'; worker.terminate(); worker=null; busy(false);};
    worker.onmessage=({data})=>{
      busy(false);
      if(data.type==='error') {status.textContent=data.message; return;}
      if(data.type==='config') {editor.value=JSON.stringify(data.config,null,2); start.disabled=false; file.disabled=false; status.textContent='Configuração pronta. Edite os dados do seu navio antes de executar.'; return;}
      results=data.result;
      document.getElementById('backtestResults').hidden=false;
      status.textContent=results.warning || 'Cálculo concluído. Potências por motor; consumo total em t/h.';
      document.getElementById('backtestFunnel').replaceChildren(table(results.funnel.map(([Etapa,Combinações])=>({Etapa,Combinações}))));
      const columns=['Z','P/D','Ae/Ao','D','rpm','eta0','BHP_kW','MCR_kW','RPM_MCR','FOC_t_h','Motores'];
      document.getElementById('backtestRanking').replaceChildren(table(results.ranking.map(row=>Object.fromEntries(columns.map(key=>[key,row[key]])))));
      document.getElementById('backtestCurve').replaceChildren(table(results.curve));
    };
    return worker;
  }
  function configuration() {const cfg=JSON.parse(editor.value); if(!cfg.navio || !cfg.helice) throw new Error('Informe uma configuração completa em JSON.'); return cfg;}
  load.onclick=()=>{busy(true); status.textContent='Carregando o cálculo e suas dependências…'; getWorker().postMessage({action:'init'});};
  start.onclick=()=>{try {const config=configuration(); document.getElementById('backtestResults').hidden=true; busy(true); status.textContent='Calculando combinações de hélices…'; getWorker().postMessage({action:'run',config});} catch(error) {status.textContent=error.message; busy(false);}};
  cancel.onclick=()=>{worker?.terminate(); worker=null; busy(false); status.textContent='Cálculo cancelado.';};
  file.onchange=async()=>{const selected=file.files[0]; if(!selected)return; try{const config=configuration(); busy(true); status.textContent='Importando dados da planilha…'; getWorker().postMessage({action:'import',config,name:selected.name,bytes:await selected.arrayBuffer()});}catch(error){status.textContent=error.message; busy(false);}finally{file.value='';}};
  document.querySelectorAll('[data-backtest-download]').forEach(button=>{button.onclick=()=>{if(!results)return; const key=button.dataset.backtestDownload; const names={rankingCsv:'ranking.csv',curveCsv:'curva_velocidades.csv',html:'relatorio.html'}; const url=URL.createObjectURL(new Blob([results[key]],{type:key==='html'?'text/html;charset=utf-8':'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=names[key]; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);};});
})();
