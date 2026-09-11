// Orthographic zoom uses the visible span: landscape now shows 50% more world.
export function cameraFraming(width,height,biome){
  const aspect=width/height,landscape=aspect>1;
  const viewH=landscape?(biome==='citadel'?8.7:9.9):18.6;
  return {viewH,viewW:viewH*aspect,landscape};
}
export function cameraTarget(p,viewW,viewH,landscape,look=0){
  return {x:p.x+viewW*.18*(p.facing||1)+look,y:p.y+(landscape?viewH*.18:2.35)+(p.groundId?0:Math.max(-.55,Math.min(.7,p.vy*.045)))};
}
