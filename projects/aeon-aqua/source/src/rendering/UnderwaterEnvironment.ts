import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadSceneModel } from '../core/loadSceneModel';
import sandUrl from '../assets/sand.webp?inline';
import rocksUrl from '../assets/rocks.glb?inline';

export function createUnderwaterEnvironment(scene:THREE.Scene,renderer:THREE.WebGLRenderer,hulls:THREE.Box3[],container:HTMLElement) {
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const reflection=pmrem.fromScene(room,.04);scene.environment=reflection.texture;scene.environmentIntensity=.25;
  room.dispose();pmrem.dispose();
  const sand=new THREE.TextureLoader().load(sandUrl);
  sand.colorSpace=THREE.SRGBColorSpace;sand.wrapS=sand.wrapT=THREE.RepeatWrapping;sand.repeat.set(45,45);
  sand.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const terrain=new THREE.PlaneGeometry(250,250,96,96);
  terrain.rotateX(-Math.PI/2);
  const points=terrain.attributes.position;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i);
    points.setY(i,.13*Math.sin(x*.25+Math.sin(z*.12))+.07*Math.sin(z*.5));
  }
  terrain.computeVertexNormals();
  const bed=new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({color:0x8b9d8e,map:sand,bumpMap:sand,bumpScale:.08,roughness:1}));
  bed.position.y=-21.25;bed.receiveShadow=true;scene.add(bed);

  container.dataset.rocksStatus='loading';
  loadSceneModel(rocksUrl,model=>{
    model.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshStandardMaterial).color.setHex(0x485248);});
    for(let i=0;i<40;i++){
      const rock=model.clone(true);const angle=i*2.39996,radius=14+(i%9)*3.1;
      rock.position.set(-3+Math.cos(angle)*radius,-21.18,-8+Math.sin(angle)*radius);
      rock.scale.set(1.4+(i%4)*.6,1+(i%3)*.4,1.8+(i%5)*.5);rock.rotation.y=angle;
      rock.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      scene.add(rock);hulls.push(new THREE.Box3().setFromObject(rock));
    }
    container.dataset.rocksStatus='ready';
  },error=>{container.dataset.rocksStatus='error';console.error(error);});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshPhysicalMaterial({color:0x61b2bb,transparent:true,opacity:.24,roughness:.25,metalness:.05,side:THREE.DoubleSide}));
  water.rotation.x=Math.PI/2;scene.add(water);
  const beams=new THREE.Group();
  for(let i=0;i<5;i++){
    const beam=new THREE.Mesh(new THREE.ConeGeometry(2.8,23,20,1,true),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv;void main(){float edge=pow(sin(vUv.x*3.14159),2.0);float fade=smoothstep(0.0,0.3,vUv.y)*(1.0-smoothstep(0.8,1.0,vUv.y));gl_FragColor=vec4(0.3,0.6,0.65,0.008*edge*fade);}'
    }));
    beam.position.set(-18+i*9,-11,-12+i*4);beam.rotation.z=.16;beams.add(beam);
  }
  scene.add(beams);
  const causticCanvas=document.createElement('canvas');causticCanvas.width=causticCanvas.height=128;
  const context=causticCanvas.getContext('2d')!;
  const image=context.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const ridge=Math.sin(x*.21+Math.sin(y*.15)*2)+Math.cos(y*.22+Math.cos(x*.16)*2);
    const value=Math.round(20+235*Math.pow(Math.max(0,1-Math.abs(ridge)*3),5));
    const i=(y*128+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=value;image.data[i+3]=255;
  }
  context.putImageData(image,0,0);
  const caustic=new THREE.SpotLight(0x9cdde1,65,50,Math.PI/3,.8,1);
  caustic.position.set(-8,-.5,-6);caustic.target.position.set(-8,-21,-6);
  caustic.map=new THREE.CanvasTexture(causticCanvas);scene.add(caustic,caustic.target);
  const fog=scene.fog as THREE.FogExp2;
  const shallow=new THREE.Color(0x155061),deep=new THREE.Color(0x020f20);
  return {update(time:number,depth:number){
    const amount=THREE.MathUtils.clamp(depth/45,0,1);
    fog.color.copy(shallow).lerp(deep,amount);fog.density=.017+amount*.016;
    (scene.background as THREE.Color).copy(fog.color);
    beams.position.x=Math.sin(time*.08)*1.2;water.position.y=Math.sin(time*.4)*.04;
    caustic.target.position.x=-8+Math.sin(time*.2)*3;caustic.target.position.z=-6+Math.cos(time*.15)*3;
  }};
}
