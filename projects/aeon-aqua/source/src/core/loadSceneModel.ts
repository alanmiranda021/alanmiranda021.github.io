import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Center a flat model and align its thinnest axis with the desired shaft/normal. */
export function prepareFlatModel(model: THREE.Object3D, diameter: number, normal: THREE.Vector3) {
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const axes = [size.x, size.y, size.z];
  const index = axes.indexOf(Math.min(...axes));
  const axis = new THREE.Vector3(index === 0 ? 1 : 0, index === 1 ? 1 : 0, index === 2 ? 1 : 0);
  const aligned = new THREE.Group();
  aligned.add(model);
  aligned.quaternion.setFromUnitVectors(axis, normal.clone().normalize());
  box = new THREE.Box3().setFromObject(aligned);
  const scale = diameter / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const centered = new THREE.Group();
  centered.add(aligned);
  aligned.position.sub(box.getCenter(new THREE.Vector3()));
  centered.scale.setScalar(scale);
  return centered;
}

export function loadSceneModel(url: string, ready: (model: THREE.Group) => void, failed: (error: unknown) => void) {
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, gltf => ready(gltf.scene), undefined, failed);
}
