// Ember Caverns and Wildwood: distant grotto arches and cave fog, the
// Breathing Tree, and the drifters that have to survive a chapter change.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {animateEnvironment} from '../dist/environments.js';
import {Game} from '../dist/simulation.js';
import {cameraTarget,cameraFraming,VERTICAL_BIAS} from '../dist/camera.js';
import {animateForest} from '../dist/forest-details.js';
import {animateCircuit} from '../dist/mechanism-views.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
for(const [index,stops]of [[1,[[4,0],[52,7.8],[101,8.1],[162,20],[260,33.4]]],[2,[[4,0],[53,5.2],[110,11.5],[215,20.5],[291,27.6]]]]){
  const g=new Game();g.start(index);w.build(g.level,index);const before=JSON.stringify(g.level);
  for(const [x,y]of [...stops,...stops.slice().reverse()]){
    w.syncVisible(g.level,x,true);w.cameraX=x;w.cameraY=y+2;animateEnvironment(w,0);w.scene.updateMatrixWorld(true);
    assert(!w.scene.getObjectByName('Clay cottage with laundry'),'forest and cave scenery contains no blue cottages');
    if(index===1){
      assert(w.depthRoot.getObjectByName('Forest hills'),'supplied mossy bushes form the foreground');
      assert(w.backRoot.getObjectByName('Forest grove')&&w.backRoot.getObjectByName('Forest falls'));
      assert.equal(w.parallax.find(p=>p.group.name==='Skybridge Falls skyline').factor,.18);
      const depths=['Forest grove','Forest falls'].map(name=>w.backRoot.getObjectByName(name).getWorldPosition(new THREE.Vector3()).z);
      assert(depths[1]<depths[0]&&depths[0]<-5);
      for(const [key,triangles]of [['hills',3126],['grove',10414],['falls',10254],['waterfall',10274]]){
        let total=0;w.forestAssets[key].scene.traverse(o=>{if(o.isMesh){total+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);}});assert.equal(total,triangles);
      }
      assert(w.torchLights.every(l=>l.intensity===0),'cave illumination does not leak into the forest');
      // The Brittle Canopy's falls are one landmark rather than another tiled
      // crown, so the checks are about belonging to a passage: a single copy
      // exists, it is in frame while the route is in that passage and out of
      // frame everywhere else, and it drifts and sits between the two crown
      // layers so the near trunks still pass in front of it.
      const passage=g.level.sections.find(s=>s.backdrop==='waterfall');
      const copies=[];w.backRoot.traverse(o=>{if(o.name==='Forest waterfall')copies.push(o);});
      assert.equal(copies.length,1,'the falls never wrap a second copy into the chapter');
      const vista=w.parallax.find(p=>p.group.name==='Vista: '+passage.name);
      const crown=name=>w.backRoot.getObjectByName(name).children[0].position.z;
      assert(vista.repeat>g.level.end,'its layer is too wide to wrap');
      assert(crown('Hazy canopy bridges')<copies[0].position.z&&copies[0].position.z<crown('Breathing forest trunks'));
      assert(w.parallax.find(p=>p.group.name==='Hazy canopy bridges').factor<vista.factor&&vista.factor<w.parallax.find(p=>p.group.name==='Breathing forest trunks').factor);
      // A landmark this size stays in frame for longer than the passage it
      // belongs to, because it is a horizon rather than a prop: it rises before
      // the first bough and recedes after the last. What has to hold is that it
      // is there throughout the passage and gone from the rest of the chapter.
      const falls=new THREE.Box3().setFromObject(copies[0],true);
      const framed=falls.max.x>x-w.viewW/2&&falls.min.x<x+w.viewW/2;
      if(x>=passage.x&&x<passage.end)assert(framed,`the falls are in frame throughout ${passage.name} (camera ${x})`);
      else if(x<passage.x-w.viewW||x>passage.end+w.viewW)assert(!framed,`and gone from the rest of the chapter (camera ${x})`);
      // Its base has to be below the bottom edge, or the cliff reads as a slab
      // floating in the haze. The vertical follow means the base rides highest
      // in the frame from the passage's lowest bough, so that stance — not
      // whichever one this loop happens to sample — is what has to be checked.
      // The lowest corner is the box's floor at its nearest depth, because the
      // camera looks down at the scene. Everything but the camera height here
      // is independent of it, so one stance answers for all of them.
      const tilt=(w.theme.cameraElevation??3.05)/Math.hypot(26,w.theme.cameraElevation??3.05);
      const boughs=g.level.platforms.filter(s=>s.x>=passage.x&&s.x<passage.end).map(s=>s.y);
      const eye=Math.min(...boughs)+w.viewH*VERTICAL_BIAS,follow=Math.min(1,1-vista.factor*.35);
      const base=falls.min.y-vista.group.position.y+Math.max(0,eye-1.1)*follow-eye-tilt*falls.max.z;
      assert(base<-w.viewH/2,`the falls run off the bottom of the frame, lowest stance leaves the base at ${base.toFixed(2)}`);
    }else{
      const models=[];w.backRoot.traverse(o=>{if(['Supplied glowing grotto','Supplied crystalcap cavern'].includes(o.name))models.push(o);});assert(models.length>=12&&models.length<=24,'layered scenery stays bounded');
      assert(models.some(m=>m.name==='Supplied glowing grotto')&&models.some(m=>m.name==='Supplied crystalcap cavern'));
      assert(!w.backRoot.getObjectByName('Broad stone bridge'),'the constructed arch is fully replaced');
      const distant=w.backRoot.getObjectByName('Distant cavern arches');assert(distant.children.length>=5);
      for(const chamber of distant.children){
        const model=chamber.getObjectByName('Supplied glowing grotto')||chamber.getObjectByName('Supplied crystalcap cavern');assert(model);
        assert.equal(model.scale.x,model.scale.y);assert.equal(model.scale.x,model.scale.z);
        model.traverse(o=>{if(o.isMesh){assert(w.assetGeometry.has(o.geometry));assert(o.material.map&&o.material.normalMap&&o.material.fog);}});
        assert(!w.torches.some(tr=>chamber.getObjectById(tr.flame.id)),'far haze models do not compete for nearby lights');
      }
      assert.equal(w.scene.fog.near,28);assert.equal(w.scene.fog.far,108);
      // Static backdrop cells are baked into one mesh per material and block of
      // space. Losing that merge multiplies the cave's draw calls and the world
      // matrices rebuilt every frame.
      let backdropMeshes=0;w.backRoot.traverse(o=>{if(o.isMesh)backdropMeshes++;});
      assert(backdropMeshes<350,`merged cave backdrop stays compact, held ${backdropMeshes} meshes`);
      for(const cell of w.backRoot.getObjectByName('Overhead cave silhouette').children){
        const merged=[];cell.traverse(o=>{if(o.name==='Merged cavern backdrop')merged.push(o);});
        assert(merged.length>0,'each overhead cell keeps its baked geometry');
        for(const mesh of merged)assert(mesh.geometry.attributes.position.count>0&&!mesh.castShadow);
      }
      for(const [key,triangles]of [['grotto',10120],['crystalcap',10382]])w.cavernAssets[key].scene.traverse(o=>{if(o.isMesh){assert(o.material.emissiveMap&&o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert.equal(o.geometry.index.count/3,triangles);}});
      for(const model of models)assert(model.getObjectByName('mushroom light anchor')&&model.getObjectByName('crystal light anchor'));
      const active=w.torchLights.filter(l=>l.intensity>0),colours=active.map(l=>l.color.getHex());
      assert(active.length<=4);assert.equal(w.torchLights.length,4);assert(colours.includes(0xff962f)&&colours.includes(0x46bbff),'nearby orange and blue accents both receive matching light');
      assert(w.torches.length<75,'lighting fixtures remain bounded after streaming and backtracking');
      assert(active.every(l=>l.position.toArray().every(Number.isFinite)&&l.distance<=13));
      // The roof must remain continuous when its cells wrap and when the route
      // climbs. A gap here exposes the sky through an otherwise enclosed cave.
      const vault=w.backRoot.getObjectByName('Overhead cave silhouette'),ray=new THREE.Raycaster();assert(vault);
      for(let sample=0;sample<=10;sample++){
        ray.set(new THREE.Vector3(w.cameraX+(sample/10-.5)*(w.viewW||18),w.cameraY+8,4),new THREE.Vector3(0,0,-1));
        assert(ray.intersectObject(vault,true).length>0,'continuous cave ceiling through scrolling, climbing and backtracking');
      }
      // Reproduce the phone's blank-background failure at the actual draw
      // boundary, including returning from a chapter that used a blur target.
      // Mesh existence alone cannot prove they reach the displayed framebuffer.
      for(const [width,height]of [[1536,691],[691,1536]]){
        w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();
        Object.assign(g.player,{x,y});
        const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);
        w.cameraX=target.x;w.cameraY=target.y;
        let framebuffer='unset';const calls=[],render=w.renderer.render,setTarget=w.renderer.setRenderTarget;
        w.renderer.setRenderTarget=value=>{framebuffer=value;};
        w.renderer.render=(scene,camera)=>{
          scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
          const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
          const visible=name=>{
            let count=0;
            w.backRoot.getObjectByName(name).traverseVisible(o=>{if(o.isMesh&&frustum.intersectsObject(o)&&o.material.visible&&o.material.opacity>0)count++;});
            return count;
          };
          calls.push({framebuffer,back:w.backRoot.visible,path:w.levelRoot.visible,composite:w.citadelDepth?.quad.visible,
            vault:visible('Overhead cave silhouette'),arches:visible('Distant cavern arches'),grottos:visible('Lit grotto recesses')});
        };
        try{w.render(g,0);}finally{w.renderer.render=render;w.renderer.setRenderTarget=setTarget;}
        assert.equal(calls.length,1,'caverns render directly instead of using the failing offscreen composite');
        const draw=calls[0];assert.equal(draw.framebuffer,null);
        assert(draw.back&&draw.path&&!draw.composite,'cave scenery and platforms reach the same visible render pass');
        assert(draw.vault>0&&draw.arches>0&&draw.grottos>0,`cave forms visible at ${x},${y} in ${width}×${height}`);
      }
    }
  }
  w.refreshEditor(g.level,stops.at(-1)[0]);animateEnvironment(w,0);
  assert.equal(JSON.stringify(g.level),before,'the art pass preserves all platforming, mechanisms and saves');
}
assert.equal(sharedDisposals,0);
console.log('PASS supplied distant grotto arches, stronger cave fog, bounded light handoffs, and direct cavern draw coverage in portrait/landscape through climbs and backtracking');

