// Menu steering on boxes alone: no browser, no layout engine. The boxes are
// the menus as the stylesheet lays them out at desktop width, in CSS pixels
// (the dialog card is 560 wide with 38 of padding, so content runs x 38..522).
import assert from 'node:assert/strict';
import {MENU_KEYS,menuDirection,menuFocusables,pickNeighbour,wrapTarget,moveMenuFocus,MenuRepeat} from '../dist/menu-controls.js';

const box=(left,top,width,height)=>({left,top,width,height});
let focused=null;
// Enough of a laid-out control for the module: a box, a tag, a class, focus.
const control=(name,rect,{close=false,range=false,disabled=false}={})=>({
  name,rect,disabled,tagName:range?'INPUT':'BUTTON',type:range?'range':'submit',
  classList:{contains:cls=>close&&cls==='dialog-close'},
  getBoundingClientRect(){return this.rect;},
  focus(){focused=this;},
});
const menu=(...items)=>({querySelectorAll:()=>items,ownerDocument:{get activeElement(){return focused;}}});
const step=(root,from,direction)=>{focused=from;moveMenuFocus(root,direction);return focused.name;};

// --- keys ------------------------------------------------------------------
assert.deepEqual(Object.values(MENU_KEYS).sort(),['down','down','left','left','right','right','up','up']);
const slider=control('music',box(0,0,10,10),{range:true}),button=control('b',box(0,0,10,10));
assert.equal(menuDirection('ArrowDown',button),'down');assert.equal(menuDirection('KeyW',button),'up');assert.equal(menuDirection('KeyA',button),'left');assert.equal(menuDirection('ArrowRight',button),'right');
assert.equal(menuDirection('Space',button),null);assert.equal(menuDirection('Enter',button),null);
assert.equal(menuDirection('ArrowLeft',slider),null,'a slider keeps left and right for its own value');assert.equal(menuDirection('KeyD',slider),null);
assert.equal(menuDirection('ArrowDown',slider),'down','while up and down still leave it');
assert.equal(menuDirection('KeyW',button,{modifier:true}),null,'a modifier makes it the browser\'s key');
console.log('PASS menu keys: arrows and W/A/S/D, sliders keep sideways, modifiers pass through');

// --- what can be steered to -------------------------------------------------
{
  const shown=control('play',box(72,300,300,64)),hidden=control('editor',box(0,0,0,0)),off=control('off',box(72,400,300,64),{disabled:true}),range=control('vol',box(72,500,300,40),{range:true});
  assert.deepEqual(menuFocusables(menu(shown,hidden,off,range)).map(c=>c.name),['play','vol'],'display:none and disabled controls are never targets; sliders are');
  assert.deepEqual(menuFocusables(null),[]);
}
console.log('PASS steerable controls: laid-out, enabled buttons and sliders');

// --- pause menu: a stack with a corner X, a two-up row and a row of icons ---
{
  const X=control('close',box(508,20,32,32),{close:true}),keep=control('keep',box(38,120,484,54));
  const restart=control('restart',box(38,190,236,46)),chapters=control('chapters',box(286,190,236,46));
  const home=control('home',box(200,266,160,40));
  const edit=control('edit',box(196,322,44,44)),sound=control('sound',box(252,322,44,44)),full=control('full',box(308,322,44,44));
  const root=menu(X,keep,restart,chapters,home,edit,sound,full);
  assert.equal(step(root,keep,'down'),'restart','down from a full-width button enters the row at its first member');
  assert.equal(step(root,restart,'right'),'chapters');
  assert.equal(step(root,chapters,'left'),'restart');
  assert.equal(step(root,restart,'left'),'restart','nothing to the left: focus stays');
  assert.equal(step(root,keep,'right'),'keep','sideways in a stack never leaps to the X in the corner');
  assert.equal(step(root,chapters,'down'),'home');
  assert.equal(step(root,home,'down'),'sound','a centred row beneath is entered at the member under the cursor');
  assert.equal(step(root,edit,'up'),'home');
  assert.equal(step(root,chapters,'up'),'keep');
  assert.equal(step(root,keep,'up'),'close','up past the top reaches the close button');
  assert.equal(step(root,X,'down'),'keep');
  assert.equal(step(root,X,'up'),'full','up from the X wraps to the bottom row, nearest its own column');
  assert.equal(step(root,full,'down'),'keep','down from the bottom wraps to the first item, skipping the X');
  assert.equal(step(root,full,'right'),'full','sideways never wraps');
  focused=null;assert.equal(moveMenuFocus(root,'down'),true);assert.equal(focused.name,'keep','with nothing focused the first press lands on the entry control, not the X');
  focused=restart;assert.equal(moveMenuFocus(root,'left'),false,'a press with nowhere to go reports so');
}
console.log('PASS pause layout: stack, two-up row, icon row, corner X, wrap and entry');

