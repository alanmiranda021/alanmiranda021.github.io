import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SIM_CONFIG } from '../core/config';

/** Static world-space triangles allow access to the empty space under the stern. */
export class ShipCollision {
  private readonly tree: MeshBVH;
  private readonly sphere=new THREE.Sphere();
  private readonly closest=new THREE.Vector3();
  private readonly normal=new THREE.Vector3();
  constructor(ship:THREE.Object3D){
    ship.updateMatrixWorld(true);
    const vertices:number[]=[];
    ship.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      const positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++)vertices.push(positions.getX(i),positions.getY(i),positions.getZ(i));
      geometry.dispose();
    });
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    this.tree=new MeshBVH(geometry);
  }
  resolve(position:THREE.Vector3,velocity:THREE.Vector3){
    this.sphere.center=position;this.sphere.radius=SIM_CONFIG.rovRadius;
    for(let pass=0;pass<3;pass++){
      this.tree.shapecast({
        intersectsBounds:box=>box.intersectsSphere(this.sphere),
        intersectsTriangle:triangle=>{
          triangle.closestPointToPoint(position,this.closest);
          this.normal.copy(position).sub(this.closest);
          const distance=this.normal.length();
          if(distance>=this.sphere.radius)return false;
          if(distance>1e-8)this.normal.divideScalar(distance);else triangle.getNormal(this.normal);
          position.addScaledVector(this.normal,this.sphere.radius-distance+1e-5);
          const inward=velocity.dot(this.normal);
          if(inward<0)velocity.addScaledVector(this.normal,-inward);
          return false;
        }
      });
    }
  }
}
