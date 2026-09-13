import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {makeMovingPlatform} from '../dist/moving-platform.js';
import {attachClay} from '../tests/load-clay.mjs';
import {exportReview} from './review-scene.mjs';
const w=Object.create(World.prototype);w.mat={};w.scene=new THREE.Scene();
const images=await attachClay(w),root=new THREE.Group();w.scene.add(root);
makeMovingPlatform(w,{w:5.8,y:0},root);
await exportReview(w.scene,null,process.argv[2],{camera:{x:2.9,y:1.35,z:26,elevation:2,viewH:5.1,viewW:7.2},theme:{skyLight:0xfff5e8,ambient:1.4,sun:0xffe6c0,sunPower:2.8},sky:'#fffaf2',fog:'#fffaf2',fogNear:100,fogFar:200,backgroundBlur:0},images);
