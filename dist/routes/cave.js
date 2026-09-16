import {chapter,p} from '../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
export default chapter({
  layoutVersion:9,
  name:"The Ember Caverns",short:"Ember Caverns",label:"Wake the heart of the mountain",biome:"cave",
  intro:"Follow the light cables. The way forward sometimes begins above — or below.",sky:"#253c57",fog:"#496d91",spawn:{
  "x": 1.5,
  "y": 0
},end:292,previousDistance:965,cameraY:3,
  sections:[
  {
    "x": -8,
    "name": "The Echo Switchback",
    "landmark": "beacon"
  },
  {
    "x": 57,
    "name": "The Furnace Ferry",
    "landmark": "kiln"
  },
  {
    "x": 112,
    "name": "The Turning Heart",
    "landmark": "pulsedrum"
  },
  {
    "x": 163,
    "name": "The Sunken Relay",
    "landmark": "crystal",
    "quiet": true
  },
  {
    "x": 221,
    "name": "The Spitters’ Gallery",
    "landmark": "crystal"
  },
  {
    "x": 253,
    "name": "The Last Light",
    "landmark": "bellgate"
  }
],
  platforms:[
  {
    "x": -8,
    "y": 0,
    "w": 26,
    "id": "start",
    "landmark": "beacon",
    "kind": "stone"
  },
  {
    "x": 18,
    "y": 0,
    "w": 24,
    "id": "spark-hub",
    "kind": "stone"
  },
    part('cave-plug',{x:42,w:1.4,y:3.3,h:3.3},{x:42,w:2.7,y:.5,h:1.4},{station:'cave-plug',clayRole:'bridge'}),
  {
    "x": 24.5,
    "y": 3.7,
    "w": 4.5,
    "id": "spark-rise",
    "kind": "ledge"
  },
  {
    "x": 32,
    "y": 7.43,
    "w": 1.8,
    "id": "spark-relay",
    "channel": "spark-lock",
    "latch": true,
    "kind": "switch"
  },
  {
    "x": 37.75,
    "y": 8,
    "w": 1.75,
    "h": 8,
    "id": "spark-gate",
    "channel": "spark-lock",
    "kind": "gate"
  },
  {
    "x": 59.75,
    "y": 0,
    "w": 7.25,
    "checkpoint": 62,
    "id": "ferry-dock",
    "landmark": "kiln",
    "kind": "stone"
  },
  {
    "x": 66,
    "y": 0,
    "w": 5,
    "travel": 26,
    "speed": 3.2,
    "id": "furnace-ferry",
    "kind": "ferry"
  },
  {
    "x": 97,
    "y": 0,
    "w": 3.5,
    "checkpoint": 98.25,
    "id": "ferry-exit",
    "landmark": "beacon",
    "kind": "stone"
  },
  {
    "x": 112.75,
    "y": 0,
    "w": 10.25,
    "id": "heart-entry",
    "landmark": "pulsedrum",
    "kind": "stone"
  },
  {
    "x": 124.75,
    "y": 0.75,
    "w": 4,
    "id": "heart-boarding",
    "kind": "ledge"
  },
  {
    "x": 132,
    "y": 6,
    "w": 3.4,
    "moveX": 5.4,
    "moveY": 5.4,
    "period": 12,
    "phase": -1.5707963267948966,
    "id": "heart-paddle",
    "kind": "orbit"
  },
  {
    "x": 132,
    "y": 6,
    "w": 3.4,
    "moveX": 5.4,
    "moveY": 5.4,
    "period": 12,
    "phase": 1.5707963267948966,
    "id": "heart-paddle-back",
    "kind": "orbit"
  },
  {
    "x": 152,
    "y": 10,
    "w": 5.5,
    "id": "heart-balcony",
    "landmark": "beacon",
    "kind": "ledge"
  },
  {
    "x": 154.25,
    "y": 16,
    "w": 1.8,
    "id": "heart-relay",
    "channel": "heart-lock",
    "latch": true,
    "kind": "switch"
  },
  {
    "x": 153.25,
    "y": 15.75,
    "w": 3.25,
    "id": "heart-descent",
    "kind": "ledge"
  },
  {
    "x": 157.75,
    "y": 0,
    "w": 5.25,
    "id": "heart-floor",
    "kind": "stone"
  },
  {
    "x": 158.1,
    "y": 16.25,
    "w": 2.75,
    "h": 6,
    "id": "heart-gate",
    "channel": "heart-lock",
    "kind": "gate"
  },
  {
    "x": 163,
    "y": 0,
    "w": 11,
    "id": "vault-entry",
    "landmark": "crystal",
    "rest": true,
    "kind": "stone"
  },
  {
    "x": 174,
    "y": 0,
    "w": 2.25,
    "checkpoint": 175.125,
    "id": "sluice-hatch",
    "kind": "ledge"
  },
  {
    "x": 204,
    "y": 12.75,
    "w": 2.75,
    "id": "sluice-relay",
    "channel": "sluice-lock",
    "latch": true,
    "kind": "switch"
  },
  {
    "x": 186,
    "y": 1.5,
    "w": 4,
    "moveY": 4.7,
    "period": 6.5,
    "phase": -1.5707963267948966,
    "id": "sluice-lift",
    "kind": "lift"
  },
  {
    "x": 191,
    "y": 5,
    "w": 8,
    "checkpoint": 194,
    "id": "sluice-balcony",
    "landmark": "crystal",
    "kind": "ledge"
  },
  {
    "x": 181.25,
    "y": 6.75,
    "w": 4,
    "id": "sluice-branch",
    "optional": true,
    "kind": "ledge"
  },
  {
    "x": 171,
    "y": 9.75,
    "w": 3.5,
    "id": "sluice-flower",
    "optional": true,
    "kind": "ledge"
  },
  {
    "x": 210.75,
    "y": 4.75,
    "w": 10,
    "id": "sluice-floor",
    "kind": "stone"
  },
  {
    "x": 209,
    "y": 16,
    "w": 1.6,
    "h": 5,
    "id": "sluice-gate",
    "channel": "sluice-lock",
    "kind": "gate"
  },
  {
    "x": 221,
    "y": 3,
    "w": 10,
    "checkpoint": 226,
    "id": "gallery-entry",
    "landmark": "crystal",
    "kind": "stone"
  },
  {
    "x": 234,
    "y": 1.8,
    "w": 4,
    "delay": 1,
    "id": "gallery-crumble",
    "kind": "crumble"
  },
  {
    "x": 240,
    "y": 1.8,
    "w": 8,
    "id": "gallery-watch",
    "kind": "stone"
  },
  {
    "x": 250,
    "y": 0.4,
    "w": 7,
    "checkpoint": 254,
    "id": "gallery-out",
    "kind": "stone"
  },
  {
    "x": 258,
    "y": 2,
    "w": 4,
    "id": "last-step",
    "kind": "ledge"
  },
  {
    "x": 253,
    "y": 3.8,
    "w": 4,
    "id": "last-turn",
    "kind": "ledge"
  },
  {
    "x": 259,
    "y": 5.6,
    "w": 6.5,
    "id": "last-relay-floor",
    "landmark": "beacon",
    "kind": "ledge"
  },
  {
    "x": 274,
    "y": 5.5,
    "w": 1.8,
    "id": "last-relay",
    "channel": "last-light",
    "latch": true,
    "kind": "switch"
  },
  {
    "x": 268,
    "y": 4,
    "w": 5.75,
    "id": "last-return",
    "kind": "ledge"
  },
  {
    "x": 253.75,
    "y": 7.25,
    "w": 3.75,
    "id": "last-bridge",
    "channel": "last-light",
    "kind": "timed"
  },
  {
    "x": 259,
    "y": 9.25,
    "w": 4,
    "period": 4.8,
    "phase": 0.15,
    "duty": 0.78,
    "id": "last-pulse",
    "kind": "pulse"
  },
  {
    "x": 288,
    "y": 0,
    "w": 12,
    "bellX": 4,
    "id": "ember-bell",
    "landmark": "bellgate",
    "goal": true,
    "kind": "stone"
  },
  {
    "x": 19.75,
    "y": 5.5,
    "w": 2,
    "delay": 0.35,
    "id": "clay-1",
    "kind": "crumble"
  },
  {
    "x": 14.75,
    "y": 7,
    "w": 2,
    "delay": 0.35,
    "id": "clay-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 9.5,
    "y": 8.5,
    "w": 2,
    "delay": 0.35,
    "id": "clay-1-copy-2",
    "kind": "crumble"
  },
  {
    "x": 31.5,
    "y": 2,
    "w": 2,
    "delay": 0.35,
    "id": "clay-1-copy-3",
    "kind": "crumble"
  },
  {
    "x": 44.5,
    "y": 0.5,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-2",
    "kind": "crumble"
  },
  {
    "x": 49,
    "y": -0.5,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-2-copy-1",
    "kind": "crumble"
  },
  {
    "x": 31.5,
    "y": 7.25,
    "w": 3,
    "id": "spark-balcony-copy-1",
    "landmark": "beacon",
    "kind": "ledge"
  },
  {
    "x": 25.25,
    "y": 7.25,
    "w": 2,
    "delay": 0.35,
    "id": "clay-1-copy-4",
    "kind": "crumble"
  },
  {
    "x": 56.25,
    "y": -1.75,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-2-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 79.75,
    "y": 2.5,
    "w": 2,
    "delay": 0.45,
    "id": "clay-3",
    "kind": "crumble"
  },
  {
    "x": 84,
    "y": 4.75,
    "w": 2,
    "delay": 0.35,
    "id": "clay-3-copy-1",
    "kind": "crumble"
  },
  {
    "x": 79,
    "y": 7,
    "w": 2,
    "delay": 0.35,
    "id": "clay-3-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 69,
    "y": 7.25,
    "w": 5.75,
    "delay": 0.55,
    "id": "clay-3-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 102,
    "y": 1,
    "w": 2.25,
    "moveY": 1.2,
    "period": 5,
    "id": "clay-4",
    "kind": "lift"
  },
  {
    "x": 106,
    "y": 3.75,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5",
    "kind": "crumble"
  },
  {
    "x": 109.25,
    "y": 5.75,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5-copy-1",
    "kind": "crumble"
  },
  {
    "x": 105.75,
    "y": 8,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 110.25,
    "y": 10.25,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 106,
    "y": 12.75,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 110.25,
    "y": 15,
    "w": 2.25,
    "delay": 0.45,
    "id": "clay-5-copy-1-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 102.25,
    "y": 23,
    "w": 13,
    "h": 4,
    "id": "clay-6",
    "kind": "wall"
  },
  {
    "x": 94.75,
    "y": 19,
    "w": 11,
    "h": 4,
    "id": "clay-6-copy-1",
    "kind": "wall"
  },
  {
    "x": 23.75,
    "y": 19.75,
    "w": 15,
    "h": 7.75,
    "id": "clay-7",
    "kind": "wall"
  },
  {
    "x": 37.25,
    "y": 19.75,
    "w": 30,
    "h": 11.25,
    "id": "clay-7-copy-1",
    "kind": "wall"
  },
  {
    "x": -8.5,
    "y": 14,
    "w": 18,
    "id": "clay-8",
    "kind": "stone"
  },
  {
    "x": 157.5,
    "y": 10,
    "w": 4,
    "h": 10.25,
    "id": "clay-9",
    "kind": "wall"
  },
  {
    "x": 112.5,
    "y": 20,
    "w": 13,
    "h": 15,
    "id": "clay-10",
    "kind": "wall"
  },
  {
    "x": 146.5,
    "y": 11.25,
    "w": 3.5,
    "id": "clay-11-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 141.25,
    "y": 9.5,
    "w": 3,
    "id": "clay-12",
    "kind": "stone"
  },
  {
    "x": 157.5,
    "y": 26.75,
    "w": 4,
    "h": 10,
    "id": "clay-11",
    "kind": "wall"
  },
  {
    "x": 134.5,
    "y": 15,
    "w": 6.25,
    "id": "clay-13",
    "kind": "ledge"
  },
  {
    "x": 143.75,
    "y": 16,
    "w": 2.5,
    "id": "clay-11-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 142.75,
    "y": 13,
    "w": 2.5,
    "id": "clay-11-copy-1-copy-1-copy-2",
    "kind": "crumble"
  },
  {
    "x": 148.75,
    "y": 15.5,
    "w": 2.5,
    "id": "clay-11-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 161.5,
    "y": 10,
    "w": 8.25,
    "delay": 0.15,
    "id": "clay-14",
    "kind": "crumble"
  },
  {
    "x": 161.25,
    "y": 7.5,
    "w": 4,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 161.75,
    "y": 4.75,
    "w": 5.75,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 161.5,
    "y": 1.75,
    "w": 6.5,
    "id": "clay-15",
    "kind": "stone"
  },
  {
    "x": 175.75,
    "y": -1.5,
    "w": 3.5,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 178,
    "y": -3,
    "w": 3.5,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 180.75,
    "y": -4.5,
    "w": 3.5,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 176,
    "y": 8,
    "w": 3.5,
    "delay": 0.25,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2",
    "kind": "crumble"
  },
  {
    "x": 200.5,
    "y": 7.25,
    "w": 2.75,
    "period": 4.8,
    "duty": 0.76,
    "id": "clay-16",
    "kind": "pulse"
  },
  {
    "x": 196.75,
    "y": 9,
    "w": 2.75,
    "delay": 0.25,
    "id": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2-copy-1",
    "kind": "crumble"
  },
  {
    "x": 200.5,
    "y": 10.75,
    "w": 2.75,
    "period": 4.8,
    "duty": 0.76,
    "id": "clay-16-copy-1",
    "kind": "pulse"
  },
  {
    "x": 208.5,
    "y": 10.75,
    "w": 2.75,
    "id": "clay-17",
    "kind": "stone"
  },
  {
    "x": 211.25,
    "y": 10.75,
    "w": 2.75,
    "delay": 0.15,
    "id": "clay-14-copy-1",
    "kind": "crumble"
  },
  {
    "x": 211.25,
    "y": 7.5,
    "w": 7.25,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-2",
    "kind": "crumble"
  },
  {
    "x": 211.25,
    "y": 8.75,
    "w": 6.25,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-2-copy-1",
    "kind": "crumble"
  },
  {
    "x": 211.25,
    "y": 9.75,
    "w": 4.25,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-2-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 211.25,
    "y": 6.25,
    "w": 8.25,
    "delay": 0.15,
    "id": "clay-14-copy-1-copy-2-copy-2",
    "kind": "crumble"
  },
  {
    "x": 271.5,
    "y": 10.5,
    "w": 4,
    "period": 4.8,
    "phase": 0.15,
    "duty": 0.78,
    "id": "last-pulse-copy-1",
    "kind": "pulse"
  },
  {
    "x": 265.5,
    "y": 10,
    "w": 4,
    "delay": 0.35,
    "id": "clay-19",
    "kind": "crumble"
  },
  {
    "x": 280,
    "y": 10.5,
    "w": 2.75,
    "delay": 0.35,
    "id": "clay-19-copy-1",
    "kind": "crumble"
  },
  {
    "x": 280.75,
    "y": 8.5,
    "w": 3.25,
    "delay": 0.35,
    "id": "clay-19-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 282,
    "y": 6.5,
    "w": 3.5,
    "delay": 0.35,
    "id": "clay-19-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 283.25,
    "y": 4.5,
    "w": 3.75,
    "delay": 0.35,
    "id": "clay-19-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 284.5,
    "y": 2.75,
    "w": 3.75,
    "delay": 0.35,
    "id": "clay-19-copy-1-copy-1-copy-1-copy-1-copy-1",
    "kind": "crumble"
  },
  {
    "x": 273.75,
    "y": 5.25,
    "w": 2.25,
    "id": "clay-18",
    "kind": "stone"
  },
  {
    "x": 281,
    "y": 15.5,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-19-copy-2",
    "kind": "crumble"
  },
  {
    "x": 284,
    "y": 17,
    "w": 2.5,
    "period": 4.8,
    "phase": 0.15,
    "duty": 0.78,
    "id": "last-pulse-copy-1-copy-1",
    "kind": "pulse"
  },
  {
    "x": 284,
    "y": 20.5,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-19-copy-2-copy-1",
    "kind": "crumble"
  },
  {
    "x": 281,
    "y": 18.75,
    "w": 2.25,
    "delay": 0.35,
    "id": "clay-19-copy-2-copy-2",
    "kind": "crumble"
  },
  {
    "x": 283,
    "y": 13,
    "w": 3,
    "delay": 0.35,
    "id": "clay-19-copy-2-copy-3",
    "kind": "crumble"
  },
  {
    "x": 277.75,
    "y": 10.5,
    "w": 2.25,
    "checkpoint": 278.875,
    "id": "clay-20",
    "kind": "ledge"
  },
  {
    "x": 109.75,
    "y": 0,
    "w": 3,
    "checkpoint": 111.25,
    "id": "clay-21",
    "kind": "stone"
  }
],
  shaping:[
    // The third gesture, and the last one chapter four needs the player to know:
    // a pillar across the tunnel mouth that is spread outward until it is floor.
    {id:'cave-plug',icon:'landing',name:'Spread the pillar',verb:'Pull outward',gesture:'out',parts:['cave-plug'],x:34,end:48,
     spawn:{x:38,y:0,groundId:'spark-hub'},
     hint:'Pull either edge of the violet pillar outward until it is floor. Or hold E / KNEAD.'}
  ],
  routeLinks:[
  {
    "from": "start",
    "to": "spark-hub",
    "mode": "walk"
  },
  {
    "from": "spark-hub",
    "to": "clay-1-copy-3",
    "mode": "jump"
  },
  {
    "from": "clay-1-copy-3",
    "to": "spark-rise",
    "mode": "jump"
  },
  {
    "from": "spark-rise",
    "to": "clay-1",
    "mode": "jump"
  },
  {
    "from": "clay-1",
    "to": "clay-1-copy-4",
    "mode": "jump"
  },
  {
    "from": "clay-1-copy-4",
    "to": "spark-relay",
    "mode": "jump"
  },
  {
    "from": "spark-relay",
    "to": "spark-hub",
    "mode": "jump"
  },
  {
    "from": "spark-hub",
    "to": "cave-plug",
    "mode": "jump"
  },
  {
    "from": "cave-plug",
    "to": "clay-2",
    "mode": "jump"
  },
  {
    "from": "clay-2",
    "to": "clay-2-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-2-copy-1",
    "to": "clay-2-copy-1-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-2-copy-1-copy-1-copy-1",
    "to": "ferry-dock",
    "mode": "jump"
  },
  {
    "from": "ferry-dock",
    "to": "furnace-ferry",
    "mode": "board"
  },
  {
    "from": "furnace-ferry",
    "to": "ferry-exit",
    "mode": "ride"
  },
  {
    "from": "ferry-exit",
    "to": "clay-4",
    "mode": "board"
  },
  {
    "from": "clay-4",
    "to": "clay-5",
    "mode": "ride"
  },
  {
    "from": "clay-5",
    "to": "clay-21",
    "mode": "jump"
  },
  {
    "from": "clay-21",
    "to": "heart-entry",
    "mode": "jump"
  },
  {
    "from": "heart-entry",
    "to": "heart-boarding",
    "mode": "jump"
  },
  {
    "from": "heart-boarding",
    "to": "heart-paddle",
    "mode": "board"
  },
  {
    "from": "heart-paddle",
    "to": "clay-12",
    "mode": "ride"
  },
  {
    "from": "clay-12",
    "to": "clay-11-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-11-copy-1-copy-1",
    "to": "clay-11-copy-1-copy-1-copy-2",
    "mode": "jump"
  },
  {
    "from": "clay-11-copy-1-copy-1-copy-2",
    "to": "clay-11-copy-1-copy-1-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-11-copy-1-copy-1-copy-1-copy-1",
    "to": "heart-relay",
    "mode": "jump"
  },
  {
    "from": "heart-relay",
    "to": "clay-9",
    "mode": "jump"
  },
  {
    "from": "clay-9",
    "to": "clay-14",
    "mode": "fall"
  },
  {
    "from": "clay-14",
    "to": "vault-entry",
    "mode": "jump"
  },
  {
    "from": "vault-entry",
    "to": "sluice-hatch",
    "mode": "walk"
  },
  {
    "from": "sluice-hatch",
    "to": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
    "to": "sluice-lift",
    "mode": "board"
  },
  {
    "from": "sluice-lift",
    "to": "sluice-balcony",
    "mode": "ride"
  },
  {
    "from": "sluice-balcony",
    "to": "clay-16",
    "mode": "jump"
  },
  {
    "from": "clay-16",
    "to": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2-copy-1",
    "to": "clay-16-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-16-copy-1",
    "to": "sluice-relay",
    "mode": "jump"
  },
  {
    "from": "sluice-relay",
    "to": "clay-14-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-14-copy-1",
    "to": "clay-14-copy-1-copy-2-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-14-copy-1-copy-2-copy-1-copy-1",
    "to": "clay-14-copy-1-copy-2-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-14-copy-1-copy-2-copy-1",
    "to": "gallery-entry",
    "mode": "jump"
  },
  {
    "from": "gallery-entry",
    "to": "gallery-crumble",
    "mode": "jump"
  },
  {
    "from": "gallery-crumble",
    "to": "gallery-watch",
    "mode": "jump"
  },
  {
    "from": "gallery-watch",
    "to": "gallery-out",
    "mode": "jump"
  },
  {
    "from": "gallery-out",
    "to": "last-step",
    "mode": "jump"
  },
  {
    "from": "last-step",
    "to": "last-turn",
    "mode": "jump"
  },
  {
    "from": "last-turn",
    "to": "last-relay-floor",
    "mode": "jump"
  },
  {
    "from": "last-relay-floor",
    "to": "last-return",
    "mode": "jump"
  },
  {
    "from": "last-return",
    "to": "last-relay",
    "mode": "jump"
  },
  {
    "from": "last-relay",
    "to": "last-return",
    "mode": "jump"
  },
  {
    "from": "last-return",
    "to": "last-relay-floor",
    "mode": "jump"
  },
  {
    "from": "last-relay-floor",
    "to": "last-bridge",
    "mode": "jump"
  },
  {
    "from": "last-bridge",
    "to": "last-pulse",
    "mode": "jump"
  },
  {
    "from": "last-pulse",
    "to": "clay-19",
    "mode": "jump"
  },
  {
    "from": "clay-19",
    "to": "last-pulse-copy-1",
    "mode": "jump"
  },
  {
    "from": "last-pulse-copy-1",
    "to": "clay-19-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-19-copy-1",
    "to": "clay-19-copy-1-copy-1",
    "mode": "jump"
  },
  {
    "from": "clay-19-copy-1-copy-1",
    "to": "ember-bell",
    "mode": "jump"
  }
],
  detours:[
  [
    {
      "from": "clay-1",
      "to": "clay-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-1-copy-1",
      "to": "clay-1-copy-2",
      "mode": "jump"
    },
    {
      "from": "clay-1-copy-2",
      "to": "clay-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-1-copy-1",
      "to": "clay-1",
      "mode": "jump"
    }
  ],
  [
    {
      "from": "furnace-ferry",
      "to": "clay-3",
      "mode": "jump"
    },
    {
      "from": "clay-3",
      "to": "clay-3-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-3-copy-1",
      "to": "clay-3-copy-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-3-copy-1-copy-1",
      "to": "clay-3-copy-1-copy-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "ferry-dock",
      "to": "furnace-ferry",
      "mode": "board"
    },
    {
      "from": "furnace-ferry",
      "to": "ferry-exit",
      "mode": "ride"
    }
  ],
  [
    {
      "from": "clay-5-copy-1",
      "to": "clay-5-copy-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-5-copy-1-copy-1",
      "to": "clay-5-copy-1-copy-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-5-copy-1-copy-1-copy-1",
      "to": "heart-entry",
      "mode": "fall"
    }
  ],
  [
    {
      "from": "sluice-balcony",
      "to": "sluice-lift",
      "mode": "board"
    },
    {
      "from": "sluice-lift",
      "to": "sluice-branch",
      "mode": "ride"
    },
    {
      "from": "sluice-branch",
      "to": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2",
      "mode": "jump"
    },
    {
      "from": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-2",
      "to": "sluice-flower",
      "mode": "jump"
    },
    {
      "from": "sluice-flower",
      "to": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
      "mode": "jump"
    },
    {
      "from": "clay-14-copy-1-copy-1-copy-1-copy-1-copy-1-copy-1",
      "to": "sluice-lift",
      "mode": "board"
    },
    {
      "from": "sluice-lift",
      "to": "sluice-balcony",
      "mode": "ride"
    }
  ]
],recoveries:[
  [],
  [
    {
      "from": "sluice-lift",
      "to": "sluice-balcony",
      "mode": "ride"
    }
  ]
],circuits:[
  {
    "source": "spark-relay",
    "channel": "spark-lock",
    "targets": [
      "spark-gate"
    ],
    "kind": "relay"
  },
  {
    "source": "heart-relay",
    "channel": "heart-lock",
    "targets": [
      "heart-gate"
    ],
    "kind": "relay"
  },
  {
    "source": "sluice-relay",
    "channel": "sluice-lock",
    "targets": [
      "sluice-gate"
    ],
    "kind": "relay"
  },
  {
    "source": "last-relay",
    "channel": "last-light",
    "targets": [
      "last-bridge"
    ],
    "kind": "relay"
  }
],
  crushers:[
  {
    "x": 77,
    "y": 5.2,
    "w": 2,
    "period": 5.4,
    "floorY": 0,
    "range": 4.55,
    "holdChannel": "press-a"
  },
  {
    "x": 88,
    "y": 5.2,
    "w": 2,
    "period": 5.4,
    "phase": 3.141592653589793,
    "floorY": 0,
    "range": 4.55,
    "holdChannel": "press-a"
  },
  {
    "x": 94,
    "y": 5.25,
    "w": 2,
    "period": 5.4,
    "phase": 3.141592653589793,
    "floorY": 0,
    "range": 4.55,
    "holdChannel": "press-a"
  }
],winds:[],coins:[
  {
    "x": 4,
    "y": 1
  },
  {
    "x": 35,
    "y": 8.25
  },
  {
    "x": 35.75,
    "y": 6.25
  },
  {
    "x": 36.25,
    "y": 4.25
  },
  {
    "x": 57.5,
    "y": -0.75
  },
  {
    "x": 70,
    "y": 1
  },
  {
    "x": 73.4,
    "y": 1
  },
  {
    "x": 76.8,
    "y": 1
  },
  {
    "x": 80.2,
    "y": 1
  },
  {
    "x": 83.6,
    "y": 1
  },
  {
    "x": 87,
    "y": 1
  },
  {
    "x": 90.4,
    "y": 1
  },
  {
    "x": 98,
    "y": 1
  },
  {
    "x": 110.5,
    "y": 6.5
  },
  {
    "x": 116.2,
    "y": 1
  },
  {
    "x": 141.5,
    "y": 6.5
  },
  {
    "x": 187,
    "y": -1
  },
  {
    "x": 187,
    "y": 0.5
  },
  {
    "x": 188,
    "y": 2
  },
  {
    "x": 188,
    "y": 3.5
  },
  {
    "x": 192,
    "y": 6
  },
  {
    "x": 193.1,
    "y": 6
  },
  {
    "x": 194.2,
    "y": 6
  },
  {
    "x": 198,
    "y": 10
  },
  {
    "x": 205.5,
    "y": 13.75
  },
  {
    "x": 212,
    "y": 5.5
  },
  {
    "x": 230.75,
    "y": 4
  },
  {
    "x": 235.75,
    "y": 2.75
  },
  {
    "x": 242.1,
    "y": 2.8
  },
  {
    "x": 255.1,
    "y": 4.8
  },
  {
    "x": 261.1,
    "y": 6.6
  },
  {
    "x": 274.75,
    "y": 6.5
  },
  {
    "x": 255.5,
    "y": 8.25
  },
  {
    "x": 267.5,
    "y": 10.75
  },
  {
    "x": 213.5,
    "y": 5.5
  },
  {
    "x": 215.25,
    "y": 5.5
  },
  {
    "x": 217,
    "y": 5.5
  },
  {
    "x": 219,
    "y": 5.5
  }
],stamps:[
  {
    "x": 10.5,
    "y": 9.75
  },
  {
    "x": 74,
    "y": 8.25
  },
  {
    "x": 172.7,
    "y": 10.75
  },
  {
    "x": 111.25,
    "y": 16.5
  },
  {
    "x": 285.25,
    "y": 21.5
  }
],enemies:[
  {
    "x": 198,
    "y": 5,
    "speed": 0.38,
    "min": 192,
    "max": 198,
    "kind": "spitter"
  },
  {
    "x": 245,
    "y": 1.8,
    "speed": 0.38,
    "min": 241,
    "max": 247,
    "kind": "spitter"
  },
  {
    "x": 270.5,
    "y": 4.25,
    "period": 5,
    "phase": 1.5,
    "bob": 0.3,
    "speed": 1.1,
    "min": 268.5,
    "max": 273,
    "kind": "bat"
  },
  {
    "x": 17,
    "y": 0.75,
    "period": 4.6,
    "bob": 0.55,
    "speed": 1.25,
    "min": 9,
    "max": 21,
    "kind": "bat"
  },
  {
    "x": 121,
    "y": 0,
    "speed": 0.38,
    "min": 119,
    "max": 123,
    "kind": "spitter"
  },
  {
    "x": 155.5,
    "y": 10.5,
    "period": 4.6,
    "bob": 0.55,
    "speed": 1.25,
    "min": 152.25,
    "max": 157.1,
    "kind": "bat"
  },
  {
    "x": 136.75,
    "y": 15.5,
    "period": 4.6,
    "bob": 0.55,
    "speed": 1.25,
    "min": 135.15,
    "max": 140,
    "kind": "bat"
  }
],hazards:[
  {
    "x": 67,
    "y": -4.6,
    "w": 29.75
  },
  {
    "x": 123,
    "y": -5.5,
    "w": 19
  },
  {
    "x": 231,
    "y": -3.5,
    "w": 9
  },
  {
    "x": 248,
    "y": -3.5,
    "w": 2
  },
  {
    "x": 257,
    "y": -4.8,
    "w": 30
  },
  {
    "x": 174,
    "y": -7.5,
    "w": 15.25
  }
],
  hints:[
    {x:34,end:48,icon:'landing',title:'Spread the clay',text:'Drag either edge of the violet clay outward, or hold E.',touchText:'Drag either edge of the violet clay outward.'},
  {
    "x": 24,
    "end": 32,
    "icon": "relay",
    "title": "Relay",
    "text": "The switch above opens the gate."
  },
  {
    "x": 58,
    "end": 67,
    "icon": "ferry",
    "title": "Steer the ferry",
    "text": "Stand at the edges to move."
  }
],guides:[
  {
    "platformId": "spark-rise",
    "offset": 1,
    "dir": -1
  },
  {
    "platformId": "spark-balcony-copy-1",
    "offset": 1,
    "dir": 1
  },
  {
    "platformId": "heart-balcony",
    "offset": 3,
    "dir": 1
  },
  {
    "platformId": "sluice-hatch",
    "offset": 1.1,
    "dir": 0
  },
  {
    "platformId": "sluice-branch",
    "offset": 1,
    "dir": -1
  },
  {
    "platformId": "last-step",
    "offset": 1,
    "dir": -1
  }
]
});
