import {it,expect} from 'vitest';
import * as THREE from 'three';
import {ShipCollision} from '../src/physics/ShipCollision';
import {SIM_CONFIG} from '../src/core/config';

it('resolve contato com a malha e preserva o deslizamento',()=>{
  const box=new THREE.Mesh(new THREE.BoxGeometry(2,2,2));box.position.y=-8;
  const collision=new ShipCollision(box);
  const position=new THREE.Vector3(1.5,-8,0),velocity=new THREE.Vector3(-1,0,1);
  collision.resolve(position,velocity);
  expect(position.x).toBeCloseTo(1+SIM_CONFIG.rovRadius,3);
  expect(velocity.x).toBe(0);expect(velocity.z).toBe(1);
});

it('permite operar no espaço vazio abaixo do casco',()=>{
  const ship=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.BoxGeometry(8,2,4));hull.position.y=-3;ship.add(hull);
  const collision=new ShipCollision(ship);
  const position=new THREE.Vector3(0,-8,0),velocity=new THREE.Vector3(0,0,-1);
  collision.resolve(position,velocity);
  expect(position.toArray()).toEqual([0,-8,0]);expect(velocity.z).toBe(-1);
});
