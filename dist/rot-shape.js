// The bite a rotten corner takes out of a bench: an irregular hole, wider than
// the piece that is missing from it. Pure numbers, so the rot that fills it,
// the bench corner it is carved from, the patch that mends it and the tests
// all read one shape.
//
// The gap the player deals with — the deck the rot makes, the floor under it,
// the mass that seats in it, the outline of the missing piece — is the plain
// box `w` across and `h` down from the bench top, with its left wall at x 0
// and its open side at x w, where the bench ends. The bite is that box plus a
// ragged bulge eaten into the bench to the left of it, below the walking
// surface, so the corner reads as rotted through rather than sawn out.
const random=n=>{const x=Math.sin(n*127.13+73.41)*43758.5453;return x-Math.floor(x);};

// How far the bite eats into the bench, as a share of the gap's width, and
// how much each tooth of its edge may wander from where it is drawn.
export const BITE=Object.freeze({reach:.26,jag:.035});

// The seed a bite is drawn from: the gap's own place on the bench.
export const biteSeed=s=>Math.round((s.x??0)*7+(s.w??0)*13);

// The bite's outline as [x, y] points, y down from the bench top (0 at the
// top, -h at the floor), in order: along the top edge, down the open right
// side, back along the floor, then up the ragged left wall.
export function biteOutline(w,h,seed=0){
  const reach=w*BITE.reach,jag=(k,amount=BITE.jag)=>(random(seed+k)-.5)*2*amount*w;
  const pts=[[0,0],[w,0],[w,-h]];
  // The floor: level where the plug will sit, with a nick or two in it.
  pts.push([w*.62,-h+jag(1,.012)],[w*.3,-h+jag(2,.012)],[0,-h]);
  // The left wall is bitten, not worn: a few straight teeth into the bench,
  // deepest a little below the middle, and never at the very top, so the
  // walking surface is the bench's own. Straight runs between the points —
  // the shapes drawn from this extrude them as they are.
  const wall=[[-.1,-.94*h],[-.62,-.8*h],[-1,-.58*h],[-.5,-.44*h],[-.86,-.3*h],[-.38,-.16*h],[-.12,-.05*h]];
  for(const [i,[u,v]] of wall.entries())pts.push([u*reach+jag(10+i)*.5,v+jag(20+i)*.3]);
  return pts;
}

// Whether a point is inside the outline (even-odd rule).
export function insideBite(outline,x,y){
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const [xi,yi]=outline[i],[xj,yj]=outline[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

// The outline's extent: how far left the bulge reaches, and its depth.
export function biteBounds(outline){
  let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  for(const [x,y] of outline){left=Math.min(left,x);right=Math.max(right,x);top=Math.max(top,y);bottom=Math.min(bottom,y);}
  return {left,right,top,bottom};
}
