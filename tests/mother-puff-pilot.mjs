// A replayable input-only pilot. No teleports, invulnerability, timer edits,
// damage calls, or direct boss-state changes during the encounter.
export function motherInput(g){
  const p=g.player,b=g.level.boss;
  let aim=b.state==='defeated'?b.right+4:b.x-5.9;
  if(p.motherBounce)aim=b.x;
  return {moveAxis:Math.max(-1,Math.min(1,(aim-p.x)*5/6.7)),jumpHeld:true,
    stompPressed:p.motherBounce&&p.y>b.y+7.1&&Math.abs(p.x-b.x)<1.5};
}
export function motherTransfer(original,link){
  const g=Object.assign(Object.create(Object.getPrototypeOf(original)),structuredClone({...original,onEvent:null}));g.onEvent=()=>{};
  const controls=[];
  for(let i=0;i<7200;i++){
    const input=motherInput(g);controls.push(input);g.tick(1/120,input);
    if(g.deaths>original.deaths||g.respawnTimer>0)return null;
    if(g.level.boss.state==='defeated'&&g.player.groundId===link.to)return {g,controls};
  }
  return null;
}
