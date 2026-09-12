import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createClayView,updateClayView} from '../dist/shaping-views.js';
import {Game,surfaceAt} from '../dist/simulation.js';
import {clayWallBounds} from '../dist/shaping.js';
import playground from '../dist/routes/clay-playground.js';
const w=Object.create(World.prototype);w.mat={};for(const name of ['top','terrain','cream'])w.mat[name]=new THREE.MeshStandardMaterial();
const game=new Game();game.start(3,playground);
for(const s of game.level.platforms.filter(s=>s.shape)){
  const view=createClayView(w,s,new THREE.Group()),buffers=view.clay.pieces.map(p=>p.mesh.geometry.attributes.position.array);
  for(const amount of [0,.2,.5,.8,1,.4,0]){
    for(const key of Object.keys(s.shape.from))s[key]=s.shape.from[key]+(s.shape.to[key]-s.shape.from[key])*amount;
    updateClayView(view,s);
    for(const [i,piece]of view.clay.pieces.entries()){
      const geo=piece.mesh.geometry;assert.equal(geo.attributes.position.array,buffers[i],'stable buffer, no geometry allocation per frame');
      assert(geo.attributes.position.array.every(Number.isFinite));assert(geo.attributes.normal.array.every(Number.isFinite));
      if(s.clayRole==='ramp'){
        const a=geo.attributes.position,index=geo.index;
        for(let j=0;j<index.count;j+=3){
          const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];
          if(!ids.every(k=>piece.rest[k*3+1]>.499&&Math.abs(piece.rest[k*3+2])<.3))continue;
          const x=ids.reduce((sum,k)=>sum+a.getX(k),0)/3,y=ids.reduce((sum,k)=>sum+a.getY(k),0)/3;
          assert(Math.abs(y-(surfaceAt(s,s.x+x)-s.y))<.035,'triangle interiors match the curved walking surface');
        }
      }
      if(piece.cap){const a=geo.attributes.position;for(let j=0;j<a.count;j++)assert(a.getY(j)<=surfaceAt(s,s.x+a.getX(j))-s.y+.001,'visible surface stays at or below collider');}
    }
  }
}
const landing=game.level.platforms.find(s=>s.id==='soft-landing');Object.assign(landing,landing.shape.to);
assert(clayWallBounds(landing,landing.y-5).right<landing.x+landing.w-2,'tapered pillar has no invisible wall under its wider cap');
console.log('PASS all clay poses: finite geometry/normals, stable buffers, collision-aligned caps and tapered pillar sides');
