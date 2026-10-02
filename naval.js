(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.NavalSimulation = engine;
  if (root && root.document) engine.mount(root.document);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KT_TERMS = [
    [.00880496,0,0,0,0],[-.204554,1,0,0,0],[.166351,0,1,0,0],[.158114,0,2,0,0],[-.147581,2,0,1,0],[-.481497,1,1,1,0],[.415437,0,2,1,0],[.0144043,0,0,0,1],[-.0530054,2,0,0,1],[.0143481,0,1,0,1],[.0606826,1,1,0,1],[-.0125894,0,0,1,1],[.0109689,1,0,1,1],[-.133698,0,3,0,0],[.00638407,0,6,0,0],[-.00132718,2,6,0,0],[.168496,3,0,1,0],[-.0507214,0,0,2,0],[.0854559,2,0,2,0],[-.0504475,3,0,2,0],[.010465,1,6,2,0],[-.00648272,2,6,2,0],[-.00841728,0,3,0,1],[.01684246,1,3,0,1],[-.00102296,3,3,0,1],[-.0317791,0,3,1,1],[.018604,1,0,2,1],[-.00410798,0,2,2,1],[-.000606848,0,0,0,2],[-.0049819,1,0,0,2],[.0025983,2,0,0,2],[-.000560528,3,0,0,2],[-.00163652,1,2,0,2],[-.000328787,1,6,0,2],[.000116502,2,6,0,2],[.000690904,0,0,1,2],[.00421749,0,3,1,2],[.00005652229,3,6,1,2],[-.00146564,0,3,2,2]
  ];
  const KQ_TERMS = [
    [.00379368,0,0,0,0],[.00886523,2,0,0,0],[-.032241,1,1,0,0],[.00344778,0,2,0,0],[-.0408811,0,1,1,0],[-.108009,1,1,1,0],[-.0885381,2,1,1,0],[.188561,0,2,1,0],[-.00370871,1,0,0,1],[.00513696,0,1,0,1],[.0209449,1,1,0,1],[.00474319,2,1,0,1],[-.00723408,2,0,1,1],[.00438388,1,1,1,1],[-.0269403,0,2,1,1],[.0558082,3,0,1,0],[.0161886,0,3,1,0],[.00318086,1,3,1,0],[.015896,0,0,2,0],[.0471729,1,0,2,0],[.0196283,3,0,2,0],[-.0502782,0,1,2,0],[-.030055,3,1,2,0],[.0417122,2,2,2,0],[-.0397722,0,3,2,0],[-.00350024,0,6,2,0],[-.0106854,3,0,0,1],[.00110903,3,3,0,1],[-.000313912,0,6,0,1],[.0035985,3,0,1,1],[-.00142121,0,6,1,1],[-.00383637,1,0,2,1],[.0126803,0,2,2,1],[-.00318278,2,3,2,1],[.00334268,0,6,2,1],[-.00183491,1,1,0,2],[.000112451,3,2,0,2],[-.0000297228,3,6,0,2],[.000269551,1,0,1,2],[.00083265,2,0,1,2],[.00155334,0,2,1,2],[.000302683,0,6,1,2],[-.0001843,0,0,2,2],[-.000425399,0,3,2,2],[.0000869243,3,3,2,2],[-.0004659,0,6,2,2],[.0000554194,1,6,2,2]
  ];
  const AREA_LIMITS = {2:[.30,.38],3:[.35,.80],4:[.40,1],5:[.45,1.05],6:[.50,.80],7:[.55,.85]};
  const DEFAULTS = { speed:12,rpm:100,diameter:5,blades:4,pd:.75,area:.74,wake:.20,deduction:.16,rho:1025,displacement:10000,nu:1.1883e-6,etaR:1,level:'C' };
  const KN_TO_MS = 1852 / 3600;
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const poly = (terms,j,pd,area,blades) => terms.reduce((sum,[c,s,t,u,v]) => sum+c*Math.pow(j,s)*Math.pow(pd,t)*Math.pow(area,u)*Math.pow(blades,v),0);

  function reynoldsCorrection(j,pd,area,blades,reynolds) {
    const L=Math.log10(reynolds)-.301, z=blades, a=area, p=pd;
    const dKT=.000353485-.00333758*a*j*j-.00478125*a*p*j+.000257792*L*L*a*j*j+.0000643192*L*Math.pow(p,6)*j*j-.0000110636*L*L*Math.pow(p,6)*j*j-.0000276305*L*L*z*a*j*j+.0000954*L*z*a*p*j+.0000032049*L*z*z*a*Math.pow(p,3)*j;
    const dKQ=-.000591412+.00696898*p-.0000666654*z*Math.pow(p,6)+.0160818*a*a-.000938091*L*p-.00059593*L*p*p+.0000782099*L*L*p*p+.0000052199*L*z*a*j*j-.00000088528*L*L*z*a*p*j+.0000230171*L*z*Math.pow(p,6)-.00000184341*L*L*z*Math.pow(p,6)-.00400252*L*a*a+.000220915*L*L*a*a;
    return {dKT,dKQ};
  }

  function calculateAtJ(input,j,level,reynolds,roughness) {
    let kt=poly(KT_TERMS,j,input.pd,input.area,input.blades);
    let kq=poly(KQ_TERMS,j,input.pd,input.area,input.blades);
    if(level!=='A' && reynolds>2e6){const correction=reynoldsCorrection(j,input.pd,input.area,input.blades,reynolds);kt+=correction.dKT;kq+=correction.dKQ;}
    if(level==='C' && reynolds>2e6){kt+=roughness.dKT;kq+=roughness.dKQ;}
    return {kt,kq,eta:j>0&&kt>0&&kq>0?j*kt/(2*Math.PI*kq):0};
  }

  function findJZero(input,level,reynolds,roughness) {
    let previous=0, previousKT=calculateAtJ(input,0,level,reynolds,roughness).kt;
    for(let j=.002;j<=2;j+=.002){
      const kt=calculateAtJ(input,j,level,reynolds,roughness).kt;
      if(previousKT>0&&kt<=0){let low=previous,high=j;for(let i=0;i<55;i++){const mid=(low+high)/2;if(calculateAtJ(input,mid,level,reynolds,roughness).kt>0)low=mid;else high=mid;}return (low+high)/2;}
      previous=j;previousKT=kt;
    }
    return previous;
  }

  function calculate(input) {
    const errors=[];
    if(!(input.speed>0))errors.push('A velocidade deve ser maior que zero.');
    if(!(input.rpm>0))errors.push('A rotação informada não é válida para esta simulação.');
    if(!(input.diameter>0))errors.push('O diâmetro deve ser maior que zero.');
    if(!(input.rho>0))errors.push('A densidade deve ser maior que zero.');
    if(!(input.nu>0))errors.push('A viscosidade cinemática deve ser maior que zero.');
    if(!(input.displacement>0))errors.push('O deslocamento deve ser maior que zero.');
    if(input.wake<0||input.wake>=1)errors.push('O coeficiente de esteira deve ser maior ou igual a zero e menor que 1.');
    if(!Number.isInteger(input.blades)||input.blades<2||input.blades>7)errors.push('A Série B cobre de 2 a 7 pás.');
    if(errors.length)return {errors};
    const velocity=input.speed*KN_TO_MS, advance=velocity*(1-input.wake), n=input.rpm/60;
    const j=advance/(n*input.diameter), chord=2.073*input.area*input.diameter/input.blades;
    const reynolds=chord*Math.hypot(advance,.75*Math.PI*n*input.diameter)/input.nu;
    const level=input.level!=='A'&&reynolds<=2e6?'A':input.level;
    const tc=(.0185-.00125*input.blades)*input.diameter/chord;
    const deltaCd=(2+4*tc)*(.003605-Math.pow(1.89+1.62*Math.log10(chord/30e-6),-2.5));
    const roughness={dKT:.3*deltaCd*input.pd*chord*input.blades/input.diameter,dKQ:-.25*deltaCd*chord*input.blades/input.diameter};
    const jZero=findJZero(input,level,reynolds,roughness);
    const {kt,kq,eta}=calculateAtJ(input,j,level,reynolds,roughness);
    const thrust=kt*input.rho*n*n*Math.pow(input.diameter,4), torque=kq*input.rho*n*n*Math.pow(input.diameter,5);
    const power=2*Math.PI*n*torque, netThrust=thrust*(1-input.deduction);
    const resistance=150400*Math.pow(input.speed/12,2), margin=netThrust-resistance;
    const etaH=(1-input.deduction)/(1-input.wake), etaD=eta*etaH*input.etaR;
    const warnings=[];
    if(input.speed<.1||input.speed>40)warnings.push('Velocidade fora da faixa recomendada (0,1–40 kn).');
    if(input.rpm<5||input.rpm>600)warnings.push('Rotação fora da faixa recomendada (5–600 rpm).');
    if(input.diameter<.1||input.diameter>12)warnings.push('Diâmetro fora da faixa recomendada (0,1–12 m).');
    if(input.pd<.5||input.pd>1.4)warnings.push('P/D fora da faixa de referência (0,50–1,40).');
    const areaRange=AREA_LIMITS[input.blades];
    if(input.area<areaRange[0]||input.area>areaRange[1])warnings.push(`AE/AO fora da faixa para Z=${input.blades} (${areaRange[0].toFixed(2)}–${areaRange[1].toFixed(2)}).`);
    if(input.wake>.5)warnings.push('Coeficiente de esteira acima de 0,50; confira a condição do casco.');
    if(input.wake>.6)warnings.push('Coeficiente de esteira acima do limite de interface (0,60).');
    if(input.deduction<0||input.deduction>.35)warnings.push('Redução de empuxo fora da faixa recomendada (0–0,35).');
    if(input.rho<990||input.rho>1035)warnings.push('Densidade fora da faixa recomendada (990–1035 kg/m³).');
    if(input.displacement>500000)warnings.push('Deslocamento acima da faixa recomendada para a simulação dinâmica.');
    if(input.nu<.8e-6||input.nu>1.8e-6)warnings.push('Viscosidade fora da faixa recomendada (0,8–1,8 × 10⁻⁶ m²/s).');
    if(level!==input.level)warnings.push('Rn ≤ 2×10⁶: correções de Reynolds e rugosidade não aplicadas; usando o polinômio A.');
    if(j>=jZero)warnings.push(`J = ${j.toFixed(3)} está além do ponto de empuxo nulo (J₀ ≈ ${jZero.toFixed(3)}); η₀ não é definido.`);
    if(kt<=0||kq<=0)warnings.push('KT ou KQ não positivo; eficiência em águas abertas indefinida.');
    const steps=[
      {name:'Velocidade de avanço',formula:'Va = V × (1852/3600) × (1 − w)',substitution:`${input.speed} × 0,514444… × (1 − ${input.wake.toFixed(2)})`,value:advance,unit:'m/s'},
      {name:'Rotação em rotações por segundo',formula:'n = RPM / 60',substitution:`${input.rpm} / 60`,value:n,unit:'rps'},
      {name:'Coeficiente de avanço',formula:'J = Va / (n × D)',substitution:`${advance.toFixed(4)} / (${n.toFixed(4)} × ${input.diameter.toFixed(2)})`,value:j,unit:'—'},
      {name:'Número de Reynolds em 0,75R',formula:'Rn₀,₇₅R = c₀,₇₅R × √(Va² + (0,75πnD)²) / ν',substitution:`${chord.toFixed(4)} × velocidade relativa / ${input.nu.toExponential(4)}`,value:reynolds,unit:'—'},
      {name:'Coeficiente de empuxo',formula:`KT = Σ₃₉ CᵢJˢ(P/D)ᵗ(AE/AO)ᵘZᵛ ${level==='A'?'':' + correções'}`,substitution:`J=${j.toFixed(4)}, P/D=${input.pd.toFixed(2)}, AE/AO=${input.area.toFixed(2)}, Z=${input.blades}`,value:kt,unit:'—'},
      {name:'Coeficiente de torque',formula:`KQ = Σ₄₇ CᵢJˢ(P/D)ᵗ(AE/AO)ᵘZᵛ ${level==='A'?'':' + correções'}`,substitution:`J=${j.toFixed(4)}, P/D=${input.pd.toFixed(2)}, AE/AO=${input.area.toFixed(2)}, Z=${input.blades}`,value:kq,unit:'—'},
      {name:'Empuxo',formula:'T = KT × ρ × n² × D⁴',substitution:`${kt.toFixed(6)} × ${input.rho} × ${n.toFixed(4)}² × ${input.diameter.toFixed(2)}⁴`,value:thrust/1000,unit:'kN'},
      {name:'Torque',formula:'Q = KQ × ρ × n² × D⁵',substitution:`${kq.toFixed(6)} × ${input.rho} × ${n.toFixed(4)}² × ${input.diameter.toFixed(2)}⁵`,value:torque/1000,unit:'kN·m'},
      {name:'Potência entregue ao hélice',formula:'Pᴅ = 2πnQ',substitution:`2π × ${n.toFixed(4)} × ${(torque/1000).toFixed(3)}`,value:power/1000,unit:'kW'},
      {name:'Eficiência em águas abertas',formula:'η₀ = J × KT / (2π × KQ)',substitution:`${j.toFixed(4)} × ${kt.toFixed(6)} / (2π × ${kq.toFixed(6)})`,value:eta*100,unit:'%'}
    ];
    return {input:{...input},velocity,advance,n,j,chord,reynolds,kt,kq,eta,thrust,torque,power,netThrust,resistance,margin,etaH,etaD,jZero,level,warnings,errors,steps,roughness,deltaCd};
  }

  function mount(doc) {
    const form=doc.getElementById('simForm');
    if(!form)return;
    const $=id=>doc.getElementById(id), inputs=Object.fromEntries([...form.elements].filter(el=>el.name).map(el=>[el.name,el]));
    let currentInput={...DEFAULTS},result=null,challenge=false,timer=0;
    const fmt=(value,digits=3)=>Number.isFinite(value)?new Intl.NumberFormat('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):'—';
    const fmtPower=value=>Number.isFinite(value)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(value):'—';
    const readInput=()=>({speed:Number(inputs.speed.value),rpm:Number(inputs.rpm.value),diameter:Number(inputs.diameter.value),blades:Number(inputs.blades.value),pd:Number(inputs.pd.value),area:Number(inputs.area.value),wake:Number(inputs.wake.value),deduction:Number(inputs.deduction.value),rho:Number(inputs.rho.value),displacement:Number(inputs.displacement.value),nu:Number(inputs.nu.value),etaR:1,level:currentInput.level});
    const animateProp=rpm=>{const duration=clamp(60000/Math.max(rpm,1)*1.8,220,1600),blades=$('propellerBlades');if(blades){blades.style.animation=`propSpin ${duration}ms linear infinite`;blades.style.animationPlayState='running';}};
    let simFrame=0,simState={running:false,speed:0,last:0};
    function setShipMotion(speedKn){
      const input=result?.input||readInput(),target=Math.max(input.speed,.1),scene=$('seaScene'),ship=$('shipVisual');
      if(!scene||!ship)return;
      const ratio=clamp(speedKn/target,0,1),maxTravel=Math.max(scene.clientWidth*.18,48);
      ship.style.transform=`translate3d(${ratio*maxTravel}px,0,0)`;
      $('sceneSpeed').textContent=`${fmt(speedKn,1)} kn`;
      document.documentElement.style.setProperty('--water-speed',`${clamp(1.8-ratio*1.35,.35,1.8)}s`);
    }
    function dynamicAtSpeed(input,speedKn){
      const velocity=Math.max(speedKn,0)*KN_TO_MS,n=input.rpm/60,advance=velocity*(1-input.wake),j=advance/(n*input.diameter);
      const chord=2.073*input.area*input.diameter/input.blades;
      const reynolds=chord*Math.hypot(advance,.75*Math.PI*n*input.diameter)/input.nu;
      const level=input.level!=='A'&&reynolds<=2e6?'A':input.level;
      const tOverC=(.0185-.00125*input.blades)*input.diameter/chord;
      const deltaCd=(2+4*tOverC)*(.003605-Math.pow(1.89+1.62*Math.log10(chord/30e-6),-2.5));
      const roughness={dKT:.3*deltaCd*input.pd*chord*input.blades/input.diameter,dKQ:-.25*deltaCd*chord*input.blades/input.diameter};
      const coefficients=calculateAtJ(input,j,level,reynolds,roughness);
      const thrust=coefficients.kt*input.rho*n*n*Math.pow(input.diameter,4);
      const torque=coefficients.kq*input.rho*n*n*Math.pow(input.diameter,5);
      const power=2*Math.PI*n*torque,resistance=150400*Math.pow(Math.max(speedKn,0)/12,2);
      return {j,kt:coefficients.kt,kq:coefficients.kq,eta:coefficients.eta,thrust,torque,power,resistance,net:thrust*(1-input.deduction)-resistance};
    }
    function stopSimulation(reason='SIMULAÇÃO PRONTA'){
      if(!simState.running)return;
      simState.running=false;cancelAnimationFrame(simFrame);
      $('liveTagText').innerHTML=`<i></i> ${reason}`;
    }
    function updateLiveMetrics(dynamics){
      $('metricJ').textContent=fmt(dynamics.j,3);
      $('metricEta').textContent=dynamics.kt>0&&dynamics.kq>0&&dynamics.eta<=1?`${fmt(dynamics.eta*100,1)}%`:'—';
      $('metricThrust').textContent=fmt(dynamics.thrust/1000,1);$('metricPower').textContent=fmtPower(dynamics.power/1000);
      $('thrustMargin').textContent=`${dynamics.net>=0?'+':''}${fmt(dynamics.net/1000,1)} kN`;
      const balanced=Math.abs(dynamics.net)/Math.max(dynamics.resistance,1)<=.02;
      $('balanceState').textContent=balanced?'EM EQUILÍBRIO':dynamics.net>0?'EXCESSO DE EMPUXO':'FALTA DE EMPUXO';
      $('thrustMargin').closest('.thrust-line').classList.toggle('negative',!balanced&&dynamics.net<0);
    }
    function runSimulation(value){
      cancelAnimationFrame(simFrame);simState={running:true,speed:0,last:performance.now()};
      $('liveTagText').innerHTML='<i></i> SIMULAÇÃO EM EXECUÇÃO';setShipMotion(0);
      const input=value.input,target=input.speed,mass=Math.max(input.displacement,1)*1100,timeScale=60;
      function finish(speedKn,label){
        simState.speed=speedKn;simState.running=false;setShipMotion(speedKn);
        const finalDynamics=dynamicAtSpeed(input,speedKn);updateLiveMetrics(finalDynamics);
        $('liveTagText').innerHTML=`<i></i> ${label}`;$('balanceState').textContent=label;
      }
      function frame(now){
        if(!simState.running)return;
        const dt=Math.min((now-simState.last)/1000,.05)*timeScale;simState.last=now;
        const dynamics=dynamicAtSpeed(input,simState.speed),speedMs=simState.speed*KN_TO_MS;
        if(simState.speed>0&&Math.abs(dynamics.net)/Math.max(dynamics.resistance,1)<=.02){finish(simState.speed,'EQUILÍBRIO DINÂMICO');return;}
        if(dynamics.net<0&&simState.speed>0){
          let low=0,high=speedMs;
          for(let index=0;index<36;index++){const middle=(low+high)/2;if(dynamicAtSpeed(input,middle/KN_TO_MS).net>0)low=middle;else high=middle;}
          finish((low+high)/(2*KN_TO_MS),'EQUILÍBRIO DINÂMICO');return;
        }
        const nextSpeed=clamp((speedMs+dynamics.net/mass*dt)/KN_TO_MS,0,target);
        simState.speed=nextSpeed;updateLiveMetrics(dynamics);setShipMotion(nextSpeed);
        if(nextSpeed>=target-.001){finish(target,'VELOCIDADE-ALVO ATINGIDA');return;}
        simFrame=requestAnimationFrame(frame);
      }
      simFrame=requestAnimationFrame(frame);
    }
    function drawChart(canvas,series,point,range,maximum,options={}) {
      const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
      if(!rect.width)return;
      canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
      const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
      const w=rect.width,h=rect.height,pad={l:35,r:8,t:12,b:25},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
      let minY=options.minY??Math.min(0,...series.map(item=>item.y)),maxY=options.maxY??Math.max(...series.map(item=>item.y));
      if(maxY===minY)maxY=minY+1;
      const margin=(maxY-minY)*.12;minY-=margin;maxY+=margin;
      ctx.clearRect(0,0,w,h);ctx.strokeStyle='#28434a';ctx.lineWidth=1;ctx.font='8px "DM Mono", monospace';ctx.fillStyle='#78918b';
      for(let i=0;i<=3;i++){const y=pad.t+plotH*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(maxY-(maxY-minY)*i/3,2),2,y+3);}
      ctx.strokeStyle='#435c5f';ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,h-pad.b);ctx.lineTo(w-pad.r,h-pad.b);ctx.stroke();
      ctx.fillStyle='#8da59e';ctx.fillText('J',w-pad.r-8,h-7);
      const x=j=>pad.l+clamp(j/range,0,1)*plotW,y=value=>pad.t+(maxY-value)/(maxY-minY)*plotH;
      if(options.shadeFrom!==undefined){ctx.fillStyle='#f0a26b1c';ctx.fillRect(x(options.shadeFrom),pad.t,w-pad.r-x(options.shadeFrom),plotH);ctx.strokeStyle='#f0a26b66';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(options.shadeFrom),pad.t);ctx.lineTo(x(options.shadeFrom),h-pad.b);ctx.stroke();ctx.setLineDash([]);}
      ctx.strokeStyle=series[0]?.color||'#55d8d0';ctx.lineWidth=2;ctx.beginPath();
      series.forEach((item,index)=>index?ctx.lineTo(x(item.x),y(item.y)):ctx.moveTo(x(item.x),y(item.y)));ctx.stroke();
      if(maximum){ctx.fillStyle='#b5e58b';ctx.beginPath();ctx.arc(x(maximum.x),y(maximum.y),3.5,0,Math.PI*2);ctx.fill();ctx.fillText('η máx.',clamp(x(maximum.x)+6,pad.l,w-46),clamp(y(maximum.y)-7,pad.t+8,h-pad.b));}
      if(point&&point.x<=range){ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle='#d8eee2aa';ctx.beginPath();ctx.moveTo(x(point.x),pad.t);ctx.lineTo(x(point.x),h-pad.b);ctx.stroke();ctx.restore();ctx.fillStyle='#f2f6ed';ctx.beginPath();ctx.arc(x(point.x),y(point.y),4,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#78918b';ctx.fillText('0',pad.l-2,h-7);ctx.fillText(fmt(range,2),w-pad.r-28,h-7);
    }
    function updateGraphs(value) {
      const zeroLimit=Math.max(value.jZero,.01),range=zeroLimit*1.05,samples=230,curves=[];let maxEta={x:0,y:-Infinity};
      for(let i=0;i<=samples;i++){const j=range*i/samples,coeff=calculateAtJ(value.input,j,value.level,value.reynolds,value.roughness);curves.push({j,...coeff});if(coeff.kt>0&&coeff.kq>0&&coeff.eta>maxEta.y&&coeff.eta<=1){maxEta={x:j,y:coeff.eta};}}
      const point={x:value.j,kt:value.kt,kq:value.kq,eta:value.eta};
      drawChart($('chartKt'),curves.map(c=>({x:c.j,y:c.kt,color:'#55d8d0'})),{x:point.x,y:point.kt},range,null,{shadeFrom:zeroLimit});
      drawChart($('chartKq'),curves.map(c=>({x:c.j,y:10*c.kq,color:'#f0a26b'})),{x:point.x,y:10*point.kq},range,null);
      drawChart($('chartEta'),curves.filter(c=>c.kt>0&&c.kq>0&&c.eta<=1).map(c=>({x:c.j,y:c.eta*100,color:'#b5e58b'})),{x:point.x,y:point.eta*100},range,{x:maxEta.x,y:maxEta.y*100},{minY:0,maxY:100});
      const js=[0,.25,.5,.75,1].map(f=>zeroLimit*f);js.push(clamp(value.j,0,zeroLimit));
      $('curveRows').innerHTML=[...new Set(js.map(j=>j.toFixed(4)))].sort((a,b)=>Number(a)-Number(b)).map(j=>{const c=calculateAtJ(value.input,Number(j),value.level,value.reynolds,value.roughness);return `<tr><td>${fmt(Number(j),4)}</td><td>${fmt(c.kt,5)}</td><td>${fmt(c.kq*10,5)}</td><td>${c.kt>0&&c.kq>0&&c.eta<=1?`${fmt(c.eta*100,2)}%`:'—'}</td></tr>`;}).join('');
    }
    function updateChallenge(value) {
      const box=$('challengeResult');box.hidden=!challenge;
      if(!challenge)return;
      const balanced=Math.abs(value.margin)/Math.max(value.resistance,1)<=.02, efficient=value.eta>=.65,valid=value.warnings.length===0&&value.j<value.jZero;
      const stars=Number(balanced)+Number(balanced&&efficient)+Number(balanced&&efficient&&valid);
      box.innerHTML=`<b>${'★'.repeat(stars)}${'☆'.repeat(3-stars)} · ${stars}/3</b><br>${balanced?'Equilíbrio dentro de 2%.':value.margin<0?'Falta empuxo: aumente RPM ou revise o passo.':'Empuxo excedente: ajuste a rotação para a resistência da missão.'}<br>${efficient?'Alvo η₀ ≥ 65% atendido.':'Meta da missão: η₀ ≥ 65%.'}`;
    }
    function render() {
      const value=calculate(readInput());result=value;
      const message=$('formMessage'),validity=$('validity');
      if(value.errors.length){message.textContent=`⚠ ${value.errors[0]}`;validity.className='validity error';$('validityTitle').textContent='ENTRADA INVÁLIDA';$('validityText').textContent='Corrija os campos destacados para calcular.';return;}
      message.textContent=value.warnings.length?`⚠ ${value.warnings.join(' ')}`:'';
      $('metricJ').textContent=fmt(value.j,3);$('metricEta').textContent=value.kt>0&&value.kq>0&&value.j<value.jZero?`${fmt(value.eta*100,1)}%`:'—';
      $('metricThrust').textContent=fmt(value.thrust/1000,1);$('metricPower').textContent=fmtPower(value.power/1000);
      $('sceneSpeed').textContent=`${fmt(value.input.speed,1)} kn`;$('sceneRpm').textContent=`${fmt(value.input.rpm,0)} rpm`;animateProp(value.input.rpm);
      if(simState.running)setShipMotion(simState.speed);else $('shipVisual').style.transform='translate3d(0,0,0)';
      $('thrustMargin').textContent=`${value.margin>=0?'+':''}${fmt(value.margin/1000,1)} kN`;
      const balanced=Math.abs(value.margin)/Math.max(value.resistance,1)<=.02;
      $('thrustMargin').textContent=balanced?`${fmt(0,1)} kN`:`${value.margin>=0?'+':''}${fmt(value.margin/1000,1)} kN`;
      $('balanceState').textContent=balanced?'EM EQUILÍBRIO':value.margin>0?'EXCESSO DE EMPUXO':'FALTA DE EMPUXO';
      $('thrustMargin').closest('.thrust-line').classList.toggle('negative',!balanced&&value.margin<0);
      const limits=AREA_LIMITS[value.input.blades];$('areaRange').textContent=`faixa para Z = ${value.input.blades}: ${fmt(limits[0],2)}–${fmt(limits[1],2)}`;
      if(value.warnings.length){validity.className='validity warning';$('validityTitle').textContent=value.j>=value.jZero?'J ALÉM DO EMPUXO NULO':'EXTRAPOLAÇÃO / AVISO';$('validityText').textContent=`Modelo ${value.level} · Rn₀,₇₅R = ${value.reynolds.toExponential(2)} · ${value.warnings.length} aviso(s)`;}
      else{validity.className='validity';$('validityTitle').textContent='DENTRO DO DOMÍNIO';$('validityText').textContent=`Série B · Z = ${value.input.blades} · P/D = ${fmt(value.input.pd,2)} · Rn₀,₇₅R = ${value.reynolds.toExponential(2)}`;}
      $('modelCaption').textContent=`Modelo ${value.level} · ${value.level==='A'?'polinômio puro':value.level==='B'?'correção de Reynolds':'Reynolds + rugosidade de 30 µm'}.`;
      doc.querySelectorAll('[data-level]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.level===value.input.level)));
      updateGraphs(value);updateChallenge(value);
      $('equationSteps').innerHTML=value.steps.map(step=>`<li><b>${step.name}</b><br>${step.formula}<br>${step.substitution} = <b>${fmt(step.value,step.unit==='m/s'?3:step.unit==='%'?1:step.unit==='kN'||step.unit==='kN·m'?1:step.unit==='kW'?1:step.unit==='—'?5:4)} ${step.unit}</b></li>`).join('');
    }
    function schedule(){stopSimulation('PARÂMETROS ATUALIZADOS');clearTimeout(timer);timer=setTimeout(render,120);}
    form.addEventListener('input',schedule);form.addEventListener('change',schedule);form.addEventListener('submit',event=>{event.preventDefault();stopSimulation();render();if(result&&!result.errors.length)runSimulation(result);});
    doc.querySelectorAll('[data-level]').forEach(button=>button.addEventListener('click',()=>{stopSimulation('MODELO ATUALIZADO');currentInput.level=button.dataset.level;render();}));
    $('resetButton').addEventListener('click',()=>{stopSimulation();Object.entries(DEFAULTS).forEach(([key,value])=>{if(key!=='level'&&inputs[key])inputs[key].value=value;});currentInput.level=DEFAULTS.level;render();});
    $('equationButton').addEventListener('click',()=>$('equationDialog').showModal());
    $('challengeButton').addEventListener('click',event=>{challenge=!challenge;event.currentTarget.setAttribute('aria-pressed',String(challenge));event.currentTarget.innerHTML=challenge?'SAIR DO DESAFIO <span>−</span>':'MODO DESAFIO <span>＋</span>';render();});
    const save=(filename,type,content)=>{const link=doc.createElement('a');link.href=URL.createObjectURL(new Blob([content],{type}));link.download=filename;link.click();URL.revokeObjectURL(link.href);};
    async function coefficientHash(){const bytes=new TextEncoder().encode(JSON.stringify([KT_TERMS,KQ_TERMS]));if(window.crypto&&window.crypto.subtle){const digest=await window.crypto.subtle.digest('SHA-256',bytes);return `sha256:${[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;}let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619);return `fnv1a32:${(hash>>>0).toString(16).padStart(8,'0')}`;}
    $('exportJson').addEventListener('click',async()=>{if(!result||result.errors.length)return;save('naval-mission-01.json','application/json',JSON.stringify({method:'series-b',model_version:'0.1.0',model_level:result.level,coefficient_hash:await coefficientHash(),coefficient_source:'Oosterveld & van Oossanen (1975), coefficients transcribed from validated spreadsheet',timestamp:new Date().toISOString(),inputs:result.input,results:{advance_velocity_ms:result.advance,rev_per_s:result.n,advance_coefficient:result.j,reynolds_075r:result.reynolds,kt:result.kt,kq:result.kq,thrust_n:result.thrust,torque_nm:result.torque,delivered_power_kw:result.power/1000,open_water_efficiency:result.eta,net_thrust_n:result.netThrust,resistance_n:result.resistance,thrust_margin_n:result.margin,j_zero_thrust:result.jZero,warnings:result.warnings}},null,2));});
    $('exportCsv').addEventListener('click',()=>{if(!result||result.errors.length)return;const rows=['J,KT,10KQ,eta0'];const count=200;for(let index=0;index<=count;index++){const j=result.jZero*index/count,c=calculateAtJ(result.input,j,result.level,result.reynolds,result.roughness);rows.push([j,c.kt,c.kq*10,c.kt>0&&c.kq>0&&c.eta<=1?c.eta:''].join(','));}save('naval-series-b-curves.csv','text/csv;charset=utf-8',rows.join('\n'));});
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>result&&!result.errors.length&&updateGraphs(result),150);});
    render();
  }

  return {calculate,poly,reynoldsCorrection,KT_TERMS,KQ_TERMS,DEFAULTS,mount};
});