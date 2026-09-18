// Decoration the workshop owns, as opposed to the dressing each biome grows on
// its own from platform geometry. A placement names one of the shapes the game
// already knows how to build and says where it stands, how big it is and which
// way it faces — it never carries geometry, and the shapes stay owned by the
// game. Nothing in this list is a collider, a collectible or a save record.
//
// This file holds no Three.js so the editor, its validation and the headless
// tests can read the catalogue without a renderer. `dist/decor.js` builds it.
export const DECOR_LIMIT=240;
// Depth is signed: negative sits behind the play plane, positive in front of
// it. The camera looks from z 26, so the near limit keeps a prop in frame.
export const DECOR_BOUNDS={size:[.25,60],z:[-44,9],turn:[-180,180],lean:[-80,80]};
// A backdrop placement names a shape from the very same catalogue, at a
// parallax depth. What separates it from decoration is `factor`: it joins a
// layer that scrolls at that fraction of the playfield, which is what makes a
// horizon read as far away rather than as a very large prop holding still.
//
// Depth reaches far past decoration's. The canyon's own far skyline stands at
// z -53 and the cave's veil at -59, so a list bounded at -44 could not hold
// the scenery it exists to replace. Nothing comes in front of the play plane,
// because a parallax layer is drawn before it.
export const BACKDROP_LIMIT=80;
export const BACKDROP_BOUNDS={size:[.5,90],z:[-60,-4],factor:[.05,.95],turn:[-180,180],lean:[-80,80]};
export const BACKDROP_DEFAULT={z:-30,factor:.35};
export const backdropSize=item=>item.size??DECOR_KINDS[item.kind]?.size??1;
export const backdropFactor=item=>Math.min(Math.max(item.factor??BACKDROP_DEFAULT.factor,BACKDROP_BOUNDS.factor[0]),BACKDROP_BOUNDS.factor[1]);
// `x` is authored as the world x the item is centred on, which is the only
// number an author can reason about. The layer itself moves by
// cameraX*(1-factor), so holding the item at x*factor inside it puts the
// silhouette exactly on world x when the camera arrives, and lets it drift
// either side at the rate its depth implies. The layer carries a `repeat` far
// wider than any chapter, so an authored horizon piece stays one object
// instead of tiling — the built fields tile, authored ones do not.
export const backdropOffset=item=>item.x*backdropFactor(item);
// Where the silhouette actually is for a given camera. The editor needs this
// to outline, hit-test and drag something that is not where its own x says.
// Written as a drift away from the piece's own x rather than as the frame's
// `cameraX*(1-factor) + x*factor`. The two are the same identity, but this one
// is exact at the anchor: a piece asked where it is when the camera is on its
// x answers with that x, instead of with x plus a rounding error.
export const backdropWorldX=(item,cameraX)=>item.x+(cameraX-item.x)*(1-backdropFactor(item));
// How far the layer lifts at a given camera height, mirroring the clamp in
// `animateEnvironment` so the editor can draw the box where the frame puts it.
export const backdropLift=(item,cameraY)=>Math.max(0,cameraY-1.1)*Math.min(1,1-backdropFactor(item)*.35);
export function placeBackdrop(root,item){
  root.position.set(backdropOffset(item),item.y,item.z??BACKDROP_DEFAULT.z);
  root.rotation.set(0,(item.turn||0)*Math.PI/180,(item.lean||0)*Math.PI/180);
}
// `size` is the prop's width in world units, and `z` where it reads best by
// default. Both are only starting points — every placement can move either.
// A kind without `biomes` uses the chapter's own palette, so it belongs
// everywhere; the rest need assets or colours that one chapter alone loads.
export const DECOR_KINDS={
  boulder:{label:'Boulders',icon:'stone',size:2.25,z:-1},
  pebbles:{label:'Pebbles',icon:'circle-dot',size:1.5,z:1},
  shelf:{label:'Rock shelf',icon:'section',size:4,z:2.5},
  pot:{label:'Clay pot',icon:'stamp',size:1,z:-.75},
  torch:{label:'Torch',icon:'flame',size:.75,z:-1},
  tree:{label:'Clay tree',icon:'sprout',size:4.25,z:-1.5},
  cloud:{label:'Cloud',icon:'layers-2',size:7,z:-17},
  cactus:{label:'Cactus',icon:'flower-2',size:1.75,z:-1.25,biomes:['desert']},
  'canyon-arch':{label:'Rock arch',icon:'landmark',size:12,z:-16,biomes:['desert']},
  summit:{label:'Summit',icon:'triangle',size:16,z:-22,biomes:['desert']},
  tent:{label:'Camp tent',icon:'tent',size:4,z:-1.25,biomes:['desert']},
  'cave-mouth':{label:'Cave mouth',icon:'view',size:5,z:-2.5,biomes:['desert']},
  windmill:{label:'Windmill',icon:'refresh-cw',size:3.5,z:-2.25,biomes:['desert','citadel']},
  mushroom:{label:'Mushroom',icon:'flower',size:1.25,z:-1,biomes:['forest']},
  'hero-mushroom':{label:'Tall mushroom',icon:'flower',size:3.5,z:-1.25,biomes:['forest']},
  bloom:{label:'Flowering leaves',icon:'flower-2',size:1.25,z:.5,biomes:['forest']},
  leaves:{label:'Leaf tuft',icon:'sprout',size:1.5,z:.75,biomes:['forest']},
  canopy:{label:'Tree crown',icon:'group',size:9.5,z:-13,biomes:['forest']},
  grove:{label:'Grove island',icon:'landmark',size:9,z:-30,biomes:['forest']},
  hills:{label:'Wooded hills',icon:'triangle',size:12,z:-20,biomes:['forest']},
  falls:{label:'Cliff falls',icon:'wind',size:15,z:-34,biomes:['forest']},
  waterfall:{label:'Waterfall gorge',icon:'wind',size:14.5,z:-20,biomes:['forest']},
  crystals:{label:'Crystal cluster',icon:'star',size:1.5,z:-1.25,biomes:['cave']},
  'cave-mushrooms':{label:'Amber mushrooms',icon:'flower',size:2,z:-1.25,biomes:['cave']},
  moss:{label:'Hanging moss',icon:'sprout',size:1,z:.5,biomes:['cave']},
  grotto:{label:'Grotto rock',icon:'group',size:8,z:-26,biomes:['cave']},
  crystalcap:{label:'Crystal island',icon:'star',size:8,z:-26,biomes:['cave']},
  cottage:{label:'Cottage',icon:'house',size:3.5,z:-1.5,biomes:['citadel']},
  laundry:{label:'Laundry line',icon:'home',size:3.75,z:-1.25,biomes:['citadel']},
  doorway:{label:'Doorway',icon:'section',size:1.25,z:-2,biomes:['citadel']},
  castle:{label:'Cloudtop castle',icon:'landmark',size:34,z:-40,biomes:['citadel']}
};
// A landmark is the one piece of decoration that was already data before this
// list existed: a name on a platform, which `landmark()` in setpieces.js turns
// into a prop that streams and moves with its deck.
//
// `labels` is where the same name means different art in different chapters —
// a sandwheel is a windmill everywhere but the canyon, where it is the eroded
// basin. `biomes` marks a name that builds nothing outside those chapters, and
// `legacy` a second name for a prop already offered under another, kept so an
// authored platform is never quietly rewritten.
// `box` is where the prop actually stands on its deck: `at` as a fraction of
// the platform's width, `across` and `height` in world units. The workshop
// needs it because a landmark sits metres above the deck line, and a tap has to
// land on the thing being looked at rather than on the rock beneath it. The
// numbers are measured from the built geometry, and `tests/scene.mjs` holds
// them to it. `boxes` covers the chapters that build the same name differently.
export const LANDMARKS={
  windmill:{label:'Windmill',box:{at:.57,across:3.35,height:5.15}},
  sandwheel:{label:'Windmill wheel',labels:{desert:'Dry sandstone basin'},box:{at:.57,across:3.35,height:5.15},boxes:{desert:{at:.56,across:4.05,height:1.55}}},
  counterweight:{label:'Counterweight frame',box:{at:.57,across:3.25,height:3.85}},
  pulsedrum:{label:'Pulse drum',box:{at:.57,across:1.55,height:2.05}},
  beacon:{label:'Beacon',box:{at:.57,across:1.55,height:2.05}},
  arch:{label:'Stone arch',labels:{desert:'Camp tent'},box:{at:.57,across:3.95,height:4.4},boxes:{desert:{at:.57,across:4.95,height:3.95}}},
  rootarch:{label:'Root arch',labels:{forest:'Tree crown'},box:{at:.57,across:3.95,height:4.4},boxes:{forest:{at:.2,across:5.55,height:6.8}}},
  bannerarch:{label:'Banner arch',box:{at:.57,across:3.95,height:3.7}},
  bellgate:{label:'Bell gate',box:{at:.57,across:3.95,height:3.7}},
  kiln:{label:'Kiln',box:{at:.57,across:2.1,height:3.3}},
  crystal:{label:'Crystal spikes',box:{at:.57,across:2.25,height:3.4}},
  mushroom:{label:'Clay mushroom',labels:{forest:'Breathing mushroom'},box:{at:.57,across:3.45,height:2.85},boxes:{forest:{at:.58,across:3.35,height:2.65}}},
  sporepod:{label:'Spore pod',box:{at:.57,across:3.45,height:3.7},boxes:{forest:{at:.58,across:3.35,height:2.65}}},
  birdhouse:{label:'Cottage',biomes:['cave','citadel'],box:{at:.57,across:2.9,height:2.5}},
  oasis:{label:'Cottage',biomes:['cave','citadel'],legacy:true,box:{at:.57,across:2.9,height:2.5}}
};
// Where the deck picks the arrangement, one box covers every role it can pick.
const STORY_BOXES={cave:{at:.64,across:4.05,height:2.25},citadel:{at:.64,across:4.1,height:2.3}};
// Ember Caverns keys these arrangements off the deck itself rather than off the
// landmark's name, which is why the name there is only a switch.
export const CAVE_STORY_ROLES={
  'spark-balcony-copy-1':'echo','ferry-exit':'cooling','heart-entry':'bearing',
  'heart-balcony':'bearing','vault-entry':'survey','sluice-balcony':'survey',
  'gallery-entry':'geode'
};
// The Hanging Quarter does the same for its laundry courtyard, and ignores a
// landmark entirely on the two decks that tell their story through props.
const CITY_OWNED='laundry-entry',CITY_IGNORED=['exchange-entry','bell-court'];
// Who decides what a platform's landmark builds: its name, the deck itself, or
// nobody. This mirrors the order of the guards in `landmark()`; a goal deck is
// first because it already builds its own finish bell.
export function landmarkAuthority(biome,platform){
  if(platform.goal&&platform.landmark==='bellgate')return 'none';
  if(biome==='cave'&&CAVE_STORY_ROLES[platform.id])return 'platform';
  if(biome==='citadel'&&platform.id===CITY_OWNED)return 'platform';
  if(biome==='citadel'&&CITY_IGNORED.includes(platform.id))return 'none';
  return 'name';
}
export const landmarkLabel=(name,biome)=>LANDMARKS[name]?.labels?.[biome]||LANDMARKS[name]?.label||name;
// Where a platform's landmark stands, in world units, or nothing if it carries
// none. This is what the workshop outlines and what a tap has to reach.
export function landmarkBox(biome,platform){
  if(!platform.landmark)return null;
  const authority=landmarkAuthority(biome,platform);
  if(authority==='none')return null;
  const spec=authority==='platform'?STORY_BOXES[biome]:(LANDMARKS[platform.landmark]?.boxes?.[biome]||LANDMARKS[platform.landmark]?.box);
  if(!spec)return null;
  return {x:platform.x+platform.w*spec.at-spec.across/2,y:platform.y,w:spec.across,h:spec.height};
}
// A cottage needs a chapter that builds houses, and a deck that is not already
// one, or `w.house` returns nothing and the dropdown would lie.
export const landmarkChoices=(biome,platform)=>Object.entries(LANDMARKS)
  .filter(([name,spec])=>!spec.legacy&&(!spec.biomes||spec.biomes.includes(biome))&&!(platform.house&&['birdhouse','oasis'].includes(name)));
export const decorPalette=biome=>Object.entries(DECOR_KINDS).filter(([,spec])=>!spec.biomes||spec.biomes.includes(biome));
export const decorSize=item=>item.size??DECOR_KINDS[item.kind]?.size??1;
// Depth, facing and lean live on a prop's root rather than inside its shape,
// which is what lets a drag follow an existing view without rebuilding it.
export function placeDecor(root,item){
  root.position.set(item.x,item.y,item.z??DECOR_KINDS[item.kind]?.z??-1.2);
  root.rotation.set(0,(item.turn||0)*Math.PI/180,(item.lean||0)*Math.PI/180);
}
