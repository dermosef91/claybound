import * as THREE from './lib/three.module.js';
import {createGoal} from './goal.js';
import {canyonModel} from './canyon-assets.js';
import {windmillModel} from './windmill.js';
import {forestModel} from './forest.js';
import {forestBloom,forestMushroom} from './forest-details.js';
import {cavernModel} from './cavern-asset.js';
import {caveCrystals,caveMushrooms,caveRock,caveMoss} from './cavern.js';
import {castle} from './castle.js';
import {cityLaundry} from './city-laundry.js';
import {cloudModel} from './clouds.js';
import {dreamSculpture,dreamGiraffe,dreamPlanet,dreamSaucer,dreamFlower,dreamSun} from './dream-assets.js';

// One diorama per chapter. Each is a small world with a front, a middle and a
// distance, and it is composed the way a model on a table is composed rather
// than the way the chapter is played: the pieces are turned to face wherever
// they look best, they sit at whatever depth reads, and nothing is confined to
// the single plane the side-on playfield keeps everything on.
//
// The shape of every one of them is the same, because it is the shape of the
// sentence the screen is making: the hero stands on a last piece of the
// chapter's own ground, the goal gate they have just rung is beside them, and
// the thing the chapter will be remembered for stands in the middle distance
// where they are looking. The camera is behind and over one shoulder, so the
// picture is of someone looking out at what they crossed.
//
// The numbers below are not guessed. `node scripts/frame-completion.mjs
// <chapter> --slots` solves the composition against the real asymmetric
// frustum and prints the world position of each slot, and SLOTS here is that
// table. It exists because this frame cannot be reasoned about by eye: the
// camera looks down a diagonal, so the Great Arch at x −7 z −20 — well to the
// left and far back — draws at 64% across, directly behind the gate, which is
// exactly where it spent its first two rounds hiding.

// Where things go. All five chapters share one camera, so they share one set
// of slots: a landmark left of centre with the hero's eyeline on it, masses
// flanking it, ranks receding behind, and ground positions for the cluster.
const SLOTS={
  landmark:[-12.73,2.59,-11.49],   // 38% across, 46% down, 34 deep — the subject
  landmarkNear:[-8.68,2.82,-6.90],
  rightMass:[-1.25,1.09,-13.34],   // 72%, 56%
  rightMassFar:[-1.98,4.89,-20.43],
  farRight:[.25,1.92,-25.99],
  leftFar:[-33.79,2.46,-20.15],
  leftHigh:[-25.84,5.88,-11.26],
  deepCentre:[-25.50,4.24,-36.90],
  deepRank:[-16.73,6.08,-21.29],
  deepRankRight:[-13.70,8.03,-30.32],
  highAccent:[-9.33,6.91,-4.73],   // 30%, 18% — what hangs into the top corner
  midAccent:[-2.45,2.18,-5.78],
  nearLeftProp:[-5.25,1.12,-1.67],
  // 50% across, 46% down, 30 deep: right of the text column, still left of
  // the gate. For a landmark that is lit rather than large.
  landmarkClear:[-6.97,2.75,-10.22]
};
// Ground positions, on the footing's own surface.
const AT={hero:[.65,1.89],gate:[2.73,-.69],nearLeft:[-.3,3.2],nearRight:[5.13,.47],midLeft:[-3.94,-.24],midRight:[2.02,-4.43]};
// `y` for a model `h` tall whose middle should land on a slot.
const seat=(slot,h)=>slot[1]-h/2;
// How big a thing in a slot is allowed to be, and the number this whole file
// turns on. At the landmark's depth the frame is about sixteen units tall, so
// a mass 8 units high standing on the slot's floor fills the middle 45% of the
// picture and leaves the top fifth as sky. The first three rounds built these
// at 16 to 30 units because "monumental" sounded like a big number, and every
// one of them came out as a wall with the sky bricked up behind it: the canyon
// lost its horizon, the castle became a blue cliff and the giraffe an
// unreadable blue mass across the top of the frame. Depth does the work of
// making something monumental. Size only decides whether you can still see
// past it.
const SIZE={landmark:8,flank:5,rank:8,farRank:10};

