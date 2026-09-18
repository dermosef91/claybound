// Game-style steering for the menus. The arrows (and W/A/S/D) move the
// browser's real focus between the controls of whichever menu is up, so Enter
// and Space keep their native meaning, a screen reader follows along, and a
// mouse player sees nothing change. Which control is "below" or "to the right"
// is read from the laid-out boxes rather than from markup: the corner X, the
// two-up rows, the character grid and every future menu get steering without
// a row attribute each, and the answer follows the responsive layout instead
// of the order the HTML happened to be written in.
export const MENU_KEYS=Object.freeze({ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'});
const VERTICAL=new Set(['up','down']);
const isRange=el=>!!el&&el.tagName==='INPUT'&&el.type==='range';
const isCorner=el=>!!el?.classList?.contains('dialog-close');

// The direction a key asks for, or null. A slider keeps left and right for its
// own value; up and down still leave it. Anything with a modifier is the
// browser's (Cmd+W closes the tab, Cmd+A selects, Cmd+D bookmarks).
export function menuDirection(code,active,{modifier=false}={}){
  if(modifier)return null;
  const direction=MENU_KEYS[code]||null;
  return direction&&!VERTICAL.has(direction)&&isRange(active)?null:direction;
}

// The controls a menu can steer between, in document order: enabled buttons
// and sliders that are laid out. A zero-size box is display:none — the title's
// hidden footer, a dialog that is not up — and never a target.
export function menuFocusables(root){
  if(!root)return [];
  return [...root.querySelectorAll('button,input[type="range"]')].filter(el=>{
    if(el.disabled)return false;
    const box=el.getBoundingClientRect();return box.width>0&&box.height>0;
  });
}

const right=b=>b.left+b.width,bottom=b=>b.top+b.height,centre=b=>({x:b.left+b.width/2,y:b.top+b.height/2});
// How a candidate box sits relative to the current one, for one direction:
// `ahead` says it starts past the current centre that way; `gap` is the space
// between the facing edges; `overlap` whether it shares the other axis with the
// current box (the same column for up/down, the same row for left/right); and
// `offset` how far its centre is from ours across that axis.
function relation(from,to,direction){
  const f=centre(from),t=centre(to);
  const column=to.left<right(from)&&right(to)>from.left,row=to.top<bottom(from)&&bottom(to)>from.top;
  if(direction==='down')return {ahead:to.top>=f.y,gap:to.top-bottom(from),overlap:column,offset:Math.abs(t.x-f.x)};
  if(direction==='up')return {ahead:bottom(to)<=f.y,gap:from.top-bottom(to),overlap:column,offset:Math.abs(t.x-f.x)};
  if(direction==='right')return {ahead:to.left>=f.x,gap:to.left-right(from),overlap:row,offset:Math.abs(t.y-f.y)};
  if(direction==='left')return {ahead:right(to)<=f.x,gap:from.left-right(to),overlap:row,offset:Math.abs(t.y-f.y)};
  return null;
}
const nearer=(a,b)=>a.gap-b.gap||a.offset-b.offset||a.index-b.index;

// The index of the nearest box in a direction, or -1. Nearest is the smallest
// gap between facing edges — the members of a row tie on that, and the one
// whose centre lines up best takes the tie, then document order. Sideways only
// looks along the current row, so a vertical list ignores left and right
// rather than leaping to the X in the corner. Up and down prefer the same
// column and, failing that, take the nearest thing in that direction, which is
// what the ragged last row of a grid needs.
export function pickNeighbour(boxes,from,direction){
  const origin=boxes[from];if(!origin)return -1;
  const ahead=[];
  boxes.forEach((box,index)=>{
    if(index===from)return;
    const rel=relation(origin,box,direction);
    if(rel?.ahead)ahead.push({index,overlap:rel.overlap,gap:Math.max(0,Math.round(rel.gap)),offset:Math.round(rel.offset)});
  });
  const aligned=ahead.filter(rel=>rel.overlap);
  const pool=aligned.length?aligned:VERTICAL.has(direction)?ahead:[];
  return pool.sort(nearer)[0]?.index??-1;
}

// Where an up or down press lands when nothing is ahead: the box at the far
// end, so a list reads as a loop. A row at that end goes to the member nearest
// our own column, then document order. Sideways never wraps.
export function wrapTarget(boxes,origin,direction){
  if(!VERTICAL.has(direction)||!origin)return -1;
  const f=centre(origin);
  const ranked=boxes.map((box,index)=>({index,edge:Math.round(direction==='down'?box.top:-bottom(box)),offset:Math.round(Math.abs(centre(box).x-f.x))}));
  ranked.sort((a,b)=>a.edge-b.edge||a.offset-b.offset||a.index-b.index);
  return ranked[0]?.index??-1;
}

// Move a menu's focus one step; true when focus moved or was placed. When
// nothing in the menu holds focus (the pointer took it, or the menu has just
// come up) the first press lands on the entry control rather than moving from
// nowhere. The X in the corner is reachable by going up past the top, but a
// wrap skips it: from the bottom of a list, down means the first item, not the
// close button. Focus is moved without preventScroll so a long list scrolls.
export function moveMenuFocus(root,direction,{items=menuFocusables(root),active=root?.ownerDocument?.activeElement}={}){
  if(!items.length)return false;
  const from=items.indexOf(active);
  if(from<0){(items.find(el=>!isCorner(el))||items[0]).focus();return true;}
  const boxes=items.map(el=>el.getBoundingClientRect());
  let target=pickNeighbour(boxes,from,direction);
  if(target<0){
    const others=items.map((_,i)=>i).filter(i=>i!==from),loop=others.filter(i=>!isCorner(items[i])),pool=loop.length?loop:others;
    const pick=wrapTarget(pool.map(i=>boxes[i]),boxes[from],direction);
    target=pick<0?-1:pool[pick];
  }
  if(target<0)return false;
  items[target].focus();return true;
}

// A held stick or d-pad walks a list the way a held key repeats: one step at
// once, a pause, then a steady walk. Times are milliseconds on the caller's
// clock, so the frame loop can pass performance.now() and a test can pass
// whatever it likes.
export class MenuRepeat{
  constructor({delay=180,interval=90}={}){this.delay=delay;this.interval=interval;this.direction=null;this.next=0;}
  step(direction,now){
    if(!direction){this.direction=null;return null;}
    if(direction!==this.direction){this.direction=direction;this.next=now+this.delay;return direction;}
    if(now<this.next)return null;
    this.next=now+this.interval;return direction;
  }
}
