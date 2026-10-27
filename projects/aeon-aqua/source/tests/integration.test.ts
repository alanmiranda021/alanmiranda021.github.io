import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { ROV } from '../src/rov/ROV';
import { allocate } from '../src/control/ThrusterAllocator';
import { resolveCollisions } from '../src/physics/Collision';
import { FixedStepper } from '../src/core/GameLoop';
import { SIM_CONFIG as C } from '../src/core/config';
const commands={forward:0,lateral:0,vertical:0,yaw:0};
const still=new THREE.Vector3();
describe('integra??o de f?sica',()=>{
  it('W avan?a, D desloca ? direita e E gira hor?rio',()=>{
    expect(allocate({...commands,forward:1}).forces.surge).toBeGreaterThan(0);
    expect(allocate({...commands,forward:1}).forces.sway).toBe(0);
    expect(allocate({...commands,lateral:1}).forces.sway).toBeGreaterThan(0);
    expect(allocate({...commands,yaw:1}).forces.yawTorque).toBeLessThan(0);
    const rov=new ROV(new THREE.Group());rov.reset();rov.applyCommands({...commands,forward:1});
    for(let i=0;i<60;i++)rov.update(1/60,still);
    expect(rov.group.position.z).toBeLessThan(4);
    const speed=rov.velocity.length();rov.applyCommands(commands);
    for(let i=0;i<60;i++)rov.update(1/60,still);
    expect(rov.velocity.length()).toBeLessThan(speed);
    expect(rov.velocity.length()).toBeGreaterThan(0);
  });
  it('n?o atravessa fundo nem superf?cie com comando sustentado',()=>{
    const rov=new ROV(new THREE.Group());rov.reset();
    rov.applyCommands({...commands,vertical:-1});
    for(let i=0;i<1800;i++)rov.update(1/60,still);
    expect(rov.group.position.y).toBeCloseTo(-C.seabedDepth+C.rovRadius);
    expect(rov.velocity.y).toBe(0);
    rov.applyCommands({...commands,vertical:1});
    for(let i=0;i<1800;i++)rov.update(1/60,still);
    expect(rov.group.position.y).toBeCloseTo(-C.rovRadius);
    expect(rov.velocity.y).toBe(0);
  });
  it('resolve colis?o externa e centro dentro do casco',()=>{
    const box=new THREE.Box3(new THREE.Vector3(-2,-10,-2),new THREE.Vector3(2,-6,2));
    const pos=new THREE.Vector3(2.5,-8,0),vel=new THREE.Vector3(-1,0,1);
    resolveCollisions(pos,vel,[box]);
    expect(pos.x).toBeCloseTo(2+C.rovRadius);expect(vel.x).toBe(0);expect(vel.z).toBe(1);
    pos.set(0,-8,0);resolveCollisions(pos,vel,[box]);
    expect(box.distanceToPoint(pos)).toBeCloseTo(C.rovRadius);
  });
  it('comando sustentado n?o atravessa caixa do casco',()=>{
    const rov=new ROV(new THREE.Group());rov.reset();
    const hull=new THREE.Box3(new THREE.Vector3(-9,-14,-10),new THREE.Vector3(9,-10,-6));
    rov.group.position.set(0,-12,4);rov.group.rotation.set(0,0,0);
    rov.applyCommands({...commands,forward:1});
    for(let i=0;i<1800;i++)rov.update(1/60,still,[hull]);
    expect(rov.group.position.z).toBeCloseTo(-6+C.rovRadius);
    expect(rov.velocity.z).toBeCloseTo(0);
  });
  it('30, 60 e 144 fps produzem a mesma posi??o ap?s 10 segundos',()=>{
    const positions=[30,60,144].map(fps=>{
      const fixed=new FixedStepper(),rov=new ROV(new THREE.Group());rov.reset();
      rov.applyCommands({...commands,forward:.5,yaw:.1});
      for(let i=0;i<fps*10;i++)fixed.advance(1/fps,dt=>rov.update(dt,still));
      return rov.group.position.clone();
    });
    expect(positions[0].distanceTo(positions[1])).toBeLessThan(1e-9);
    expect(positions[0].distanceTo(positions[2])).toBeLessThan(1e-9);
  });
  it('reset interrompe movimento e comandos',()=>{
    const rov=new ROV(new THREE.Group());rov.reset();rov.applyCommands({...commands,forward:1,yaw:1});
    rov.update(1/60,still);rov.reset();rov.update(1/60,still);
    expect(rov.group.position.toArray()).toEqual([-12.5,-7.2,-2]);
    expect(rov.velocity.length()).toBe(0);expect(rov.dynamics.yawRate).toBe(0);
  });
});