// The Breathing Tree redesign must preserve the real spring and seal surfaces,
// remain visible through the camera pass, and stop ambient motion when paused.
{
  const g=new Game();g.start(1);w.build(g.level,1,118);
  const seals=g.level.platforms.filter(p=>p.kind==='break');
  assert.equal(seals[0].w,seals[1].w,'both Wildwood breakable seals use the same full-size collider');
  for(const s of g.level.platforms.filter(p=>p.kind==='break')){
    w.syncVisible(g.level,s.x,true);w.scene.updateMatrixWorld(true);
    const root=w.platforms.get(s.id).root;assert.equal(root.name,'Stompable spore balloon');
    const pod=root.getObjectByName('Stompable seed');assert(pod);
    const b=new THREE.Box3().setFromObject(pod,true);
    assert(Math.abs(b.max.y-s.y)<.06&&Math.abs(b.min.x-s.x)<.06&&Math.abs(b.max.x-s.x-s.w)<.06,'every balloon matches its real seal collider');
  }
  w.syncVisible(g.level,118,true);
  Object.assign(g.player,{x:118,y:14});w.syncVisible(g.level,118,true);
  for(const s of g.level.platforms.filter(s=>s.kind==='spring')){
    w.syncVisible(g.level,s.x,true);w.scene.updateMatrixWorld(true);
    const mushroom=w.platforms.get(s.id).root.getObjectByName('Scarlet target spring');
    assert(mushroom);const box=new THREE.Box3().setFromObject(mushroom,true);
    assert(Math.abs(box.max.y-s.y)<.002,'the visible spring cap meets its collision top');
    assert(Math.abs(box.min.x-s.x)<.01&&Math.abs(box.max.x-s.x-s.w)<.01);
    const support=g.level.platforms.filter(p=>p.id!==s.id&&['stone','ledge'].includes(p.kind)&&s.x+s.w/2>=p.x&&s.x+s.w/2<=p.x+p.w&&p.y<s.y).sort((a,b)=>b.y-a.y)[0];
    assert(box.min.y>=support.y-.01,'the entire target pad remains above its supporting deck');
    assert(box.max.y-box.min.y>Math.min(.39,(s.y-support.y)*.95),'the spring has a readable profile within its authored deck clearance');
    mushroom.traverse(o=>{if(o.isMesh)assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap,'the target retains its source maps');});
  }
  w.syncVisible(g.level,118,true);w.scene.updateMatrixWorld(true);
  const seal=g.level.platforms.find(s=>s.id==='tree-seal'),seed=w.platforms.get(seal.id).root.getObjectByName('Stompable seed');
  const bounds=new THREE.Box3().setFromObject(seed,true);
  assert(Math.abs(bounds.max.y-seal.y)<.06,'stompable pod matches the actual landing surface');
  assert(Math.abs(bounds.min.x-seal.x)<.06&&Math.abs(bounds.max.x-seal.x-seal.w)<.06,'no invisible wide seal remains');
  const circuit=[...w.circuitViews.values()].find(v=>v.c.source===seal.id);
  animateCircuit(circuit,g);assert(circuit.cable.visible&&circuit.leaves.every(l=>l.visible));
  assert(circuit.lamp.scale.x<.2,'a small circuit lamp never becomes a second pod');
  seal.broken=true;seal.active=false;g.channels[seal.releases]=1;g.latched[seal.releases]=true;
  animateCircuit(circuit,g);assert(!circuit.cable.visible&&circuit.leaves.every(l=>!l.visible));assert(circuit.beads.every(l=>l.visible));
  g.checkpointId='tree-heart';g.checkpoint={x:124.2,y:14};
  const restored=new Game();restored.start(1);restored.restore(g.snapshot());
  assert(restored.level.platforms.find(p=>p.id===seal.id).broken&&restored.channels[seal.releases]>0,'opened seed and spore current survive resume');
  assert(!w.levelRoot.getObjectByName('Breathing Tree trunk'),'the breathing-tree climb has no decorative pillar');
  const heart=w.platforms.get('tree-heart').root.children.find(o=>o.userData.breathing);assert(heart);
  const leaf=w.ambient.find(a=>a.leaf).mesh;g.time=1;animateForest(w,g);animateEnvironment(w,0);const first=heart.scale.x;
  g.time=2;animateForest(w,g);animateEnvironment(w,0);assert.notEqual(heart.scale.x,first);
  const pose=[heart.scale.toArray(),leaf.position.toArray(),leaf.rotation.toArray()];g.status='paused';g.tick(.5,{});animateForest(w,g);animateEnvironment(w,.5);
  assert.deepEqual([heart.scale.toArray(),leaf.position.toArray(),leaf.rotation.toArray()],pose);
  w.reducedMotion=true;animateForest(w,g);animateEnvironment(w,0);const quiet=leaf.position.toArray();g.time+=2;animateForest(w,g);animateEnvironment(w,0);
  assert.equal(heart.scale.x,1);assert.deepEqual(leaf.position.toArray(),quiet);w.reducedMotion=false;
  for(const [width,height]of [[1672,941],[941,1672]])for(const [x,y]of [[118,14],[112,19.2],[135,20.2]]){
    w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();Object.assign(g.player,{x,y});w.syncVisible(g.level,x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);w.cameraX=target.x;w.cameraY=target.y;w.render(g,0);w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));let trees=0;
    w.backRoot.traverseVisible(o=>{if(o.isMesh&&o.material.map&&frustum.intersectsObject(o))trees++;});
    assert(trees>1,'supplied trees cover the climbing camera in both orientations');
    assert(!w.levelRoot.getObjectByName('Clay cottage with laundry'),'forest retains no blue cottages');
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS Breathing Tree spring/pod contact, opened vine and checkpoint resume, pause/reduced motion, and forest coverage through portrait/landscape climbs');

// A forest visit must not detach or hide the canyon's supplied Drifter models.
{
  const forest=new Game();forest.start(1);w.build(forest.level,1,118);
  const g=new Game();g.start(0);w.build(g.level,0);
  for(const [width,height]of [[1536,691],[691,1536]])for(const e of g.level.enemies){
    w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();
    Object.assign(g.player,{x:e.x-2,y:e.baseY-1.15});w.syncVisible(g.level,e.x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);w.cameraX=target.x;w.cameraY=target.y;w.render(g,0);
    w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
    const v=w.enemyViews.get(e.id);assert(v?.loaded&&v.kind==='drifter'&&v.root.visible&&v.model);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
    const bounds=new THREE.Box3().setFromObject(v.model,true);assert(frustum.intersectsBox(bounds));
    let meshes=0;v.model.traverseVisible(o=>{if(o.isMesh){meshes++;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(o.material.visible);}});assert(meshes>0);
    assert.equal(v.root.parent,w.levelRoot);assert(w.levelRoot.visible);
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS all four Dust Drifter models remain loaded and in view after forest-to-canyon changes, streaming and portrait/landscape framing');
