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
  const mode=document.getElementById('backtestMode');
  const motor=document.getElementById('calibrationMotor');
  const level=document.getElementById('calibrationLevel');
  const blades=document.getElementById('searchBlades');
  let worker, results, calibration=null, nextRound;
  function busy(value) { start.disabled=value || !editor.value; load.disabled=value; file.disabled=value || !editor.value; profile.disabled=value; objective.disabled=value; mode.disabled=value; motor.disabled=value; level.disabled=value; blades.disabled=value; cancel.hidden=!value; progress.hidden=!value; }
  mode.onchange=()=>{document.getElementById('calibrationControls').hidden=mode.value!=='calibrate'; document.getElementById('backtestProfileField').hidden=mode.value==='calibrate'; start.textContent=mode.value==='calibrate'?'CALIBRAR E EXPLORAR ↗':'EXECUTAR BACKTEST ↗';};
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
    worker=new Worker('naval-backtest-worker.js?v=exploration-4-p0');
    const sourceWorker=worker;
    worker.onerror=()=>{if(worker!==sourceWorker)return;clearTimeout(nextRound);calibration=null;status.textContent='Falha ao carregar o cálculo. Verifique sua conexão e tente novamente.'; worker.terminate(); worker=null; busy(false);};
    worker.onmessage=({data})=>{
      if(worker!==sourceWorker)return;
      if(data.type==='progress') {progress.value=data.total?data.completed/data.total:0; status.textContent=`Analisando ${data.completed.toLocaleString('pt-BR')} de ${data.total.toLocaleString('pt-BR')} combinações (${Math.round(progress.value*100)}%).`; return;}
      busy(false);
      if(data.type==='error') {calibration=null; status.textContent=data.message; return;}
      if(data.type==='config') {editor.value=JSON.stringify(data.config,null,2); objective.value=data.config.backtest.objetivo; if(data.motors){const any=document.createElement('option');any.value='';any.textContent='Sem motor específico · comparar todo o catálogo';motor.replaceChildren(any,...data.motors.map(row=>{const option=document.createElement('option');option.value=row.modelo;option.textContent=`${row.modelo} · ${row.n_min}–${row.n_max} rpm · ${row.p_max_kw.toLocaleString('pt-BR')} kW`;return option;}));} start.disabled=false; file.disabled=false; status.textContent='Configuração pronta. Edite os dados do seu navio antes de executar.'; return;}
      results=data.result;
      document.getElementById('backtestResults').hidden=false;
      status.textContent=results.warning || 'Cálculo concluído. Potências por motor; consumo total em t/h.';
      document.getElementById('backtestFunnel').replaceChildren(table(results.funnel.map(([Etapa,Combinações])=>({Etapa,Combinações}))));
      const columns=['Z','P/D','Ae/Ao','D','rpm','eta0','BHP_kW','MCR_kW','RPM_MCR','FOC_t_h','Motores','motor_proximo','viol_rpm','viol_kw','viol_total','motivo_motor'];
      document.getElementById('backtestRanking').replaceChildren(table(results.ranking.map(row=>Object.fromEntries(columns.map(key=>[key,row[key]])))));
      document.getElementById('backtestCurve').replaceChildren(table(results.curve));
      apply.disabled=!results.ranking.length;
      const best=results.ranking[0];
      const diagnostic=document.getElementById('backtestDiagnostic');
      if(diagnostic){const d=results.viability,r=results.history?.at(-1);diagnostic.textContent=d?`${d.viavel?'Compatível com o motor.':'Nenhum motor do catálogo configurado atende às restrições deste candidato.'} Motor mais próximo: ${d.motor_proximo}. RPM de serviço ${d.rpm_motor_servico.toFixed(5)}; RPM MCR requerida ${d.rpm_motor_mcr.toFixed(5)}; faixa do motor ${d.rpm_motor_min}–${d.rpm_motor_max} rpm. MCR requerida ${d.mcr_kw.toFixed(5)} kW; envelope de potência ${d.potencia_min_kw.toFixed(5)}–${d.potencia_max_kw.toFixed(5)} kW na RPM limitada ao layout. ${d.restricoes_ativas.join('; ')}. ${d.transmissao}`:'Nenhum candidato chegou ao ranking hidrodinâmico.';if(r)diagnostic.textContent+=` Rodada ${r.rodada}: ${r.avaliados_brutos} avaliações, ${r.analisados_motor} analisadas por motor, ${r.rejeitados_antes_motor} rejeitadas antes do catálogo. Causas: ${Object.entries(r.rejeicoes_e_resultados).map(([key,value])=>key+': '+value).join('; ')}. O diagnóstico de restrições CSV é da última rodada; o histórico reúne as rodadas concluídas.`;}
      const label=results.config.calibracao?`Calibração ${results.config.calibracao.nivel}`:{rapido:'Rápido',completo:'Completo',detalhado:'Extremamente detalhado',personalizado:'Personalizado'}[results.profile];
      summary.textContent=best?`${label} · melhor resultado: ${best.Z} pás · D ${best.D.toFixed(3)} m · P/D ${best['P/D'].toFixed(3)} · AE/AO ${best['Ae/Ao'].toFixed(3)} · η₀ ${(best.eta0*100).toFixed(2)}% · ηD ${(best.etaD*100).toFixed(2)}% · BHP ${best.BHP_kW.toFixed(0)} kW/motor. ${results.warning}`:'Nenhuma hélice atende às restrições. Revise os intervalos e os dados do navio.';
      if(best)summary.textContent+=` ${results.config.calibracao?.motor?'Motor avaliado':'Motor mais próximo'}: ${best.motor_proximo}; violação RPM ${(best.viol_rpm*100).toFixed(2)}%, potência ${(best.viol_kw*100).toFixed(2)}%, total ${(best.viol_total*100).toFixed(2)}%. ${results.limits.join('; ')}.`;
      document.getElementById('backtestMargins').textContent=`Margens: fator MCR/BHP ${results.marginFactors.bhp3.toFixed(9)}, fator RPM_MCR/rpm ${results.marginFactors.rpm3.toFixed(9)}. Potência após mar: ${(results.margins.bhp1??0).toFixed(1)} kW; após rotação: ${(results.margins.bhp2??0).toFixed(1)} kW; MCR: ${(results.margins.bhp3??0).toFixed(1)} kW. A margem de rotação entra na potência pelo cubo.`;
      if(calibration&&results.calibrationState){
        const state=results.calibrationState;
        const info=results.config.calibracao;
        summary.textContent=`${calibration.motor?'Motor alvo: '+calibration.motor:'Todo o catálogo'} · rodada ${state.iteracao} · ${info.etapa} · pás avaliadas: ${info.pas_avaliadas.join(', ')} · ${state.avaliacoes.toLocaleString('pt-BR')} avaliações acumuladas. ${info.bloco_global?'Bloco global '+info.bloco_global+'/'+info.blocos_globais+'. ':''}${summary.textContent}`;
        const running=calibration.level==='infinita'||(calibration.level==='completo'&&state.iteracao<4);
        if(running){busy(true); status.textContent=`Calibração ${calibration.level} · rodada ${state.iteracao} concluída. Melhor resultado preservado; pode parar e exportar.`; nextRound=setTimeout(()=>{if(calibration)getWorker().postMessage({...calibration,action:'calibrate',state,history:results.history});},100);}
        else{calibration=null;if(results.ranking.length)loadResult(); status.textContent='Calibração concluída. '+(results.warning||'Melhor hélice compatível encontrada.')+(results.ranking.length?' Resultado carregado automaticamente na simulação acima.':'');}
      }
    };
    return worker;
  }
  function configuration() {const cfg=JSON.parse(editor.value); if(!cfg.navio || !cfg.helice) throw new Error('Informe uma configuração completa em JSON.'); return cfg;}
  load.onclick=()=>{busy(true); status.textContent='Carregando o cálculo e suas dependências…'; getWorker().postMessage({action:'init'});};
  start.onclick=()=>{try {const config=configuration(); config.backtest.objetivo=objective.value;if(blades.value==='all')config.helice.z=[2,3,4,5,6,7]; results=null; summary.textContent=''; calibration=null; clearTimeout(nextRound); apply.disabled=true; progress.value=0; document.getElementById('backtestResults').hidden=true; busy(true); status.textContent='Preparando a busca…'; if(mode.value==='calibrate'||profile.value==='infinita'){calibration={config,motor:mode.value==='calibrate'?motor.value:'',level:mode.value==='calibrate'?level.value:'infinita'}; getWorker().postMessage({...calibration,action:'calibrate'});}else getWorker().postMessage({action:'run',config,profile:profile.value});} catch(error) {calibration=null; status.textContent=error.message; busy(false);}};
  function loadResult(){if(!results?.ranking.length)return;document.dispatchEvent(new CustomEvent('naval:load-backtest',{detail:results}));document.querySelector('.sim-layout').scrollIntoView({behavior:'smooth',block:'start'});}
  apply.onclick=()=>{loadResult();status.textContent='Melhor hélice carregada na simulação acima. Clique em ATUALIZAR SIMULAÇÃO para iniciar a animação.';};
  cancel.onclick=()=>{clearTimeout(nextRound); const wasCalibration=!!calibration;calibration=null; worker?.terminate(); worker=null; busy(false);if(wasCalibration&&results?.ranking.length){loadResult();status.textContent='Calibração parada. Melhor resultado encontrado preservado para simular e exportar; carregado automaticamente acima.';}else status.textContent=wasCalibration?'Calibração parada antes de encontrar uma hélice válida. A simulação anterior foi preservada.':'Cálculo cancelado.';};
  file.onchange=async()=>{const selected=file.files[0]; if(!selected)return; try{const config=configuration(); busy(true); status.textContent='Importando dados da planilha…'; getWorker().postMessage({action:'import',config,name:selected.name,bytes:await selected.arrayBuffer()});}catch(error){status.textContent=error.message; busy(false);}finally{file.value='';}};
  document.querySelectorAll('[data-backtest-download]').forEach(button=>{button.onclick=()=>{if(!results)return; const key=button.dataset.backtestDownload; const names={rankingCsv:'ranking.csv',diagnosticCsv:'diagnostico_motor.csv',rejectionCsv:'diagnostico_restricoes.csv',historyCsv:'historico_busca.csv',historyJson:'historico_busca.json',configJson:'config_execucao.json',curveCsv:'curva_velocidades.csv',html:'relatorio.html'}; const url=URL.createObjectURL(new Blob([results[key]],{type:key==='html'?'text/html;charset=utf-8':['configJson','historyJson'].includes(key)?'application/json;charset=utf-8':'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=names[key]; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);};});
})();
