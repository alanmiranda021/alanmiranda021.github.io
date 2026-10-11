import './styles.css';
import { createLoop } from './core/GameLoop';
import { createSimulation } from './core/createSimulation';
import { ROVControls } from './rov/ROVControls';
import { createThrusterBars } from './ui/ThrusterBars';
import { updateTelemetry } from './telemetry/updateTelemetry';
import { createTouchControls } from './ui/TouchControls';
const viewport=document.querySelector<HTMLDivElement>('#viewport');if(!viewport)throw new Error('Elemento #viewport não encontrado');
function start() {
const simulation=createSimulation(viewport!);const controls=new ROVControls(simulation.rov);const bars=createThrusterBars(document.querySelector('#thruster-bars'));
const touch=createTouchControls(controls);
const app=document.querySelector<HTMLElement>('#app')!;
const missionPanel=document.querySelector<HTMLElement>('.left-panel')!,telemetryPanel=document.querySelector<HTMLElement>('.right-panel')!;
missionPanel.id='mission-panel';telemetryPanel.id='telemetry-panel';
document.querySelectorAll<HTMLButtonElement>('[data-panel-button]').forEach(button=>button.addEventListener('click',()=>{
  app.dataset.panel=app.dataset.panel===button.dataset.panelButton?'':button.dataset.panelButton;
  document.querySelectorAll<HTMLButtonElement>('[data-panel-button]').forEach(item=>item.setAttribute('aria-expanded',String(item.dataset.panelButton===app.dataset.panel)));
}));
const ui={depth:document.querySelector<HTMLElement>('#depth'),heading:document.querySelector<HTMLElement>('#heading'),power:document.querySelector<HTMLElement>('#power'),battery:document.querySelector<HTMLElement>('#battery'),coordinates:document.querySelector<HTMLElement>('#coordinates'),reset:document.querySelector<HTMLButtonElement>('#reset-button')};
let t=updateTelemetry(simulation.rov,controls.getCommands(),0);
let cargoView=false;
const viewButton=document.querySelector<HTMLButtonElement>('#view-button');
const mobileView=document.querySelector<HTMLButtonElement>('#mobile-view-button');
function toggleView(){cargoView=!cargoView;simulation.setView(cargoView);if(viewButton)viewButton.textContent=cargoView?'VOLTAR AO ROV':'VER CARGUEIRO';if(mobileView)mobileView.textContent=cargoView?'ROV':'Navio';}
viewButton?.addEventListener('click',toggleView);mobileView?.addEventListener('click',toggleView);
const loop=createLoop(dt=>{
  controls.update(); simulation.step(dt,controls.toolActive);
  t=updateTelemetry(simulation.rov,controls.getCommands(),dt);
},dt=>{
  simulation.render(dt);
  if(ui.depth)ui.depth.innerHTML=`${t.depth.toFixed(1)} <em>m</em>`;
  if(ui.heading)ui.heading.innerHTML=`${String(Math.round(t.heading)%360).padStart(3,'0')} <em>°</em>`;
  if(ui.power)ui.power.innerHTML=`${Math.round(t.power)} <em>%</em>`;
  if(ui.battery)ui.battery.innerHTML=`${Math.round(t.battery)} <em>%</em>`;
  if(ui.coordinates){const p=simulation.rov.group.position;ui.coordinates.textContent=`X ${p.x.toFixed(1)} · Y ${p.y.toFixed(1)} · Z ${p.z.toFixed(1)}`;}
  bars.update(controls.getCommands());
  const m=simulation.mission;
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach(el=>{
    const stage=Number(el.dataset.stage);el.classList.toggle('active',stage===m.stage);el.classList.toggle('done',stage<m.stage);
  });
  const hint=document.querySelector<HTMLElement>('#mission-hint');if(hint)hint.textContent=m.hint;
  const stats=document.querySelector<HTMLElement>('#mission-stats');if(stats)stats.textContent=`${m.finished?'CONCLUÍDA · ':''}${m.score} pontos · ${Math.floor(m.elapsed)} s · ${m.collisions} impactos`;
  const progress=document.querySelector<HTMLProgressElement>('#mission-progress');if(progress)progress.value=[Math.max(0,1-simulation.targetDistance/7),m.inspectTime/3,m.cutProgress,m.verifyTime/2,1][m.stage];
  const distance=document.querySelector<HTMLElement>('#target-distance');if(distance)distance.textContent=`ALVO ${simulation.targetDistance.toFixed(1)} m · ${simulation.rov.velocity.length().toFixed(2)} m/s${controls.toolActive?' · CORTADOR ATIVO':''}`;
  viewport!.dataset.missionStage=String(m.stage);
});
ui.reset?.addEventListener('click',()=>{cargoView=false;if(viewButton)viewButton.textContent='VER CARGUEIRO';if(mobileView)mobileView.textContent='Navio';simulation.reset();touch.reset();controls.clear();loop.reset();t=updateTelemetry(simulation.rov,controls.getCommands(),0);});
window.addEventListener('beforeunload',()=>{loop.stop();touch.dispose();controls.dispose();});
simulation.renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();loop.stop();showError('A conexão com a placa de vídeo foi interrompida. Recarregue a página para retomar.');
});
simulation.renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
}
function showError(message:string){
  const error=document.querySelector<HTMLElement>('#startup-error');
  if(error){error.hidden=false;error.textContent=message;}
}
try { start(); } catch(error) {
  console.error(error);
  showError('Não foi possível iniciar o 3D. Abra pelo atalho INICIAR_SIMULADOR.cmd e confira se a aceleração de hardware está habilitada no navegador. Detalhe: '+(error instanceof Error?error.message:String(error)));
}