// --- chapters: full-width choices, one with a right-aligned alternate --------
{
  const X=control('close',box(508,10,44,44),{close:true});
  const ch0=control('ch0',box(38,120,484,84)),alt0=control('alt0',box(362,208,160,44)),ch1=control('ch1',box(38,263,484,84)),ch2=control('ch2',box(38,358,484,84)),ch3=control('ch3',box(38,453,484,84));
  const root=menu(X,ch0,alt0,ch1,ch2,ch3);
  assert.equal(step(root,ch0,'down'),'alt0','the edit alternative under a chapter comes before the next chapter');
  assert.equal(step(root,alt0,'down'),'ch1');
  assert.equal(step(root,ch1,'up'),'alt0');
  assert.equal(step(root,alt0,'up'),'ch0');
  assert.equal(step(root,alt0,'left'),'alt0');
  assert.equal(step(root,ch1,'right'),'ch1');
  assert.equal(step(root,ch3,'down'),'ch0','the list loops without passing through the X');
  assert.equal(step(root,ch0,'up'),'close');
}
console.log('PASS chapter list with alternates');

// --- settings: sliders, a two-column character grid with a ragged last row --
{
  const X=control('close',box(508,10,44,44),{close:true});
  const music=control('music',box(38,120,484,40),{range:true}),effects=control('effects',box(38,170,484,40),{range:true});
  const a=control('a',box(38,234,238,70)),b=control('b',box(284,234,238,70)),c=control('c',box(38,312,238,70));
  const sound=control('sound',box(38,406,484,50)),rumble=control('rumble',box(38,468,484,50));
  const root=menu(X,music,effects,a,b,c,sound,rumble);
  assert.equal(step(root,effects,'down'),'a','a grid is entered at its first cell');
  assert.equal(step(root,a,'right'),'b');assert.equal(step(root,b,'left'),'a');
  assert.equal(step(root,a,'down'),'c');
  assert.equal(step(root,b,'down'),'sound','with nothing below in its column, down continues past the grid');
  assert.equal(step(root,sound,'up'),'c','and up from below finds the ragged cell');
  assert.equal(step(root,c,'right'),'c','no cell to the right in that row');
  assert.equal(step(root,a,'up'),'effects');assert.equal(step(root,music,'up'),'close');
  assert.equal(step(root,rumble,'down'),'music','wrap lands on the first slider, not the X');
}
console.log('PASS settings sliders and character grid');

// --- title and error screens ------------------------------------------------
{
  const play=control('play',box(72,300,300,64)),chapters=control('chapters',box(72,376,300,64)),settings=control('settings',box(72,452,300,64));
  const footer=['open-editor','howto','menu-sound','fullscreen'].map(n=>control(n,box(0,0,0,0)));
  const root=menu(play,chapters,settings,...footer);
  assert.equal(step(root,play,'down'),'chapters');assert.equal(step(root,settings,'down'),'play');assert.equal(step(root,play,'up'),'settings');
  assert.equal(step(root,chapters,'left'),'chapters');
  const retry=control('retry',box(350,330,200,50)),home=control('home',box(380,400,140,40)),error=menu(retry,home);
  assert.equal(step(error,retry,'down'),'home');assert.equal(step(error,home,'up'),'retry');assert.equal(step(error,home,'down'),'retry');
}
console.log('PASS title loop with hidden footer, error screen');

// --- the pure pieces at their edges -----------------------------------------
assert.equal(pickNeighbour([box(0,0,10,10)],0,'down'),-1);assert.equal(pickNeighbour([],0,'down'),-1);assert.equal(pickNeighbour([box(0,0,10,10),box(0,20,10,10)],0,'sideways'),-1);
assert.equal(wrapTarget([],box(0,0,1,1),'down'),-1);assert.equal(wrapTarget([box(0,0,1,1)],box(0,0,1,1),'left'),-1);assert.equal(wrapTarget([box(0,50,1,1),box(0,10,1,1)],box(0,0,1,1),'down'),1);
assert.equal(moveMenuFocus(menu(),'down'),false,'an empty menu is not steered');
console.log('PASS edge cases of the pure pieces');

// --- held pad repeats -------------------------------------------------------
{
  const r=new MenuRepeat({delay:180,interval:90});
  assert.equal(r.step('down',0),'down','the first press moves at once');
  assert.equal(r.step('down',100),null,'and then waits');
  assert.equal(r.step('down',180),'down');assert.equal(r.step('down',250),null);assert.equal(r.step('down',270),'down');
  assert.equal(r.step(null,300),null,'letting go resets');assert.equal(r.step('down',310),'down','so the next press is again immediate');
  assert.equal(r.step('up',320),'up','a change of direction is immediate too');
}
console.log('PASS held-direction repeat timing');
