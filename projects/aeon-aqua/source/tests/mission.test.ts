import {it,expect} from 'vitest';
import {PropellerMission, type MissionInput} from '../src/missions/PropellerMission';
const input:MissionInput={distance:3,speed:.1,alignment:1,toolActive:false,collision:false};
const advance=(m:PropellerMission,seconds:number,i:MissionInput)=>{for(let n=0;n<seconds*60;n++)m.update(i,1/60);};
it('percorre a missão completa e congela a pontuação ao concluir',()=>{
  const m=new PropellerMission();advance(m,1,input);expect(m.stage).toBe(1);
  advance(m,4,input);expect(m.stage).toBe(2);
  advance(m,5,{...input,distance:2,toolActive:true});expect(m.stage).toBe(3);expect(m.cutProgress).toBe(1);
  advance(m,3,{...input,distance:3.5});expect(m.finished).toBe(true);
  const score=m.score,time=m.elapsed;advance(m,20,{...input,collision:true});expect(m.score).toBe(score);expect(m.elapsed).toBe(time);
});
it('não corta longe, depressa ou sem apontar para a rede',()=>{
  const m=new PropellerMission();advance(m,5,input);expect(m.stage).toBe(2);
  advance(m,5,{...input,distance:3.8,toolActive:true});expect(m.cutProgress).toBe(0);
  advance(m,5,{...input,distance:2,speed:1,toolActive:true});expect(m.cutProgress).toBe(0);
  advance(m,5,{...input,distance:2,alignment:0,toolActive:true});expect(m.cutProgress).toBe(0);
});
it('inspeção exige tempo contínuo e impactos têm intervalo',()=>{
  const m=new PropellerMission();advance(m,1,input);advance(m,2,input);
  m.update({...input,alignment:0,collision:true},1/60);expect(m.inspectTime).toBe(0);expect(m.collisions).toBe(1);
  m.update({...input,collision:true},1/60);expect(m.collisions).toBe(1);
  advance(m,2,input);expect(m.stage).toBe(1);
});
