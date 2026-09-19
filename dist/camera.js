// Orthographic zoom uses the visible span. Landscape shows enough world ahead
// and below to read a landing before committing to it; portrait no longer shows
// almost twice the height of landscape, which on a phone spent the top of the
// screen on whatever happened to be above the route.
export function cameraFraming(width,height,biome){
  const aspect=width/height,landscape=aspect>1;
  const viewH=landscape?(biome==='citadel'?10.2:11.6):14.2;
  return {viewH,viewW:viewH*aspect,landscape};
}

// The share of the view the player may cross vertically before the frame
// follows at all. A full jump rises about 2.6 units, so this band is sized so
// an ordinary jump moves the character inside a still frame: a camera that
// rises with the jump reads as the world sinking rather than as a jump.
export const VERTICAL_BAND=.26;
// Room left below the player, as a share of the view. The camera used to sit a
// fifth of the screen above them, which spent the frame on sky and pushed the
// ground they were aiming at towards the bottom edge.
export const VERTICAL_BIAS=.06;

export const verticalBand=viewH=>viewH*VERTICAL_BAND;

// The height the frame is resting at, which is not the player's own y. While
// they stand it settles onto them, so landing somewhere new retargets; while
// they are airborne it stays put until they reach the edge of the band and
// carry it with them.
export function cameraAnchorY(anchor,p,viewH,dt){
  if(!Number.isFinite(anchor))return p.y;
  const settled=p.groundId?anchor+(p.y-anchor)*(1-Math.exp(-dt*6)):anchor;
  const band=verticalBand(viewH);
  return Math.min(p.y+band,Math.max(p.y-band,settled));
}

// True once the player has reached the edge of the band and is dragging the
// frame with them — a long fall, not a jump. The follow has to keep up there.
export const anchorDragged=(anchor,p,viewH)=>Math.abs(anchor-p.y)>=verticalBand(viewH)-1e-6;

// The facing offset is what shows the route ahead, but at the old fifth of a
// view it threw the frame across a third of the screen on every turn. A caller
// easing between the two sides passes a value between them, including zero —
// which has to mean a centred frame, not a snap back to facing right.
export function cameraTarget(p,viewW,viewH,landscape,look=0,anchorY=p.y,facing=p.facing||1){
  return {x:p.x+viewW*.11*facing+look,y:anchorY+viewH*VERTICAL_BIAS};
}

// Where something is drawn between two ticks: `alpha` of the way from the pose
// the last tick started at to the one it ended on. The simulation runs a fixed
// 1/120 step and a frame seldom lands on a tick — at 120Hz one frame carries
// one tick and the next two — so a body drawn where its last tick left it
// trembles; the ropeway's trolley, three times a run's speed against a cable
// that does not move, showed it first. Drawing a tick behind costs eight
// milliseconds of latency and buys a steady picture.
// Exactly `cur` at alpha 1: every caller but the frame loop asks for that, and
// the checks compare positions by equality. And exactly `cur` across a jump
// wider than any tick's travel (a fall covers .22 a tick), which is a teleport
// — a respawn, the lab's R — to be shown where it landed rather than on the way.
export const TELEPORT=1.5;
export const between=(prev,cur,alpha)=>alpha>=1||!Number.isFinite(prev)||Math.abs(cur-prev)>TELEPORT?cur:prev+(cur-prev)*alpha;
