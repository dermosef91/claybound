import * as THREE from './lib/three.module.js';
import {bridgeOffset,bridgeSag} from './bridge-surface.js';

// Constructed wood and rope use the game's shared hand-pressed clay finish.
// This is a fixed suspension bridge: the visible deck matches collision.
export function makeRopeBridge(w,s,g){
  g.name='Clay rope bridge';
  const sag=bridgeSag(s),deckY=x=>bridgeOffset(s,x),depth=1.86;
  const count=Math.max(3,Math.min(96,Math.ceil(s.w/.46))),step=s.w/count;
  for(let i=0;i<count;i++){
    const x=(i+.5)*step,y=deckY(x),angle=Math.atan(-4*sag/s.w*(1-2*x/s.w));
    const plank=new THREE.Group();plank.name='Bridge plank';plank.position.set(x,y-.15,0);plank.rotation.z=angle;g.add(plank);
    w.box(step+.015,.3,depth+(i%3-1)*.045,'bark',plank,0,0,0,.105);
    // Low, broad grain ridges catch sunlight without noisy painted stripes.
    for(const z of [-.52,.02,.57]){
      const ridge=w.box(step*.77,.026,.035,'barkLight',plank,0,.147,z+Math.sin(i*2.1)*.025,.012);
      ridge.rotation.y=(i%2?1:-1)*.045;
    }
  }
  const curve=(fn,segments=40)=>new THREE.CatmullRomCurve3(Array.from({length:segments+1},(_,i)=>new THREE.Vector3(...fn(i/segments))));
  const tube=(path,r,material,segments=64)=>w.mesh(new THREE.TubeGeometry(path,segments,r,7,false),material,g);
  // Continuous curved timbers under the cross-planks give the small bridge a
  // stout wooden silhouette, with long irregular grain along its front face.
  for(const z of [-.79,.79])tube(curve(t=>[s.w*t,deckY(s.w*t)-.245,z]),.135,'bark');
  for(const y of [-.18,-.28])tube(curve(t=>[s.w*t,deckY(s.w*t)+y+Math.sin(t*31)*.012,.914]),.017,'barkLight');
  function ropePath(fn,r=.065){
    const path=curve(fn),length=path.getLength(),segments=Math.min(384,Math.ceil(length*36));
    tube(path,r,'rope',segments);
    // A narrow winding strand makes the large handrail read as twisted cord.
    const winding=curve(t=>{
      const p=path.getPoint(t),tangent=path.getTangent(t),a=t*length*29;
      const normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
      p.addScaledVector(normal,Math.cos(a)*r*.91);p.z+=Math.sin(a)*r*.91;return p.toArray();
    },segments);
    tube(winding,r*.3,'cream',segments);
  }
  // Rear posts and handrail leave the character's body readable from the side.
  for(const x of [.02,s.w-.02]){
    const post=w.box(.4,1.2,.44,'bark',g,x,.47,-.73,.14);post.name='Bridge anchor post';
    w.ball(.20,.085,.22,'barkLight',g,x,1.04,-.73);
    for(const dx of [-.10,.06])w.box(.024,.78,.022,'barkLight',g,x+dx,.45,-.50,.011);
    ropePath(t=>{const a=t*Math.PI*6;return [x+Math.cos(a)*.255,.66+t*.17,-.73+Math.sin(a)*.27];},.055);
    w.ball(.09,.10,.085,'rope',g,x+(x<s.w/2?.22:-.22),.68,-.64);
  }
  const railY=x=>.75-4*(sag+.12)*(x/s.w)*(1-x/s.w);
  ropePath(t=>[s.w*t,railY(s.w*t),-.70],.072);
  for(const z of [-.73,.83])ropePath(t=>[s.w*t,deckY(s.w*t)-.30,z],.058);
  const ties=Math.max(2,Math.min(24,Math.round(s.w/1.15)));
  for(let i=1;i<=ties;i++){
    const x=s.w*i/(ties+1),y=deckY(x),top=railY(x);
    // Loops hug the plank edge, with a double lashing rising to the rear rail.
    for(const dx of [-.055,.055]){
      ropePath(t=>[x+dx,y-.15+Math.cos(t*Math.PI*2)*.255,Math.sin(t*Math.PI*2)*1.01],.054);
      w.rope([x+dx,y+.06,-.72],[x+dx,top,-.70],g,.05,true);
    }
    const knot=tube(curve(t=>{const a=t*Math.PI*4;return [x+Math.cos(a)*.10,top-.15+t*.23,-.70+Math.sin(a)*.13];},28),.059,'rope',36);knot.name='Bridge rope knot';
    w.rope([x-.11,top-.13,-.55],[x+.11,top+.08,-.57],g,.047,true);
    w.rope([x+.02,y-.27,.94],[x-.03,y-.48,.99],g,.05,true);
  }
  return {root:g,ropes:[],bounce:0};
}
