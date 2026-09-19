// Who the player is wearing. Everything that differs between the supplied
// characters lives here so hero.js can treat them identically.
//
// A character is one rig plus its own copy of the same nine animations. That is
// what lets them swap in place: the movement states, the flower celebration and
// the baked floor corrections all address the same joint names, over the same
// gameplay origin between the feet.
//
// The supplied files each arrived with at most a single Running cycle, so
// scripts/prepare-character.mjs retargets the rest of the set from the original
// rig. Four of them name their joints the way the original does under a vendor
// prefix, which hero.js drops on load. The apprentice came off another exporter
// entirely — its own anatomy of names, no clips, and a root bone carrying the
// tilt of whatever authored it — so scripts/prepare-rig.mjs settled its names
// and its frame offline, before anything here ever sees it.
//
// `height` is how tall the character stands in world units. `orangeSource` is
// the red level a character's texture treats as full orange: the clay shader
// pulls that pigment to the game's own orange and leaves every other colour
// alone, which is how the original was tied to the palette. The supplied
// characters are already painted in clay colours of their own, so they set it to
// zero and keep their skin exactly as it was made — they still take the clay
// surface relief, which is finish rather than colour. `clayDepth` is how deep
// that relief is pressed. Unset, a character takes the shallow press every
// imported model gets (.025); the terrain is pressed to .075. The apprentice's
// paint is darker and busier than the others', which swallowed the shallow
// press, so it asks for one nearer the ground it stands on. `mirror` turns a
// character over across its own sagittal plane. The game is played facing
// right, and the apprentice's hair is swept to the side that then faces the
// camera, hiding its face; mirrored, the clear profile is the one on show.
const STANDING=1.78;

export const CHARACTERS=[
  {
    id:'clay',name:'Original',note:'The first clay figure.',
    model:'player.glb',motion:'player-motion.json',animation:'player-idle.json',
    height:STANDING,orangeSource:.780
  },
  {
    id:'emberleaf',name:'Emberleaf wanderer',note:'Rust and cream, long-limbed.',
    model:'wanderer.glb',motion:'wanderer-motion.json',animation:'wanderer-animation.json',
    height:STANDING*1.5,orangeSource:0,bonePrefix:'mixamorig'
  },
  {
    id:'clay-wanderer',name:'Clay wanderer',note:'Soft rose and stone.',
    model:'clay-wanderer.glb',motion:'clay-wanderer-motion.json',animation:'clay-wanderer-animation.json',
    height:STANDING*1.5,orangeSource:0,bonePrefix:'mixamorig'
  },
  {
    id:'garden-helper',name:'Garden helper',note:'Sage, terracotta and straw.',
    model:'garden-helper.glb',motion:'garden-helper-motion.json',animation:'garden-helper-animation.json',
    height:STANDING*1.5,orangeSource:0,bonePrefix:'mixamorig'
  },
  {
    id:'apprentice',name:'Clay apprentice',note:'Terracotta and cream, capped. Who you start as.',
    model:'apprentice.glb',motion:'apprentice-motion.json',animation:'apprentice-animation.json',
    height:STANDING*1.15,orangeSource:0,clayDepth:.06,mirror:true
  },
  {
    id:'explorer',name:'Raincoat explorer',note:'Sunflower yellow, chestnut and olive.',
    model:'explorer.glb',motion:'explorer-motion.json',animation:'explorer-animation.json',
    height:STANDING*1.5,orangeSource:0,bonePrefix:'mixamorig'
  }
];

// Who everyone plays as until they choose otherwise. The original stays first
// in the list — it is the rig the others were retargeted from, and every test
// that reads CHARACTERS[0] means it — but the apprentice is the one worn.
export const DEFAULT_CHARACTER='apprentice';
export const characterChoice=id=>CHARACTERS.find(entry=>entry.id===id)||CHARACTERS.find(entry=>entry.id===DEFAULT_CHARACTER);
