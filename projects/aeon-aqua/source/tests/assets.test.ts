import { it, expect } from 'vitest';
import * as THREE from 'three';
import { prepareFlatModel } from '../src/core/loadSceneModel';

it.each([new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)])('centraliza, dimensiona e alinha modelos planos: %s',normal=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(100,20,80));
  mesh.position.set(30,50,-10);
  const visual=prepareFlatModel(mesh,3,normal);
  const bounds=new THREE.Box3().setFromObject(visual);
  expect(bounds.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-8);
  const size=bounds.getSize(new THREE.Vector3());
  expect(Math.max(...size.toArray())).toBeCloseTo(3);
  expect(normal.x ? size.x : size.y).toBeCloseTo(.6);
});
