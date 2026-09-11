// Only helpers: all landings, branches and connections are placed by hand.
export const p=(id,x,w,y,kind='stone',extra={})=>({id,x,w,y,kind,...extra});
export const row=(x,y,n,spacing=1.1)=>Array.from({length:n},(_,i)=>({x:x+i*spacing,y}));
export const arc=(x,y,dx,dy,n=5,height=1.2)=>Array.from({length:n},(_,i)=>{const t=(i+1)/(n+1);return {x:x+dx*t,y:y+dy*t+Math.sin(t*Math.PI)*height};});
export const path=ids=>ids.slice(1).map((entry,i)=>({from:Array.isArray(ids[i])?ids[i][0]:ids[i],to:Array.isArray(entry)?entry[0]:entry,mode:Array.isArray(entry)?entry[1]:'jump'}));
export function chapter(data){
  const L={layoutVersion:3,winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],...data};
  L.routeLinks=path(L.route);delete L.route;
  L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
  for(const p of L.platforms)p.section=L.sections.findLast(s=>p.x>=s.x)?.id??0;
  const goal=L.platforms.find(p=>p.goal);goal.bellX=L.end-goal.x;
  L.originalDistance=L.previousDistance/10;return L;
}
