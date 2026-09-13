// One profile for the plank deck and its one-way walking surface. Endpoints
// stay at the authored height; width edits retain a gentle, walkable sag.
export const bridgeSag=s=>Math.min(.6,s.w*.086);
export function bridgeOffset(s,localX){
  const t=Math.max(0,Math.min(1,localX/s.w));
  return -4*bridgeSag(s)*t*(1-t);
}
