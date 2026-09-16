// A recorded control stream: the exact per-frame input a pilot produced, kept
// so a later run can replay it instead of searching for it again.
//
// Every frame is one stick reading plus some combination of buttons, and the
// buttons only ever take a handful of combinations across a whole chapter. So
// the combinations go in a table and each frame becomes an index, a stick
// value and a repeat count. The pilots steer by clamping towards a target, so
// during the long runs that make up most of a chapter the input is identical
// frame after frame and the counts collapse thousands of frames into one row.
//
// Frames are rebuilt with the exact keys they were recorded with, because
// which keys are absent is part of the input: a frame steering with `moveAxis`
// and a frame holding `right` are not the same frame. Stick values are written
// out at full precision for the same reason — the replay has to reproduce the
// recorded run bit for bit, not merely resemble it.

const AXIS='moveAxis';
// Key order follows insertion and the pilots build their inputs in different
// orders, so identical button combinations have to be spelled the same way
// before they can be recognised as the same row of the table.
const buttonsOf=input=>JSON.stringify(Object.fromEntries(
  Object.entries(input).filter(([k])=>k!==AXIS).sort(([a],[b])=>a<b?-1:1)));

export function encode(controls){
  const shapes=[],index=new Map(),runs=[];
  for(const input of controls){
    const key=buttonsOf(input);
    let shape=index.get(key);
    if(shape===undefined)index.set(key,shape=shapes.push(JSON.parse(key))-1);
    // null rather than a number marks a frame that carried no stick reading at
    // all, which is not the same as one that read zero.
    const axis=AXIS in input?input[AXIS]:null,last=runs.at(-1);
    if(last&&last[0]===shape&&Object.is(last[1],axis))last[2]++;else runs.push([shape,axis,1]);
  }
  return {frames:controls.length,shapes,runs};
}

export function decode({frames,shapes,runs}){
  const controls=[];
  for(const [shape,axis,count] of runs)
    // A fresh object per frame, so replaying cannot depend on the simulation
    // leaving the input it was handed untouched.
    for(let i=0;i<count;i++)controls.push(axis===null?{...shapes[shape]}:{...shapes[shape],[AXIS]:axis});
  if(controls.length!==frames)throw new Error(`recording claims ${frames} frames but its runs add up to ${controls.length}`);
  return controls;
}
