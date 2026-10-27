import * as THREE from 'three';
import { SIM_CONFIG as C } from '../core/config';
/** Velocity is in world axes. Only the component entering an obstacle is removed. */
export function resolveCollisions(pos: THREE.Vector3, vel: THREE.Vector3, hulls: THREE.Box3[]) {
  const r = C.rovRadius;
  const contact = (normal: THREE.Vector3) => {
    const entering = vel.dot(normal);
    if (entering < 0) vel.addScaledVector(normal, -entering);
  };
  const floor = -C.seabedDepth+r;
  if (pos.y < floor) { pos.y=floor; contact(new THREE.Vector3(0,1,0)); }
  if (pos.y > -r) { pos.y=-r; contact(new THREE.Vector3(0,-1,0)); }
  for (const axis of ['x','z'] as const) {
    if (Math.abs(pos[axis]) > 100-r) {
      const sign = Math.sign(pos[axis]); pos[axis]=sign*(100-r);
      if (vel[axis]*sign > 0) vel[axis]=0;
    }
  }
  for (const box of hulls) {
    const closest = box.clampPoint(pos, new THREE.Vector3());
    const normal = pos.clone().sub(closest);
    const distance = normal.length();
    if (distance >= r) continue;
    if (distance > 1e-8) { normal.divideScalar(distance); pos.addScaledVector(normal,r-distance); }
    else {
      // Center inside box: escape via the nearest face, including its radius margin.
      const faces = [
        {d:pos.x-box.min.x, n:new THREE.Vector3(-1,0,0)},
        {d:box.max.x-pos.x, n:new THREE.Vector3(1,0,0)},
        {d:pos.y-box.min.y, n:new THREE.Vector3(0,-1,0)},
        {d:box.max.y-pos.y, n:new THREE.Vector3(0,1,0)},
        {d:pos.z-box.min.z, n:new THREE.Vector3(0,0,-1)},
        {d:box.max.z-pos.z, n:new THREE.Vector3(0,0,1)}
      ];
      faces.sort((a,b)=>a.d-b.d); normal.copy(faces[0].n);
      pos.addScaledVector(normal,faces[0].d+r);
    }
    contact(normal);
  }
}