// A last piece of the chapter's ground for the hero and the gate to stand on.
// Deliberately an island with a broken underside rather than a cut-off box —
// a diorama is an object, and the eye wants to see where it ends. It is kept
// small enough that its far lip reads inside the frame; a wider one loses the
// silhouette and becomes a floor.
function footing(w,root,{width=10.4,depth=7.4,drop=5,top='top',body='terrain',under='terrain2',stone=null,turn=0,x=.8,y=0,z=0,rocks=true}={}){
  stone??=body;
  const g=new THREE.Group();g.name='Diorama footing';g.position.set(x,y,z);g.rotation.y=turn;root.add(g);
  w.box(width,.62,depth,top,g,0,-.31,0,.24);
  w.box(width*.93,1.5,depth*.9,body,g,0,-1.3,0,.3);
  w.box(width*.76,2.1,depth*.72,under,g,-.2,-3.05,-.1,.34);
  w.box(width*.44,2.3,depth*.42,under,g,.5,-drop,.2,.4);
  // The underside tapers into a few hanging masses, so the island reads as
  // torn out of something larger instead of sawn off flat.
  for(const [dx,dy,dz,r]of [[-width*.3,-drop-.6,depth*.12,1.15],[width*.22,-drop-1.5,-depth*.1,.85],[0,-drop-2.4,depth*.05,.6]])
    w.ball(r,r*1.25,r*.92,under,g,dx,dy,dz);
  // Loose clay along the lip. The top used to read as a poured slab; a broken
  // edge is what tells you it is a piece of somewhere rather than a stand.
  if(rocks)for(const [i,[dx,dz,r]]of [
    [-width*.40,depth*.26,.52],[width*.42,-depth*.22,.44],[-width*.34,-depth*.29,.36],
    [width*.36,depth*.30,.3],[-width*.12,depth*.38,.26],[width*.16,depth*.40,.22],[-width*.46,depth*.02,.3]
  ].entries()){
    const rock=w.ball(r,r*.7,r*.86,i%2?stone:top,g,dx,-.18,dz);rock.rotation.set(i*.4,i*.9,i*.3);
  }
  // The walked surface itself. Without these the top was a poured plate the
  // width of the frame with one figure standing on it: the eye needs something
  // at the hero's own scale to read the ground as ground.
  for(const [i,[dx,dz,r]]of [
    [-.22,.30,.19],[.14,-.26,.15],[-.34,-.12,.12],[.30,.16,.13],[.04,.38,.1],[-.06,-.36,.11],[.38,-.06,.09]
  ].entries())w.ball(r*(i%2?1:.82),r*.34,r*.82,top,g,dx*width,-.30,dz*depth).rotation.set(0,i*.7,0);
  return g;
}

// The gate, placed and turned in three dimensions. createGoal builds it about
// its own foot facing +z, so a wrapper is what lets it stand at an angle to
// the camera instead of flat-on the way the playfield needs it. Its finish
// flag reaches 3.3 units out along its own x and its crest 4.4 up, which is
// what decides how far right it can stand: at x 3.5 the flag left the frame.
function gate(w,root,{x=AT.gate[0],y=0,z=AT.gate[1],turn=-.52,tilt=0,scale=1}={}){
  const g=new THREE.Group();g.name='Diorama goal gate';
  g.position.set(x,y,z);g.rotation.set(tilt,turn,0);g.scale.setScalar(scale);root.add(g);
  createGoal(w,g,0,0);
  return g;
}

// A drifting bank of the supplied cloud, scattered in depth rather than on one
// plane: the panorama behind every outdoor chapter.
function clouds(w,root,list,{fog=false}={}){
  const made=[];
  for(const [x,y,z,width,turn]of list){
    const model=cloudModel(w,root,x,y,z,width,turn||0);
    model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;if(!fog){const m=o.material.clone();m.fog=false;o.material=m;}}});
    made.push(model);
  }
  return made;
}

const VIEW={position:[10.26,3.91,14.54],target:[.7,1.7,-1.8],fov:31,focus:[.58,.6]};
// Portrait cannot hold this panorama at the same scale: a frame 430 wide has
// about a third of the horizontal field, so fitting the arch, the gate and the
// hero all at once left the hero at five per cent of the picture. It crops the
// landmark instead and keeps the figure — further back than landscape and on a
// wider lens, framed so the island's broken underside mostly leaves the
// bottom of the frame where the buttons sit.
const VIEW_PORTRAIT={position:[13.26,5.4,19.8],target:[.7,1.9,-1.8],fov:41,focus:[.58,.53]};
// Facing the landmark. Everything on the left of this frame is both far to
// −x and far to −z, so a hero looking at it is looking away from the camera:
// the shot is over their shoulder, which is the shot the screen wants. The
// small turn back off dead-on brings a shoulder and a cheek toward us.
const HERO={x:AT.hero[0],y:0,z:AT.hero[1],yaw:2.3,scale:1};

