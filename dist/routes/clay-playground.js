import city from './city.js';
import {p,row,path} from '../route-authoring.js';

// Independent copy: the original Hanging Quarter and its campaign saves stay intact.
const L=structuredClone(city),offset=120;
L.name='The Kneading Quarter';L.short='Clay playground';L.playground=true;L.layoutVersion=1;
L.label='Five ways to shape the world';L.intro='Pull, press and knead the rooftops. Then take your new hands into the Hanging Quarter.';
L.spawn={x:4.75,y:0};L.end+=offset;
for(const s of L.platforms){s.x+=offset;if(s.checkpoint)s.checkpoint+=offset;}
for(const list of [L.coins,L.stamps,L.enemies,L.hazards,L.hints,L.sections])for(const item of list){item.x+=offset;if(item.end!==undefined)item.end+=offset;if(item.min!==undefined)item.min+=offset;if(item.max!==undefined)item.max+=offset;}
// Chapter four's own three stations move with the copied chapter and stay
// playable, so the workshop still runs straight through to its bell.
const inherited=(L.shaping||[]).map(s=>({...s,x:s.x+offset,end:s.end+offset,spawn:{...s.spawn,x:s.spawn.x+offset}}));
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
L.platforms.unshift(
  p('workshop-start',-8,18,0,'stone',{entrance:true}),
  part('soft-support',{x:9.7,w:2.8,y:1.5,h:5},{x:9.3,w:3.6,y:.25,h:3.75},{station:'lift',clayRole:'support'}),
  p('kneaded-lift',13.6,4,5.4,'lift',{period:6,shapeLift:true,moveY:0}),
  p('lift-roof',18,9,1.1,'stone',{checkpoint:21,house:true}),
  p('ramp-dock',27,4,1.1,'stone'),
  part('soft-ramp',{x:30.6,w:2.3,y:3.5,h:3.05,slope:0},{x:30.6,w:7.8,y:1.1,h:.65,slope:3.3},{station:'ramp',clayRole:'ramp'}),
  p('ramp-roof',38.4,7.6,4.4,'stone',{checkpoint:42,house:true}),
  part('soft-landing',{x:50.2,w:1.5,y:3.7,h:7.2},{x:47.4,w:7.1,y:3.7,h:7.2},{station:'landing',clayRole:'landing'}),
  p('landing-roof',56,11,3.1,'stone',{checkpoint:59,arch:true}),
  ...[0,1,2].map(i=>part('soft-stair-'+i,{x:66.8+i*.8,w:.85,y:8.4,h:8.5},{x:66.8+i*2.35,w:2.4,y:4.8+i*1.8,h:4.9+i*1.8},{station:'stairs',clayRole:'stairs'})),
  p('stair-roof',73.85,10.15,8.4,'stone',{checkpoint:78,house:true}),
  part('soft-bridge',{x:83.6,w:2.5,y:10.4,h:3.8},{x:83.6,w:10.6,y:8.4,h:.65},{station:'bridge',clayRole:'bridge'}),
  p('bridge-roof',94.2,8,8.4,'stone',{checkpoint:97}),
  p('workshop-down-1',103,3.5,6.3,'ledge'),p('workshop-down-2',107,3.5,3.7,'ledge'),
);
L.hazards.unshift({x:10,w:8,y:-3.7},{x:31,w:7.4,y:-3.5},{x:46,w:10,y:-3.5},{x:84,w:10.2,y:3.5});
L.coins.unshift(...row(15,2.5,2),...row(34,4.1,3),...row(49,4.7,4),...row(70,7.7,2),...row(87,9.4,5));
L.shaping=[
  {id:'lift',icon:'lift',name:'Lower the lift',verb:'Press down',gesture:'down',parts:['soft-support'],lift:'kneaded-lift',liftFrom:5.4,liftTo:1.4,x:3,end:25,spawn:{x:6,y:0,groundId:'workshop-start'},hint:'Drag the orange support down to lower the lift. Or hold E, or stomp it.'},
  {id:'ramp',icon:'ramp',name:'Stretch a ramp',verb:'Pull right',gesture:'right',parts:['soft-ramp'],x:25,end:44,spawn:{x:28,y:1.1,groundId:'ramp-dock'},hint:'Drag the orange clay right to stretch a ramp, or walk into it. Or hold E.'},
  {id:'landing',icon:'landing',name:'Widen the landing',verb:'Pull outward',gesture:'out',parts:['soft-landing'],x:44,end:62,spawn:{x:44,y:4.4,groundId:'ramp-roof'},hint:'Pull either edge of the landing outward to widen it. Or hold E.'},
  {id:'stairs',icon:'stairs',name:'Wall into stairs',verb:'Pull right',gesture:'right',parts:['soft-stair-0','soft-stair-1','soft-stair-2'],x:62,end:80,spawn:{x:64,y:3.1,groundId:'landing-roof'},hint:'Pull the orange wall right to knead out three steps, or walk into it. Or hold E.'},
  {id:'bridge',icon:'bridge',name:'Press a bridge',verb:'Press down',gesture:'down',parts:['soft-bridge'],x:80,end:103,spawn:{x:81,y:8.4,groundId:'stair-roof'},hint:'Press the tall orange clay down to span the gap. Drag down, hold E, or stomp it.'}
];
L.hints.unshift(...L.shaping.map(s=>({x:s.x,end:s.end-.001,icon:s.icon,title:s.name,text:s.hint})));
L.sections.unshift(...L.shaping.map(s=>({x:s.x===3?-8:s.x,name:s.name,landmark:'workshop'})));
L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
for(const s of L.platforms)s.section=L.sections.findLast(s0=>s.x>=s0.x)?.id??0;
L.routeLinks.unshift(...path(['workshop-start','soft-support','kneaded-lift','lift-roof','ramp-dock','soft-ramp','ramp-roof','soft-landing','landing-roof','soft-stair-0','soft-stair-1','soft-stair-2','stair-roof','soft-bridge','bridge-roof',['workshop-down-1','fall'],['workshop-down-2','fall'],['start','fall']]));
// Appended after the workshop's own prompts and section names are derived, so
// the inherited chapter-four stations add clay without adding workshop signage.
L.shaping.push(...inherited);
export default L;
