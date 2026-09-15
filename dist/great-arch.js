import * as THREE from './lib/three.module.js';
import {canyonModel} from './canyon-assets.js';

// A fixed cutaway chamber behind the play lane. Its placement follows the
// entry and exit banks when an editor draft moves the section.
export function greatArchLayout(level){
  if(level.biome!=='desert')return null;
  const entry=level.platforms.find(s=>s.id==='arch-entry'),exit=level.platforms.find(s=>s.id==='arch-roof');
  if(!entry||!exit)return null;
  const left=entry.x+entry.w-8,right=exit.x+exit.w+2.8;
  return {left,right,width:right-left,base:entry.y-7.9,height:Math.max(26,exit.y-entry.y+21.4),entry,exit,lift:level.platforms.find(s=>s.id==='arch-lift')};
}

const ceilingY=layout=>layout.base+layout.height*.705;

function rearWall(w,root,layout){
  const origin=layout.entry.x+layout.entry.w,base=layout.entry.y;
  const shape=new THREE.Shape();
  shape.moveTo(0,-6);shape.lineTo(19,-6);shape.lineTo(20,7);shape.quadraticCurveTo(13,14,3,10);shape.lineTo(0,-6);
  // Small, uneven sky windows preserve the canyon setting within the chamber.
  for(const [x,y,rx,ry]of [[14.6,-.65,2.2,3.1],[3.2,2.1,1.1,2.1]]){
    const hole=new THREE.Path();
    for(let i=0;i<=24;i++){const a=-i*Math.PI/12,r=1+.07*Math.sin(i*2.3),px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;i?hole.lineTo(px,py):hole.moveTo(px,py);}
    shape.holes.push(hole);
  }
  const material=w.mat.terrain2.clone();material.color.multiplyScalar(.52);
  // Material.clone copies userData but not the relief shader callback.
  delete material.userData.clay;
  const wall=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:1.2,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.38,bevelThickness:.3,curveSegments:16}),material,root,origin,base,-10.5);
  wall.name='Recessed sandstone wall with sky windows';wall.castShadow=false;
  for(const [x,y,rx,ry]of [[8.8,4.4,2.6,3.1],[11.3,7.6,3.1,2.2],[8.6,-2.0,1.8,2.5],[18.3,3.8,2.6,3.2]]){
    const rock=w.ball(rx,ry,1.0,material,root,origin+x,base+y,-9.1);rock.name='Inner sandstone fold';rock.castShadow=false;
  }
}

export function buildGreatArch(w,layout){
  const root=new THREE.Group();root.name='Inside the Great Arch: canyon cave';w.levelRoot.add(root);
  const asset=w.canyonAssets?.cave;if(!asset)return root;
  rearWall(w,root,layout);
  const shell=canyonModel(w,'cave',root,(layout.left+layout.right)/2,layout.base,-5.25,layout.height);
  shell.name='Supplied sandstone cave';
  shell.scale.x=layout.width/asset.width;
  shell.scale.z=5.3/asset.depth;
  // All stone stays behind z=-2.6, clear of the hero and landing surfaces.
  shell.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  if(layout.lift)for(const offset of [.3,layout.lift.w-.3]){
    const anchor=w.box(.3,.22,2.5,'bark',root,(layout.lift.baseX??layout.lift.x)+offset,ceilingY(layout),-1.63,.08);
    anchor.name='Lift ceiling socket';
  }
  root.userData.greatArch={...layout,frontZ:-2.6};
  return root;
}

export function archLiftCeiling(w,s){
  if(s.id!=='arch-lift')return null;
  const layout=greatArchLayout(w.currentLevel);return layout?ceilingY(layout):null;
}

export function greatArchLedge(w,s,root){
  if(w.biome!=='desert'||!['arch-shelf','arch-balcony','arch-flower'].includes(s.id))return;
  const profile=[[.04,-1.75],[.18,-1.52],[.26,-1.0],[.48,-.56],[.72,-.35]].map(([r,y])=>new THREE.Vector2(r,y));
  const rock=w.mesh(new THREE.LatheGeometry(profile,12),'terrain2',root,s.w*.52,0,-.65);
  rock.scale.set(Math.min(1.35,s.w*.32),1,1.4);rock.name='Sandstone ledge root';
}
