export const SIM_CONFIG = {
  waterColor: 0x06304a, fogColor: 0x06304a, initialDepth: 12,
  maxDepth: 60, seabedDepth: 21, rovRadius: 1.2, thrusterMaxN: 40,
  // Estimativas iniciais do guia, em unidades SI; requerem calibração.
  mass: 11, addedMassXY: 6, addedMassZ: 9, inertiaYaw: 0.35,
  linDrag: { x: 8, y: 12, z: 8 },
  quadDrag: { x: 40, y: 55, z: 40 },
  yawLinDrag: 0.8, yawQuadDrag: 1.2, buoyancyTrimN: 0
} as const;
