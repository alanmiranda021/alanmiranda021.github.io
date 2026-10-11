import { SIM_CONFIG as C } from '../core/config';
import type { ROVCommands } from '../rov/ROV';
export function allocate(c: ROVCommands) {
  const raw = [c.forward+c.lateral+c.yaw, c.forward-c.lateral-c.yaw,
    c.forward-c.lateral+c.yaw, c.forward+c.lateral-c.yaw];
  const scale = Math.max(1, ...raw.map(Math.abs));
  const t = [...raw.map(v => v/scale), ...Array<number>(2).fill(Math.max(-1, Math.min(1, c.vertical)))];
  const n = C.thrusterMaxN * Math.SQRT1_2;
  return { thrusters: t, forces: {
    surge: (t[0]+t[1]+t[2]+t[3])*n,
    sway: (t[0]-t[1]-t[2]+t[3])*n,
    heave: (t[4]+t[5])*C.thrusterMaxN,
    // Three.js +Y rotates counterclockwise; E must turn clockwise.
    yawTorque: -(t[0]-t[1]+t[2]-t[3])*n*0.35
  }};
}
