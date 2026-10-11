import type { ROVCommands } from '../rov/ROV';
export interface ThrusterBars { update(commands:ROVCommands):void }
export function createThrusterBars(container:Element|null):ThrusterBars {
 const labels=['Avanço / recuo','Lateral','Vertical','Guinada'];if(!container)return {update(){}};
 container.innerHTML=labels.map((label,i)=>`<div class="thruster-row"><div class="thruster-label"><span>${label}</span><b data-value="${i}">0%</b></div><div class="bar-track"><div class="bar-fill" data-bar="${i}"></div></div></div>`).join('');
 return {update(commands){const vals=[commands.forward,commands.lateral,commands.vertical,commands.yaw];vals.forEach((v,i)=>{const bar=container.querySelector<HTMLElement>(`[data-bar="${i}"]`),txt=container.querySelector<HTMLElement>(`[data-value="${i}"]`);if(bar){bar.style.width=`${Math.abs(v)*100}%`;bar.style.marginLeft=v<0?`${(1-Math.abs(v))*100}%`:'0';}if(txt)txt.textContent=`${Math.round(v*100)}%`;});}};
}
