// Only helpers: all landings, branches and connections are placed by hand.
export const p=(id,x,w,y,kind='stone',extra={})=>({id,x,w,y,kind,...extra});
export const row=(x,y,n,spacing=1.1)=>Array.from({length:n},(_,i)=>({x:x+i*spacing,y}));
export const arc=(x,y,dx,dy,n=5,height=1.2)=>Array.from({length:n},(_,i)=>{const t=(i+1)/(n+1);return {x:x+dx*t,y:y+dy*t+Math.sin(t*Math.PI)*height};});
export const path=ids=>ids.slice(1).map((entry,i)=>({from:Array.isArray(ids[i])?ids[i][0]:ids[i],to:Array.isArray(entry)?entry[0]:entry,mode:Array.isArray(entry)?entry[1]:'jump'}));
// Make room inside a finished chapter. Everything from `seam` rightwards moves
// `gap` units right, and any pit or draught that straddles the seam is stretched
// to cover the new ground, so a whole section can be authored into the space
// without renumbering the rest of the chapter by hand. The authored coordinates
// above stay exactly as they were written, which is what keeps a route readable
// after it has been opened up.
export function makeRoom(data,seam,gap){
  const move=x=>typeof x==='number'&&x>=seam?x+gap:x;
  const d=structuredClone(data);
  for(const s of d.platforms){
    s.x=move(s.x);
    if(s.checkpoint!==undefined)s.checkpoint=move(s.checkpoint);
    for(const pose of [s.shape?.from,s.shape?.to])if(pose)pose.x=move(pose.x);
  }
  for(const name of ['coins','stamps','enemies','hazards','hints','sections','winds','crushers','decor'])
    for(const item of d[name]||[]){
      // A span that starts before the seam and ends after it now covers the new
      // ground too: a chasm opened up is a longer chasm, not a shifted one.
      if(item.w!==undefined&&item.x<seam&&item.x+item.w>seam)item.w+=gap;
      item.x=move(item.x);
      for(const key of ['end','min','max'])if(item[key]!==undefined)item[key]=move(item[key]);
    }
  for(const key of ['x','left','right','triggerX'])if(d.boss?.[key]!==undefined)d.boss[key]=move(d.boss[key]);
  if(d.spawn)d.spawn.x=move(d.spawn.x);
  for(const station of d.shaping||[]){station.x=move(station.x);station.end=move(station.end);station.spawn.x=move(station.spawn.x);}
  d.end=move(d.end);
  return d;
}

export function chapter(data){
  const L={layoutVersion:3,winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],...data};
  // Editor exports retain explicit links after platforms are moved or removed.
  // Preserve those links verbatim when supplied; authored route arrays still
  // use the compact path helper below.
  L.routeLinks=L.routeLinks?structuredClone(L.routeLinks):path(L.route||[]);delete L.route;
  L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
  for(const p of L.platforms)p.section=L.sections.findLast(s=>p.x>=s.x)?.id??0;
  const goal=L.platforms.find(p=>p.goal);goal.bellX=L.end-goal.x;
  L.originalDistance=L.previousDistance/10;return L;
}
