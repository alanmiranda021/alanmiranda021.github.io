import * as THREE from 'three';
import type { ROV, ROVCommands } from '../rov/ROV';
export interface Telemetry { depth:number;heading:number;power:number;battery:number }
let battery=100;
export function updateTelemetry(rov:ROV,commands:ROVCommands,dt:number):Telemetry {
 const depth=Math.max(0,-rov.group.position.y);const heading=(( -THREE.MathUtils.radToDeg(rov.group.rotation.y)%360)+360)%360;
 const power=Math.min(100,(Math.abs(commands.forward)+Math.abs(commands.lateral)+Math.abs(commands.vertical)+Math.abs(commands.yaw))*25);
 battery=Math.max(0,battery-power*.00035*dt);return {depth,heading,power,battery};
}
