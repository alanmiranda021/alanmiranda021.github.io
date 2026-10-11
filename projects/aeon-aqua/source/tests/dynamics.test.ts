import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VehicleDynamics, type BodyForces } from '../src/physics/VehicleDynamics';

const zero: BodyForces = { surge: 0, sway: 0, heave: 0, yawTorque: 0 };
const still = new THREE.Vector3();

describe('VehicleDynamics', () => {
  it('atinge a velocidade terminal prevista pelo arrasto', () => {
    const g = new THREE.Group(), d = new VehicleDynamics();
    const forces = { ...zero, surge: 60 };
    for (let i = 0; i < 60 * 30; i++) d.step(g, forces, still, 1 / 60);
    const v1 = d.vel.z;
    for (let i = 0; i < 60; i++) d.step(g, forces, still, 1 / 60);
    expect(Math.abs(d.vel.z - v1)).toBeLessThan(0.01);
    expect(d.vel.z).toBeCloseTo((-8 + Math.sqrt(8 ** 2 + 4 * 40 * 60)) / 80, 3);
    expect(g.position.z).toBeLessThan(0);
  });

  it('para quando o empuxo cessa', () => {
    const g = new THREE.Group(), d = new VehicleDynamics();
    d.vel.z = 1;
    for (let i = 0; i < 60 * 20; i++) d.step(g, zero, still, 1 / 60);
    expect(Math.abs(d.vel.z)).toBeLessThan(0.01);
  });

  it.each([0, Math.PI / 2, -Math.PI / 2, Math.PI])('deriva na direção mundial da corrente com rumo %s', yaw => {
    const g = new THREE.Group(), d = new VehicleDynamics();
    g.rotation.y = yaw;
    const current = new THREE.Vector3(0.3, 0, 0);
    for (let i = 0; i < 60 * 20; i++) d.step(g, zero, current, 1 / 60);
    expect(g.position.x).toBeGreaterThan(4);
    expect(Math.abs(g.position.z)).toBeLessThan(0.001);
  });

  it('reset zera as velocidades', () => {
    const d = new VehicleDynamics();
    d.vel.set(1, 2, 3); d.yawRate = 1;
    d.reset();
    expect(d.vel.length()).toBe(0);
    expect(d.yawRate).toBe(0);
  });
});
