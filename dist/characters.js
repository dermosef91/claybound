// Who the player is wearing. Everything that differs between the supplied
// characters lives here so hero.js can treat them identically.
//
// A character is one rig plus its own copy of the same nine animations. That is
// what lets them swap in place: the movement states, the flower celebration and
// the baked floor corrections all address the same joint names, at the same
// normalized height, with the same gameplay origin between the feet.
//
// The three newer files each arrived with a single Running cycle and their
// exporter's prefixed joint names, so scripts/prepare-character.mjs retargets
// the rest of the set from the original rig, and the prefix is dropped on load.
//
// `orangeSource` is the red level a character's own texture treats as full
// orange. The clay shader shifts that pigment to the game's orange and leaves
// every other colour alone, which is what keeps four different palettes reading
// as one cast; set it to 0 to ship a character's colours exactly as supplied.
export const CHARACTERS=[
  {
    id:'clay',name:'Original',note:'Who you started as.',
    model:'player.glb',motion:'player-motion.json',animation:'player-idle.json',
    orangeSource:.780
  },
  {
    id:'emberleaf',name:'Emberleaf wanderer',note:'Rust and cream, long-limbed.',
    model:'wanderer.glb',motion:'wanderer-motion.json',animation:'wanderer-animation.json',
    orangeSource:.584,bonePrefix:'mixamorig'
  },
  {
    id:'clay-wanderer',name:'Clay wanderer',note:'Soft rose and stone.',
    model:'clay-wanderer.glb',motion:'clay-wanderer-motion.json',animation:'clay-wanderer-animation.json',
    orangeSource:.459,bonePrefix:'mixamorig'
  },
  {
    id:'garden-helper',name:'Garden helper',note:'Sage, terracotta and straw.',
    model:'garden-helper.glb',motion:'garden-helper-motion.json',animation:'garden-helper-animation.json',
    orangeSource:.494,bonePrefix:'mixamorig'
  }
];

export const characterChoice=id=>CHARACTERS.find(entry=>entry.id===id)||CHARACTERS[0];
