// Export the actual runtime sculpture for an offline geometry/material review.
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createSporeBall,animateSporeBall} from '../dist/spore-ball.js';
import {attachClay} from '../tests/load-clay.mjs';
import {exportReview} from './review-scene.mjs';
const w=Object.assign(Object.create(World.prototype),{mat:{},assetGeometry:new Set(),assetMaterials:new Set()});
const images=await attachClay(w),scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
createSporeBall(w,{x:0,y:0,w:2.8},root);animateSporeBall(root,2.34,false);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe7e2d6,roughness:1}));floor.rotation.x=-Math.PI/2;root.updateMatrixWorld(true);floor.position.y=new THREE.Box3().setFromObject(root.userData.pod,true).min.y-.025;scene.add(floor);
await exportReview(scene,null,process.argv[2]||'/tmp/claybound-spore-ball-review',{camera:{x:1.4,y:-1,z:12,elevation:2.5,viewW:5.4,viewH:5.4}},images);
