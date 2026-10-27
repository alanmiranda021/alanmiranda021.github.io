import * as THREE from 'three';
import { ROV } from './ROV';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import modelUrl from '../assets/hercules.glb?inline';
export function createROV(scene: THREE.Scene): ROV {
  const group = new THREE.Group();
  const placeholder = new THREE.Group();
  group.add(placeholder);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0a928, roughness: 0.52, metalness: 0.12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x172833, roughness: 0.7, metalness: 0.35 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x849ba4, roughness: 0.3, metalness: 0.75 });
  placeholder.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 1.2), bodyMat));
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1), darkMat); frame.position.y = 0.42; placeholder.add(frame);
  const housing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), metalMat); housing.position.set(0, 0.02, -0.68); placeholder.add(housing);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: 0x36d9ff, emissive: 0x0b526a, metalness: 0.7 })); lens.position.set(0, 0.02, -0.86); placeholder.add(lens);
  const positions: [number,number,number][] = [[-.8,0,-.48],[.8,0,-.48],[-.8,0,.48],[.8,0,.48],[-.55,-.1,-.35],[.55,-.1,-.35],[-.55,-.1,.35],[.55,-.1,.35]];
  const rov = new ROV(group);
  positions.forEach(([x,y,z],i) => { const vertical = i >= 4; const c = new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.34,16),darkMat); c.position.set(x,y+(vertical?-.15:0),z); if(!vertical)c.rotation.x=Math.PI/2; placeholder.add(c); const inner=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.08,12),metalMat); inner.position.copy(c.position); if(!vertical)inner.rotation.x=Math.PI/2; placeholder.add(inner); });
  const lamp = new THREE.SpotLight(0xe0f7ff, 55, 18, Math.PI/5, .55, 1.3); lamp.position.set(0,.05,-.4); lamp.target.position.set(0,0,-5);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.bias=-.0005; group.add(lamp,lamp.target);
  const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:25},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:0xe4b65f}));tether.name='tether';group.add(tether);
  scene.add(group);
  const status = document.createElement('div');
  status.textContent = 'Carregando veículo…';
  status.setAttribute('role', 'status');
  status.style.cssText = 'position:absolute;bottom:12px;left:12px;padding:8px 12px;background:#061522dd;color:#9ed9e8;border-radius:6px;font:12px system-ui;pointer-events:none;z-index:2';
  scene.userData.modelStatus = 'loading';
  // The status belongs to the viewport, alongside its canvas.
  document.querySelector('#viewport')?.appendChild(status);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.load(modelUrl, gltf => {
    const model = gltf.scene;
    // Source is Y-up, with its long axis along Z. Forward uses local -Z.
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 2.1 / Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(scale);
    model.position.sub(bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale));
    model.name = 'ROV_GLTF';
    group.add(model);
    model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});

    group.remove(placeholder);
    const geometries = new Set<THREE.BufferGeometry>();
    placeholder.traverse(object => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    geometries.forEach(geometry => geometry.dispose());
    bodyMat.dispose(); darkMat.dispose(); metalMat.dispose();
    lens.material.dispose();
    scene.userData.modelStatus = 'ready';
    const viewport = document.querySelector<HTMLElement>('#viewport');
    if (viewport) viewport.dataset.modelStatus = 'ready';
    status.dataset.modelStatus = 'ready';
    status.textContent = 'Veículo pronto';
    setTimeout(() => status.remove(), 2000);
  }, undefined, error => {
    scene.userData.modelStatus = 'error';
    status.dataset.modelStatus = 'error';
    status.textContent = 'Modelo indisponível · veículo básico ativo';
    console.error('Falha ao carregar o modelo do veículo', error);
  });
  return rov;
}
