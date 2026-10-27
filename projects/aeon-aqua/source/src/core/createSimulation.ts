import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SIM_CONFIG } from './config';
import { createROV } from '../rov/createROV';
import type { ROV } from '../rov/ROV';
import { loadSceneModel } from './loadSceneModel';
import { ShipCollision } from '../physics/ShipCollision';
import { PropellerMission } from '../missions/PropellerMission';
import workboatUrl from '../assets/cargo.glb?inline';
import { createUnderwaterEnvironment } from '../rendering/UnderwaterEnvironment';
export interface Simulation { scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;orbit:OrbitControls;rov:ROV;mission:PropellerMission;targetDistance:number;setView:(cargo:boolean)=>void;step:(dt:number,toolActive?:boolean)=>void;render:(dt:number)=>void;reset:()=>void }
export function createSimulation(container:HTMLElement):Simulation {
 const scene=new THREE.Scene();scene.background=new THREE.Color(SIM_CONFIG.waterColor);scene.fog=new THREE.FogExp2(SIM_CONFIG.fogColor,.012);
 const camera=new THREE.PerspectiveCamera(55,1,.1,400);camera.position.set(8,4,10);
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setSize(container.clientWidth,container.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0x9bdcff,0x03121c,1.2));const light=new THREE.DirectionalLight(0x82d7ff,1.4);light.position.set(-8,12,4);scene.add(light);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const count=700, positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*90;positions[i*3+1]=(Math.random()-.5)*40-8;positions[i*3+2]=(Math.random()-.5)*90;}const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(positions,3));const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:0x9ed9e8,size:.055,transparent:true,opacity:.42}));scene.add(particles);
 const hulls:THREE.Box3[]=[];
 let shipCollision:ShipCollision|undefined;
 const viewport = container;
 const environment=createUnderwaterEnvironment(scene,renderer,hulls,container);
 viewport.dataset.shipStatus='loading';
 loadSceneModel(workboatUrl,model=>{
   const box=new THREE.Box3().setFromObject(model);
   const scale=60/(box.max.x-box.min.x);
   model.position.sub(box.getCenter(new THREE.Vector3()));
   const boat=new THREE.Group();boat.add(model);boat.scale.setScalar(scale);
   boat.position.set(21,-8.2+(box.max.y-box.min.y)*scale/2,-8);
   boat.name='CARGO_SHIP';
   boat.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
   scene.add(boat);boat.updateMatrixWorld(true);
   const propeller=boat.getObjectByName('Object_8');
   if(!propeller)throw new Error('Cargo ship propeller node Object_8 is missing');
   missionTarget.copy(new THREE.Box3().setFromObject(propeller).getCenter(new THREE.Vector3()));
   net.position.copy(missionTarget);net.position.x-=.3;
   beacon.position.copy(missionTarget);beacon.position.x-=.32;
   shipCollision=new ShipCollision(boat);
   rov.setSpawn(missionTarget.clone().add(new THREE.Vector3(-3,0,5.5)),missionTarget);
   rov.reset();camera.position.copy(rov.group.position).add(new THREE.Vector3(-4,3,5));orbit.target.copy(rov.group.position);
   viewport.dataset.propellerStatus='ready';
   viewport.dataset.shipStatus='ready';
 },error=>{viewport.dataset.shipStatus='error';console.error(error);});
 const mission=new PropellerMission();
 const missionTarget=new THREE.Vector3(-9.8,-7.2,-8);
 const netMaterial=new THREE.LineBasicMaterial({color:0xf9b34a,transparent:true,opacity:.95});
 const netPoints:THREE.Vector3[]=[];
 for(let i=-3;i<=3;i++){
   const offset=i*.25;
   netPoints.push(new THREE.Vector3(0,offset,-.8),new THREE.Vector3(0,offset,.8));
   netPoints.push(new THREE.Vector3(0,-.8,offset),new THREE.Vector3(0,.8,offset));
 }
 const net=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(netPoints),netMaterial);scene.add(net);
 net.name='PROPELLER_OBSTRUCTION';
 const beacon=new THREE.Mesh(new THREE.TorusGeometry(1.05,.015,6,48),new THREE.MeshBasicMaterial({color:0x51e6c2}));
 beacon.rotation.y=Math.PI/2;scene.add(beacon);
 viewport.dataset.propellerStatus='loading';
 let time=0; const current=new THREE.Vector3();
 const rov=createROV(scene);rov.reset();camera.position.copy(rov.group.position).add(new THREE.Vector3(-4,3,5));const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.copy(rov.group.position);orbit.minDistance=3;orbit.maxDistance=30;
 const onboard=new THREE.PerspectiveCamera(70,16/9,.05,100);onboard.position.set(0,.12,-1.15);rov.group.add(onboard);
 const pip=document.querySelector<HTMLElement>('#rov-camera');
 let cargoView=false;const cargoFocus=new THREE.Vector3(21,2,-8);
 const toTarget=new THREE.Vector3(),forward=new THREE.Vector3();
 const resize=()=>{const w=Math.max(container.clientWidth,1),h=Math.max(container.clientHeight,1);camera.aspect=w/h;camera.fov=w<h?65:55;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio,w<=900||matchMedia('(pointer:coarse)').matches?1.25:1.75));renderer.setSize(w,h);};new ResizeObserver(resize).observe(container);
 return {scene,camera,renderer,orbit,rov,mission,
 setView(cargo:boolean){cargoView=cargo;orbit.maxDistance=cargo?120:30;orbit.target.copy(cargo?cargoFocus:rov.group.position);camera.position.copy(cargo?new THREE.Vector3(12,30,70):rov.group.position.clone().add(new THREE.Vector3(-4,3,5)));},
 get targetDistance(){return rov.group.position.distanceTo(missionTarget);},
 reset(){cargoView=false;orbit.maxDistance=30;time=0;rov.reset();Object.assign(mission,new PropellerMission());net.visible=true;netMaterial.opacity=.95;camera.position.copy(rov.group.position).add(new THREE.Vector3(-4,3,5));orbit.target.copy(rov.group.position);},
 step(dt:number,toolActive=false){
   if(viewport.dataset.shipStatus!=='ready')return;
   time+=dt;const base=.12*Math.exp(rov.group.position.y/40);current.set(base*Math.sin(time*.07),0,base*.6*Math.cos(time*.05));rov.update(dt,current,hulls,shipCollision);
   toTarget.copy(missionTarget).sub(rov.group.position);
   forward.set(0,0,-1).applyQuaternion(rov.group.quaternion);
   mission.update({distance:toTarget.length(),speed:rov.velocity.length(),alignment:forward.dot(toTarget.normalize()),toolActive,collision:rov.collision},dt);
   netMaterial.opacity=.95*(1-mission.cutProgress);net.visible=mission.cutProgress<1;
 },render(dt:number){
   environment.update(time,-rov.group.position.y);
   if(cargoView){(scene.fog as THREE.FogExp2).density=.003;(scene.background as THREE.Color).setHex(0x527d92);}
   const rotors=rov.group.userData.rotors as THREE.Group[]|undefined;
   rotors?.forEach((rotor,i)=>rotor.children.forEach(blade=>{blade.rotation.z+=rov.thrusters[i]*dt*45;}));
   rov.group.updateMatrixWorld(true);
   const tether=rov.group.getObjectByName('tether') as THREE.Line;
   if(tether){
     const anchor=rov.group.worldToLocal(new THREE.Vector3(-12.5,0,-2));
     const positions=tether.geometry.attributes.position;
     for(let i=0;i<positions.count;i++){
       const t=i/(positions.count-1);
       positions.setXYZ(i,anchor.x*t+Math.sin(Math.PI*t)*.5,.2+(anchor.y-.2)*t,anchor.z*t+Math.sin(Math.PI*t)*.3);
     }
     positions.needsUpdate=true;tether.geometry.computeBoundingSphere();
   }
   orbit.target.lerp(cargoView?cargoFocus:rov.group.position,Math.min(dt*1.2,1));orbit.update();particles.rotation.y+=dt*.002;
   renderer.setScissorTest(false);renderer.setViewport(0,0,container.clientWidth,container.clientHeight);renderer.render(scene,camera);
   if(pip && pip.offsetWidth>0){
     environment.update(time,-rov.group.position.y);
     const rect=pip.getBoundingClientRect(),canvas=renderer.domElement.getBoundingClientRect();
     onboard.aspect=rect.width/rect.height;onboard.updateProjectionMatrix();
     const x=rect.left-canvas.left,y=canvas.bottom-rect.bottom;
     renderer.setScissorTest(true);renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(x,y,rect.width,rect.height);
     renderer.render(scene,onboard);renderer.setScissorTest(false);
     renderer.setViewport(0,0,container.clientWidth,container.clientHeight);
   }
 }};
}
