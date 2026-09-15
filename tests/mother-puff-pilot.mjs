// A replayable input-only pilot. No teleports, invulnerability, timer edits,
// damage calls, or direct boss-state changes during the encounter. It reads
// visible landing markers, waits through the early volley, then uses its one
// late yellow cap and simply lands on the crown.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function motherInput(g){
  const p=g.player,b=g.level.boss;
  let aim=b.state==='defeated'?b.right+4:b.left+8;
  const pad=b.patches.find(s=>s.color==='yellow'),seed=b.spores.find(s=>s.color==='yellow');
  if(pad||seed)aim=pad?.x??seed.targetX;
  if(p.motherBounce)aim=b.x-1;
  if(b.state==='sleeping')aim=b.triggerX+.5;
  const grounded=!!p.groundId,nearGround=p.y<b.y+2.8;
  let jumpPressed=false;
  if(!p.motherBounce&&b.hits<3){
    // A purple marker gives nearly two seconds to leave its landing circle.
    const danger=b.spores.find(s=>s.color==='purple'&&Math.abs(s.targetX-p.x)<3.0&&s.duration-s.age<1.35)
      ||b.patches.find(s=>s.color==='purple'&&s.age<.32&&Math.abs(s.x-p.x)<3.0);
    if(danger){
      const x=danger.targetX??danger.x;
      const left=clamp(x-3.3,b.left+.5,b.x-3.4),right=clamp(x+3.3,b.left+.5,b.x-3.4);
      aim=Math.abs(p.x-left)<Math.abs(p.x-right)?left:right;
      if(grounded&&Math.abs(p.x-x)<2.7)jumpPressed=true;
    }
    const child=g.level.enemies.find(e=>e.motherChild&&e.alive&&Math.abs(e.x-p.x)<3.9&&Math.abs(e.y-p.y)<2);
    if(child&&grounded&&nearGround)jumpPressed=true;
  }
  return {moveAxis:clamp((aim-p.x)*5/6.7,-1,1),jumpPressed,jumpHeld:true};
}
export function motherTransfer(original,link){
  const g=Object.assign(Object.create(Object.getPrototypeOf(original)),structuredClone({...original,onEvent:null}));g.onEvent=()=>{};
  const controls=[];
  for(let i=0;i<14400;i++){
    const input=motherInput(g);controls.push(input);g.tick(1/120,input);
    if(g.deaths>original.deaths||g.respawnTimer>0)return null;
    if(g.level.boss.state==='defeated'&&g.player.groundId===link.to)return {g,controls};
  }
  return null;
}
