import * as THREE from 'three';
import { SIM_CONFIG as C } from '../core/config';

export interface BodyForces {
  surge: number;
  sway: number;
  heave: number;
  yawTorque: number;
}

/** Modelo simplificado: x=direita, y=cima, z=avanço (−Z local do Three.js). */
export class VehicleDynamics {
  readonly vel = new THREE.Vector3();
  yawRate = 0;
  private readonly currentBody = new THREE.Vector3();
  private readonly worldVelocity = new THREE.Vector3();
  private readonly yawRotation = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  step(group: THREE.Group, f: BodyForces, current: THREE.Vector3, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const yaw = group.rotation.y;
    this.yawRotation.setFromAxisAngle(this.up, -yaw);
    // Primeiro transforma a corrente mundial para o corpo, depois troca o eixo de avanço.
    this.currentBody.copy(current).applyQuaternion(this.yawRotation);
    this.currentBody.z *= -1;
    const drag = (v: number, linear: number, quadratic: number) =>
      -(linear * v + quadratic * Math.abs(v) * v);

    this.vel.x += (f.sway + drag(this.vel.x - this.currentBody.x, C.linDrag.x, C.quadDrag.x))
      / (C.mass + C.addedMassXY) * dt;
    this.vel.y += (f.heave + C.buoyancyTrimN + drag(this.vel.y - this.currentBody.y, C.linDrag.y, C.quadDrag.y))
      / (C.mass + C.addedMassZ) * dt;
    this.vel.z += (f.surge + drag(this.vel.z - this.currentBody.z, C.linDrag.z, C.quadDrag.z))
      / (C.mass + C.addedMassXY) * dt;
    this.yawRate += (f.yawTorque + drag(this.yawRate, C.yawLinDrag, C.yawQuadDrag))
      / C.inertiaYaw * dt;

    this.yawRotation.setFromAxisAngle(this.up, yaw);
    this.worldVelocity.set(this.vel.x, this.vel.y, -this.vel.z).applyQuaternion(this.yawRotation);
    group.position.addScaledVector(this.worldVelocity, dt);
    group.rotation.y += this.yawRate * dt;
    const smoothing = 1 - Math.exp(-6 * dt);
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -this.vel.x * 0.05, smoothing);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, this.vel.z * 0.04, smoothing);
  }

  reset() { this.vel.set(0, 0, 0); this.yawRate = 0; }
}