export const DIORAMAS={
  // ---------------------------------------------------------------------------
  // One · The Sunbaked Canyon. Built around the Great Arch and ending on the
  // summit ropeway above it, so the diorama is that summit: the hero on the
  // last shelf, the arch standing out of the haze where they are looking, the
  // windwell they woke turning on a far stack, and the canyon stepping away.
  desert:{
    biome:'desert',
    light:{
      sky:'#e8f4ff',ground:'#b05f30',ambient:1.5,
      sunColor:'#ffd79a',sunPower:4.4,sun:[16,15,11],sunTarget:[-1,1,-4],shadow:18,
      fill:'#c8dff8',fillPower:.6,fillFrom:[-12,7,13],
      rim:'#ffc98a',rimPower:1.6,rimFrom:[-7,4,-15],
      zenith:'#1d8fe4',horizon:'#9fd2ee',haze:'#ffd9ae',
      sunDirection:[16,7,11],sunSize:340,sunGlow:.85,hazeHeight:1.5,
      fog:'#d8e6ef',fogNear:20,fogFar:88
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,root,{spin}){
      footing(w,root,{turn:.16});
      gate(w,root);
      canyonModel(w,'tent',root,AT.midLeft[0],-.05,AT.midLeft[1],2.5,.82);
      canyonModel(w,'cactus',root,AT.nearLeft[0],-.05,AT.nearLeft[1],1.45,.6);
      canyonModel(w,'cactus',root,AT.nearRight[0],-.1,AT.nearRight[1],.95,-.35);
      // Off to the hero's right, in a group of its own: w.pot's fourth
      // argument is its scale, not a depth, and passing one made a pot two
      // and a half units across that stood in front of the whole gate.
      const potSeat=new THREE.Group();potSeat.position.set(4.3,0,3.1);root.add(potSeat);
      w.pot(potSeat,0,-.08,.3);
      const potSeat2=new THREE.Group();potSeat2.position.set(5.4,0,2.2);root.add(potSeat2);
      w.pot(potSeat2,0,-.06,.19);
      canyonModel(w,'cactus',root,5.9,-.08,-1.9,1.15,.9);
      w.box(1.5,.42,1.1,'bark',root,2.1,.16,2.9,.1).rotation.y=.4;

      // The Great Arch, nearly face-on so its opening reads as a hole through
      // a solid thing, standing exactly where the hero is looking.
      canyonModel(w,'arch',root,SLOTS.landmark[0],-.4,SLOTS.landmark[2],SIZE.landmark,.3);
      // The cave mouth flanks it on the right, turned away so the two do not
      // read as a pair of the same silhouette.
      canyonModel(w,'cave',root,SLOTS.rightMass[0],-.4,SLOTS.rightMass[2],SIZE.flank,-.9);
      // A far stack with the windwell turning on it.
      const stack=new THREE.Group();stack.position.set(SLOTS.deepRankRight[0],-3.4,SLOTS.deepRankRight[2]);stack.rotation.y=-.4;root.add(stack);
      canyonModel(w,'summit',stack,0,0,0,9,.2);
      const mill=windmillModel(w,stack);mill.position.set(.3,8.6,.8);mill.scale.setScalar(.8);mill.rotation.y=-.55;
      mill.traverse(o=>{if(o.userData.spin)spin(o,.55,'z');});

      // The ranks behind, each smaller, turned further and higher into the haze.
      // Four ranks, not six, each low enough to keep the arch against sky.
      for(const [key,slot,h,base,turn]of [
        ['summit',SLOTS.leftHigh,7,-1,.3],['arch',SLOTS.leftFar,8,-2,-.5],
        ['summit',SLOTS.deepCentre,11,-4,.8],['summit',SLOTS.farRight,4.5,-1.6,-1.1]
      ])canyonModel(w,key,root,slot[0],base,slot[2],h,turn);
      // The chapter ends on the summit ropeway, so the way down leaves the
      // island: a cable off the far lip, running out toward the arch.
      // Out on the far-left lip. Directly behind the hero the post grew out
      // of the top of their head.
      const anchorPost=new THREE.Group();anchorPost.position.set(-3.5,0,-3);root.add(anchorPost);
      w.box(.46,1.6,.46,'bark',anchorPost,0,.8,0,.12);
      w.ball(.3,.24,.3,'barkLight',anchorPost,0,1.64,0);
      w.rope([-3.5,1.6,-3],[-10.2,1,-10.4],root,.055);
      w.rope([-3.5,1.28,-2.86],[-10.1,.72,-10.3],root,.04);
      clouds(w,root,[[-18,9,-26,7],[2,12,-34,9],[-30,11,-40,11],[-14,15,-50,13],[8,8,-44,8]]);
    }
  },

  // ---------------------------------------------------------------------------
  // Two · The Wildwood. A climb through a living tree, and its supplied
  // landmark is the hero mushroom. The hero stands out on a mossy bough with
  // the mushroom rising where they are looking, the falls beyond it, and the
  // canopy closing into the top corner.
  forest:{
    biome:'forest',
    light:{
      sky:'#e9f6da',ground:'#4f5a3c',ambient:1.65,
      sunColor:'#ffeab4',sunPower:4.2,sun:[14,17,9],sunTarget:[-2,2,-5],shadow:18,
      fill:'#bfe4d8',fillPower:.66,fillFrom:[-11,6,14],
      rim:'#d9f0a4',rimPower:1.8,rimFrom:[-5,7,-14],
      zenith:'#3f9fd8',horizon:'#cfe9c0',haze:'#fff0bc',
      sunDirection:[14,8,9],sunSize:300,sunGlow:.72,hazeHeight:1.3,
      fog:'#cfe4c8',fogNear:19,fogFar:78
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,root,{spin}){
      footing(w,root,{turn:-.14});
      gate(w,root);
      // The bough the footing is: a trunk leaving it at an angle, held at the
      // left so it frames the picture rather than splitting it in half.
      const trunk=new THREE.Group();trunk.position.set(-6.9,-1.4,.2);trunk.rotation.set(.1,.45,.26);root.add(trunk);
      w.box(1.35,13,1.5,'bark',trunk,0,6.5,0,.45);
      w.ball(1.2,.8,1.2,'barkLight',trunk,0,.5,0);
      for(const [i,[dx,dz]]of [[-1.3,1.2],[1.4,.9],[-1,-1.3]].entries()){
        const curve=new THREE.CatmullRomCurve3([
          new THREE.Vector3(0,1.4,0),new THREE.Vector3(dx*1.3,.3,dz*1.2),new THREE.Vector3(dx*2.4,-1.5,dz*2)]);
        w.mesh(new THREE.TubeGeometry(curve,20,.26-i*.04,7,false),'bark',trunk);
      }
      forestMushroom(w,root,AT.nearLeft[0],-.05,AT.nearLeft[1],1.4,.5);
      forestMushroom(w,root,AT.nearRight[0],-.08,AT.nearRight[1],.9,-.4);
      forestBloom(w,root,-1.6,-.05,2.2,.75,.3);
      forestModel(w,'springPad',root,AT.midLeft[0],-.1,AT.midLeft[1],3,.5);

      // The hero mushroom is the landmark, standing in the hero's eyeline.
      forestModel(w,'heroMushroom',root,SLOTS.landmark[0],-.6,SLOTS.landmark[2],8,.72);
      forestModel(w,'bloom',root,SLOTS.midAccent[0],-.6,SLOTS.midAccent[2],2.2,.4);
      forestModel(w,'grove',root,SLOTS.rightMass[0],-.6,SLOTS.rightMass[2],7,-.45,true);
      forestModel(w,'waterfall',root,SLOTS.leftHigh[0],-3.4,SLOTS.leftHigh[2],9,.5,true);
      forestModel(w,'falls',root,SLOTS.deepRank[0],-4,SLOTS.deepRank[2],11,-.2,true);

      // The distance: hills and canopy. The near canopy hangs into the top-left
      // corner only — across the middle it read as a dark smear.
      forestModel(w,'hills',root,SLOTS.leftFar[0],-5,SLOTS.leftFar[2],20,.1,true);
      forestModel(w,'hills',root,SLOTS.deepCentre[0],-6,SLOTS.deepCentre[2],26,-.5,true);
      forestModel(w,'distant',root,SLOTS.deepRankRight[0],-4,SLOTS.deepRankRight[2],16,.3,true);
      // One canopy, hanging into the top-left corner. Two of them across the
      // middle read as a dark smear rather than leaves.
      // Lifted until only leaves are in frame. Lower, its cut underside read
      // as a slab of earth hanging in the sky.
      const canopy=forestModel(w,'canopy',root,SLOTS.highAccent[0]-1.5,SLOTS.highAccent[1]+3.2,SLOTS.highAccent[2],12,.4,true);
      canopy.rotation.z=.12;spin(canopy,.22,'z',.012);
      clouds(w,root,[[-26,10,-30,8],[-8,13,-40,10],[-20,16,-52,12]]);
    }
  },

  // ---------------------------------------------------------------------------
  // Three · The Ember Caverns. No sky: the panorama is depth into the rock, and
  // the picture is lit by the things in it. The kiln the chapter wakes is the
  // landmark and the one warm light in a cold frame. Every mass is caveRock —
  // the chapter's own dented rock builder — because a plain box in this light
  // reads as a slab, which is what the first round of these looked like.
  cave:{
    biome:'cave',
    light:{
      sky:'#9fb0c8',ground:'#191c24',ambient:.8,
      sunColor:'#cfd9ea',sunPower:1.25,sun:[13,16,10],sunTarget:[-1,1,-6],shadow:17,
      fill:'#7f93b4',fillPower:.46,fillFrom:[-11,5,12],
      rim:'#67c6ff',rimPower:1.5,rimFrom:[-6,3,-14],
      zenith:'#070c16',horizon:'#16243c',haze:'#2b4468',
      sunDirection:[-4,3,-14],sunSize:60,sunGlow:.12,hazeHeight:.9,
      fog:'#18273f',fogNear:26,fogFar:96
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:{...HERO,yaw:2.13},
    build(w,root,{light,spin}){
      footing(w,root,{turn:.12});
      gate(w,root);
      // Near rock down both edges, inside the fog's reach, so the picture
      // reads as being inside something. Fogged to a flat blue it read as a
      // set of objects floating in mist.
      caveRock(w,root,-8.2,1.6,1.4,7,11,5,'caveClayDark',23,1);
      caveRock(w,root,-6.6,-1.6,5,3.8,5,3.4,'caveClay',31,1);
      caveRock(w,root,10.4,1,1.6,6,9,4.4,'caveClayDark',37,1);
      caveRock(w,root,7.6,-2.4,4.6,4,5,3.4,'caveClay',41,1);
      // A floor below the island, so the chamber has a bottom and the drop
      // reads as rock rather than as more haze.
      caveRock(w,root,-3,-11,-8,32,9,20,'caveClay',47,0);
      caveRock(w,root,-14,-9,-2,12,7,9,'caveClayDark',53,1);
      caveCrystals(w,root,AT.nearLeft[0],-.05,AT.nearLeft[1],1.2,{light:false,glow:true,halo:1.15});
      caveCrystals(w,root,AT.nearRight[0],-.08,AT.nearRight[1],.8,{light:false,glow:true});
      caveMushrooms(w,root,AT.midLeft[0],-.05,AT.midLeft[1],1,{light:false,glow:true});
      light(0x54c4ff,24,14,AT.nearLeft[0],1.8,AT.nearLeft[1]);
      light(0xff8a33,20,12,AT.midLeft[0],1.4,AT.midLeft[1]);

      // The vault overhead, well off the playfield's plane, with hanging bodies.
      // A vault, kept to the top corner and shallow: a full ceiling across the
      // frame put a brown slab over the whole picture.
      caveRock(w,root,SLOTS.highAccent[0]-1,SLOTS.highAccent[1]+3.4,SLOTS.highAccent[2],15,4,9,'caveVault',11,1);
      for(const [i,[dx,dz,r]]of [[-3,1,1.1],[2.5,-1.5,.8],[5,1.5,.9]].entries())
        caveRock(w,root,SLOTS.highAccent[0]-1+dx,SLOTS.highAccent[1]+1.8,SLOTS.highAccent[2]+dz,r*1.5,r*2.6,r*1.5,'caveVault',i*4+3,1);
      caveMoss(w,root,SLOTS.highAccent[0]-2,SLOTS.highAccent[1]+.9,SLOTS.highAccent[2]+1,1.1,1,2);

      // The kiln: the heart of the mountain, awake, standing where the hero
      // is looking and the brightest thing in the frame.
      const kiln=new THREE.Group();kiln.position.set(SLOTS.landmarkClear[0],-.4,SLOTS.landmarkClear[2]);kiln.rotation.y=.62;root.add(kiln);
      caveRock(w,kiln,0,3.6,0,8,7.4,6,'caveClay',17,1);
      caveRock(w,kiln,-2.6,2.4,-.6,5,5.2,4.4,'caveClayDark',19,1);
      caveRock(w,kiln,2.4,4.6,-1,5.4,6,4.6,'caveClay',21,1);
      caveRock(w,kiln,.6,7.4,-.4,4,3.4,3.2,'caveClayDark',25,1);
      // A mouth, not a porthole: a smaller ring set into the rock with the
      // melt banked inside it, so the glow reads as coming out of the hill.
      // A deep orange that survives the tone mapper. A bright yellow emissive
      // at high intensity came out of ACES as a flat cream disc, which is why
      // the kiln read as a porthole rather than as molten clay.
      if(!w.mat.kilnMelt){
        w.mat.kilnMelt=new THREE.MeshStandardMaterial({color:0x8f2403,emissive:0xff4400,emissiveIntensity:1.5,roughness:.82,metalness:0});
        w.assetMaterials.add(w.mat.kilnMelt);
      }
      // The mouth is an arch cut into the hill, banked with melt, and the
      // hillside above it carries the cracks the heat opens.
      // The opening: two jambs, a lintel and a dark throat behind them, with
      // the melt banked on its floor and spilling over the sill.
      w.box(2.6,.55,1,'caveClayDark',kiln,0,4.5,2.5,.14);
      for(const side of [-1,1])w.box(.52,2.6,1,'caveClayDark',kiln,side*1.05,3.1,2.5,.13);
      w.box(2.2,2.5,.7,'caveClayDark',kiln,0,3.1,2,.1);
      const melt=w.ball(.95,.42,.42,'kilnMelt',kiln,0,2.2,2.3);
      w.ball(.5,.26,.34,'kilnMelt',kiln,-.2,1.9,2.8);
      w.ball(.3,.34,.24,'kilnMelt',kiln,.5,2.7,2.3);
      w.ball(.22,.26,.18,'kilnMelt',kiln,-.55,3.2,2.25);
      // Cracks the heat has opened in the hillside above the mouth.
      // A chimney, sunk into the crown so it grows out of the hill.
      w.box(1.1,1.6,1.1,'caveClayDark',kiln,1.2,7.6,-.3,.16);
      for(const [i,[dx,dy]]of [[-2.6,.9],[2.7,1.3],[-1.2,7],[1.9,7.4]].entries())
        caveRock(w,kiln,dx,dy,2.2,1.3,1.3,1.1,'caveClayDark',i*3,1);
      light(0xff6a1c,110,34,SLOTS.landmarkClear[0]+1,2.6,SLOTS.landmarkClear[2]+3.6);
      light(0xffb066,44,20,SLOTS.landmarkClear[0]+.4,5.4,SLOTS.landmarkClear[2]+2.4);

      // The supplied caverns stand either side of it and carry their own glow.
      cavernModel(w,'crystalcap',root,SLOTS.leftFar[0],-3,SLOTS.leftFar[2],13,.55,{lights:false,glow:1.6});
      cavernModel(w,'grotto',root,SLOTS.rightMass[0],-1,SLOTS.rightMass[2],8,-.8,{lights:false,glow:1.5});
      light(0x6fd2ff,150,50,SLOTS.leftFar[0]+3,1.5,SLOTS.leftFar[2]+4);

      // Ranks of rock stepping back through the haze, paler and greyer the
      // deeper they stand, and a far cluster so the deepest note is a light.
      for(const [i,[slot,wd,h,d,base,mat]]of [
        [SLOTS.leftHigh,7,7,6,-1,'caveSpire'],[SLOTS.deepCentre,12,13,9,-4,'caveVeil'],
        [SLOTS.farRight,7,6,6,-1,'caveSpire'],[SLOTS.deepRank,9,10,8,-3,'caveVeil']
      ].entries())caveRock(w,root,slot[0],base+h/2,slot[2],wd,h,d,mat,i*5+2,0);
      caveCrystals(w,root,SLOTS.landmarkNear[0]-3,-.8,SLOTS.landmarkNear[2]-4,1.8,{light:false,glow:true,halo:1.6});
      light(0x3f9fe8,220,60,SLOTS.landmarkNear[0]-3,0,SLOTS.landmarkNear[2]-4);
    }
  },

  // ---------------------------------------------------------------------------
  // Four · The Hanging Quarter. Counterweights and gondolas over a cloudtop
  // city. The castle it is built under stands across the gap where the hero is
  // looking; the island hangs from two short chains rather than four cables
  // running out of frame; and everything under it is cloud, because the drop
  // is the chapter's subject.
  citadel:{
    biome:'citadel',
    light:{
      sky:'#dfeeff',ground:'#22456c',ambient:1.8,
      sunColor:'#ffe6c2',sunPower:4,sun:[15,16,12],sunTarget:[-2,2,-5],shadow:18,
      fill:'#bdd6f0',fillPower:.58,fillFrom:[-12,7,13],
      rim:'#ffd7a6',rimPower:1.7,rimFrom:[-6,5,-15],
      zenith:'#1774cd',horizon:'#a8cdea',haze:'#ffdcc0',
      sunDirection:[15,8,12],sunSize:320,sunGlow:.78,hazeHeight:1.45,
      fog:'#c6dced',fogNear:20,fogFar:95
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,root,{spin}){
      footing(w,root,{drop:4.4,turn:.14,stone:'top'});
      gate(w,root);
      // Slung, not founded — but the chains stop inside the frame. Four cables
      // running out of the top turned the picture into a set of vertical bars.
      // Mooring blocks on the lip, sitting on the deck rather than sunk into
      // it — at y −0.4 they showed through the top face as dark holes.
      for(const side of [-1,1]){
        const x=.8+side*4.3;
        w.box(1,1.1,1,'blueDark',root,x,.25,-2.7,.16);
        w.mesh(new THREE.TorusGeometry(.3,.075,8,18),'rope',root,x,.85,-2.7).rotation.x=Math.PI/2;
      }
      cityLaundry(w,root,AT.midLeft[0],-.15,AT.midLeft[1],4).rotation.y=.8;
      const potSeat=new THREE.Group();potSeat.position.set(4.4,0,3.2);root.add(potSeat);
      w.pot(potSeat,0,-.08,.28);

      // A gondola hanging off the near right, low enough to clear the gate's
      // flag and small enough not to compete with it.

      // The castle, turned so two of its faces read, standing in the eyeline.
      castle(w,root,SLOTS.landmark[0],SLOTS.landmark[1]+.8,SLOTS.landmark[2],14).rotation.y=.55;
      // A bed of cloud under the castle, so it is standing on the sky rather
      // than stopping in it.
      clouds(w,root,[[SLOTS.landmark[0]-1,SLOTS.landmark[1]-3.4,SLOTS.landmark[2]+1,9],
        [SLOTS.landmark[0]+3.4,SLOTS.landmark[1]-4,SLOTS.landmark[2]-2,7]],{fog:true});
      // A counterweight tower this side of the gap.
      cityLaundry(w,root,SLOTS.midAccent[0],SLOTS.midAccent[1]-2.2,SLOTS.midAccent[2],3).rotation.y=-1.15;

      // Rooftops in the city's own blue clay, rounded hard so they read as
      // hand-pressed masses rather than the stack of plain cubes they were,
      // and cloud through and under all of it.
      // Rooftops far below and beyond, glimpsed between the cloud rather than
      // stacked up behind the island: at full height they were a blue cliff.
      // Small, and well below the island. At seven units a rooftop forty deep
      // still fills a third of the frame, so the quarter's own skyline was
      // standing shoulder to shoulder with its castle and hiding the drop.
      for(const [i,[slot,wd,h,d,base]]of [
        [SLOTS.leftHigh,3,3.6,3,-11],[SLOTS.rightMassFar,3.4,4.4,3.4,-13],[SLOTS.deepCentre,5,6,4.4,-15],
        [SLOTS.farRight,3,4,3,-12],[SLOTS.deepRank,2.6,3,2.6,-10],[SLOTS.deepRankRight,3,3.4,3,-12]
      ].entries()){
        // A hand's rounding, not a third of the block's own width: at that
        // radius every rooftop came out as a beanbag.
        const roof=w.box(wd,h,d,i%2?'back':'back2',root,slot[0],base+h/2,slot[2],.42);
        roof.rotation.y=i*.31;
        // A cap and a chimney give each one a roofline.
        w.box(wd*1.12,.34,d*1.12,'back2',root,slot[0],base+h+.17,slot[2],.14).rotation.y=i*.31;
        w.box(.4,.9,.4,'back',root,slot[0]+wd*.24,base+h+.6,slot[2]-d*.2,.1);
      }
      w.box(6,7,5,'back2',root,SLOTS.leftFar[0],-14,SLOTS.leftFar[2],.5);
      clouds(w,root,[[-13,-7.5,-7,11],[6,-7.5,-2,9],[-18,-9,-13,16],[4,-10,-16,14],[-14,-12,-26,22],[8,-8,-20,13],
        [-24,-8,-19,17],[-6,-11,-31,20],[-32,-10,-33,19],[12,-12,-30,16],
        [-30,12,-30,12],[-8,16,-40,15],[-24,20,-54,19],[4,14,-46,13]],{fog:true});
    }
  },

  // ---------------------------------------------------------------------------
  // Five · The Soft Dream. The last chapter, and the only one whose diorama is
  // allowed to be impossible: the ground is a disc floating in warm nothing,
  // the sky has two planets in it, and the parade the chapter ends with walks
  // past behind the hero at a scale that makes no sense and is right.
  dream:{
    biome:'dream',
    light:{
      sky:'#ffe3f2',ground:'#8d5d8f',ambient:1.95,
      sunColor:'#ffe1c0',sunPower:3.7,sun:[13,15,11],sunTarget:[-2,2,-5],shadow:18,
      fill:'#d8c2ff',fillPower:.72,fillFrom:[-12,6,13],
      rim:'#ffb9e2',rimPower:2,rimFrom:[-6,5,-14],
      zenith:'#6d63c8',horizon:'#ffc3d4',haze:'#fff0c4',
      sunDirection:[13,7,11],sunSize:260,sunGlow:.9,hazeHeight:1.25,
      fog:'#f4c6d8',fogNear:22,fogFar:105
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,root,{light,spin}){
      // A disc rather than an island: the dream's ground has no underside.
      const disc=new THREE.Group();disc.position.set(.8,0,0);disc.rotation.y=.2;root.add(disc);
      w.cylinder(5.8,.8,'top',disc,0,-.4,0);
      // Tufts across the disc, so the dream's ground is not one flat plate.
      for(const [i,[dx,dz,r]]of [[-.3,.34,.5],[.26,-.28,.42],[-.42,-.14,.34],[.36,.2,.36],[.06,.42,.3],[-.1,-.4,.32]].entries())
        w.ball(r,r*.3,r*.8,i%2?'terrain':'top',disc,dx*5.4,-.28,dz*5.4).rotation.set(0,i*.8,0);
      w.cylinder(5.2,1.6,'terrain',disc,0,-1.5,0);
      w.cylinder(3.9,1.8,'terrain2',disc,0,-3,0);
      w.ball(2.4,2,2.4,'terrain2',disc,0,-5,0);
      gate(w,root);
      dreamFlower(w,root,{height:2.7}).root.position.set(AT.nearLeft[0],-.1,AT.nearLeft[1]);
      dreamFlower(w,root,{height:1.9}).root.position.set(AT.nearRight[0],-.12,AT.nearRight[1]);
      dreamFlower(w,root,{height:2.2}).root.position.set(AT.midLeft[0],-.1,AT.midLeft[1]);

      // The parade, crossing the middle distance at dream scale. The giraffe
      // is the landmark and is placed so its whole body reads.
      // backTop 7 made the giraffe a blue mass across the top of the frame
      // with no legs in it. At 4 the whole animal reads, and it is still the
      // tallest thing in the middle distance.
      const giraffe=dreamGiraffe(w,root,{backTop:4,withersX:0});
      // Turned further across so the animal reads as a body rather than a
      // long blue bar drawn through the wordmark.
      giraffe.root.position.set(SLOTS.landmark[0]-.6,-.4,SLOTS.landmark[2]-1.4);giraffe.root.rotation.y=1.62;
      const sculpture=dreamSculpture(w,'sculpture',root,5.4);
      sculpture.position.set(SLOTS.rightMass[0]+5,SLOTS.rightMass[1]+.4,SLOTS.rightMass[2]-4);sculpture.rotation.set(.1,-.75,.06);
      spin(sculpture,.18,'y',0);
      const hat=dreamSculpture(w,'hat',root,1.9);
      hat.position.set(SLOTS.highAccent[0]+7,SLOTS.highAccent[1]-1.8,SLOTS.highAccent[2]+1.4);hat.rotation.set(.3,.5,-.22);
      spin(hat,.35,'z',.09);
      const saucer=dreamSaucer(w,'saucerMint',root,2.6);
      saucer.position.set(SLOTS.leftHigh[0],SLOTS.leftHigh[1],SLOTS.leftHigh[2]);saucer.rotation.set(.1,.7,-.08);

      // The sky: two planets, a sun, and cloud in long soft banks.
      // Clear of the giraffe's head: on the landmark slot the planet sat
      // exactly where the neck ends and the two read as one object.
      const mint=dreamPlanet(w,'mint',root,3.2);mint.position.set(SLOTS.deepRank[0]-9,SLOTS.deepRank[1]+6,SLOTS.deepRank[2]-3);spin(mint,.06,'y',0);
      const berry=dreamPlanet(w,'raspberry',root,2.1);berry.position.set(SLOTS.deepRankRight[0],SLOTS.deepRankRight[1]+2,SLOTS.deepRankRight[2]);spin(berry,-.05,'y',0);
      dreamSun(w,root,4.2).position.set(SLOTS.farRight[0],SLOTS.farRight[1]+4,SLOTS.farRight[2]);
      light(0xffc0e0,55,38,SLOTS.landmarkNear[0],SLOTS.landmarkNear[1]+2,SLOTS.landmarkNear[2]);
      light(0xffe9b8,38,28,SLOTS.midAccent[0]+4,SLOTS.midAccent[1]+2,SLOTS.midAccent[2]+2);
      clouds(w,root,[[-11,-4,-7,13],[7,-5.5,-4,11],[-23,-6,-21,18],[2,-7,-18,15],[-16,-9,-36,26],
        [-30,14,-36,16],[-4,19,-44,18],[-22,23,-58,22]],{fog:true});
      // A wide soft plate far below, so the disc is over something.
      w.box(90,5,60,'back2',root,-14,-26,-42,2);
    }
  }
};
