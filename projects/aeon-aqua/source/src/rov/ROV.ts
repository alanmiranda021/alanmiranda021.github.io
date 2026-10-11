import * as THREE from 'three';
import { SIM_CONFIG as C } from '../core/config';
import { VehicleDynamics } from '../physics/VehicleDynamics';
import { resolveCollisions } from '../physics/Collision';
import { allocate } from '../control/ThrusterAllocator';
import type { ShipCollision } from '../physics/ShipCollision';
export interface ROVCommands { forward: number; lateral: number; vertical: number; yaw: number }
export class ROV {
  readonly velocity = new THREE.Vector3();
  readonly dynamics = new VehicleDynamics();
  readonly thrusters = Array<number>(6).fill(0);
  collision = false;
  private commands: ROVCommands = {forward:0,lateral:0,vertical:0,yaw:0};
  private readonly spawn = new THREE.Vector3(-12.5,-7.2,-2);
  private spawnYaw=-Math.atan2(2.7,6);
  private readonly up = new THREE.Vector3(0,1,0);
  constructor(readonly group: THREE.Group) {}
  applyCommands(commands: ROVCommands) { this.commands = {...commands}; }
  setSpawn(position:THREE.Vector3,target:THREE.Vector3){this.spawn.copy(position);this.spawnYaw=-Math.atan2(target.x-position.x,position.z-target.z);}
  update(dt: number, current = new THREE.Vector3(), hulls: THREE.Box3[] = [], ship?:ShipCollision) {
    const allocation = allocate(this.commands);
    this.thrusters.splice(0,6,...allocation.thrusters);
    const oldYaw = this.group.rotation.y;
    this.dynamics.step(this.group,allocation.forces,current,dt);
    this.velocity.set(this.dynamics.vel.x,this.dynamics.vel.y,-this.dynamics.vel.z)
      .applyAxisAngle(this.up,oldYaw);
    const speed = this.velocity.length();
    const beforeCollision = this.velocity.clone();
    resolveCollisions(this.group.position,this.velocity,hulls);
    ship?.resolve(this.group.position,this.velocity);
    this.collision = speed > .5 && beforeCollision.distanceTo(this.velocity) > .2;
    // Keep inertia in world axes while the body changes heading.
    this.dynamics.vel.copy(this.velocity).applyAxisAngle(this.up,-this.group.rotation.y);
    this.dynamics.vel.z *= -1;
  }
  reset() {
    this.group.position.copy(this.spawn); this.group.rotation.set(0,this.spawnYaw,0);
    this.velocity.set(0,0,0); this.dynamics.reset(); this.thrusters.fill(0);
    this.commands={forward:0,lateral:0,vertical:0,yaw:0};
    this.collision=false;
  }
}
