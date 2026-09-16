// Teach a supplied skeleton the vocabulary the game already speaks.
//
// Every character has to answer to one set of joint names over one model frame,
// because that is what lets hero.js, the retarget in prepare-character.mjs and
// the two-handed flower celebration address any of them. The characters shipped
// so far arrived on rigs that only differed from the original by a vendor
// prefix, which hero.js drops on load. A rig from another exporter differs in
// two deeper ways that no load-time rename can reach:
//
//   * its joints are named for a different anatomy — `L_Upperarm` for an arm,
//     `Waist` for the first spine link — with no head tip at all;
//   * its skeleton hangs off an extra root bone that carries the Z-up rotation
//     of whatever authored it, so the hips' own axes are not the model's. The
//     game pins a character laterally and drives it vertically through that one
//     track, and both of those are axis-aligned.
//
// So the rename and the frame are settled here, once, offline. Only the GLB's
// JSON chunk is touched: the binary chunk — geometry, skinning weights, bind
// matrices and texture — is copied through byte for byte, and every joint keeps
// the exact rest pose it was authored with, which is what the check at the end
// of this script measures rather than assumes.
//
// Usage: node scripts/prepare-rig.mjs SUPPLIED_GLB NORMALIZED_GLB
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';

// Supplied joint → the name the game binds to. The head is already spelt the
// way the game spells it; it is listed so the whole body is visible in one
// place. `Neck1` is the spare link this rig carries between the neck and the
// head: the game has no use for it, but naming it after the chain it belongs to
// keeps it from reading as an anatomy the game forgot about.
const TRIPO={
  Hip:'Hips',Waist:'Spine',Spine01:'Spine1',Spine02:'Spine2',
  NeckTwist01:'Neck',NeckTwist02:'Neck1',Head:'Head',
  L_Clavicle:'LeftShoulder',L_Upperarm:'LeftArm',L_Forearm:'LeftForeArm',L_Hand:'LeftHand',
  R_Clavicle:'RightShoulder',R_Upperarm:'RightArm',R_Forearm:'RightForeArm',R_Hand:'RightHand',
  L_Thigh:'LeftUpLeg',L_Calf:'LeftLeg',L_Foot:'LeftFoot',L_ToeBase:'LeftToeBase',
  R_Thigh:'RightUpLeg',R_Calf:'RightLeg',R_Foot:'RightFoot',R_ToeBase:'RightToeBase'
};
const DIALECTS={tripo:TRIPO};
// What the game reaches for by name: the states bind the limbs and spine, the
// celebration solves both arms and tilts the head, and the hips carry the root.
const REQUIRED=['Hips','Spine','Spine1','Spine2','Neck','Head',
  ...['Left','Right'].flatMap(side=>['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase'].map(part=>side+part))];

const MAGIC=0x46546c67,JSON_CHUNK=0x4e4f534a;
function splitGLB(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==MAGIC)throw new Error('Not a binary glTF file.');
  const length=view.getUint32(12,true);
  if(view.getUint32(16,true)!==JSON_CHUNK)throw new Error('The first GLB chunk is not JSON.');
  // Everything after the JSON chunk — the binary chunk and its header — is
  // carried across untouched, so nothing this script writes can reach it.
  return {doc:JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length))),rest:bytes.subarray(20+length)};
}
function joinGLB(doc,rest){
  const json=Buffer.from(JSON.stringify(doc));
  const padded=Buffer.concat([json,Buffer.alloc((-json.length)%4&3,0x20)]);
  const header=Buffer.alloc(20);
  header.writeUInt32LE(MAGIC,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+rest.length,8);
  header.writeUInt32LE(padded.length,12);header.writeUInt32LE(JSON_CHUNK,16);
  return Buffer.concat([header,padded,rest]);
}

const local=node=>node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(
  new THREE.Vector3().fromArray(node.translation||[0,0,0]),
  new THREE.Quaternion().fromArray(node.rotation||[0,0,0,1]),
  new THREE.Vector3().fromArray(node.scale||[1,1,1]));

const [from,to]=process.argv.slice(2);
if(!from||!to)throw new Error('Usage: node scripts/prepare-rig.mjs SUPPLIED_GLB NORMALIZED_GLB');
const supplied=await readFile(from);
const {doc,rest}=splitGLB(supplied);

const named=new Map(doc.nodes.map((node,index)=>[node.name,index]));
const [dialect,rename]=Object.entries(DIALECTS).find(([,map])=>Object.keys(map).every(name=>named.has(name)))||[];
if(!rename)throw new Error(`This rig speaks none of the known dialects (${Object.keys(DIALECTS).join(', ')}); its joints are: ${[...named.keys()].join(', ')}`);
for(const [authored,name] of Object.entries(rename))doc.nodes[named.get(authored)].name=name;
const renamed=new Map(doc.nodes.map((node,index)=>[node.name,index]));
const missing=REQUIRED.filter(name=>!renamed.has(name));
if(missing.length)throw new Error(`The rename leaves the game without: ${missing.join(', ')}`);

// Lift the hips clear of the exporter's root bones so its track runs along the
// model's own axes. Composing the bones it passes leaves its rest pose exactly
// where it was; the bones it came from keep their own, and simply stop being
// anybody's parent.
const parents=new Map();
doc.nodes.forEach((node,index)=>{for(const child of node.children||[])parents.set(child,index);});
const bones=new Set((doc.skins||[]).flatMap(skin=>skin.joints));
const hips=renamed.get('Hips');
const lifted=[];
for(let above=parents.get(hips);bones.has(above);above=parents.get(above))lifted.push(above);
const frame=lifted.length?parents.get(lifted.at(-1)):parents.get(hips);
if(frame===undefined)throw new Error('The hips have no model frame to sit in.');
if(lifted.length){
  const matrix=new THREE.Matrix4();
  for(const index of lifted.slice().reverse())matrix.multiply(local(doc.nodes[index]));
  matrix.multiply(local(doc.nodes[hips]));
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  matrix.decompose(position,rotation,scale);
  const node=doc.nodes[hips];delete node.matrix;
  node.translation=position.toArray();node.rotation=rotation.toArray();node.scale=scale.toArray();
  const held=doc.nodes[parents.get(hips)];
  held.children=held.children.filter(child=>child!==hips);
  if(!held.children.length)delete held.children;
  (doc.nodes[frame].children??=[]).push(hips);
}

const result=joinGLB(doc,rest);
await writeFile(to,result);

// The point of the exercise is a rig that moved names and parents without
// moving a single vertex or joint, so both files are read back and compared.
const [before,after]=await Promise.all([readGLB(pathToFileURL(from)),readGLB(pathToFileURL(to))]);
for(const scene of [before.scene,after.scene])scene.updateMatrixWorld(true);
const pose=scene=>{const found=new Map();scene.traverse(o=>{if(o.isBone)found.set(o.name,o.matrixWorld.clone());});return found;};
const was=pose(before.scene),is=pose(after.scene);
for(const [authored,matrix] of was){
  const name=rename[authored]||authored;
  const drift=Math.max(...matrix.elements.map((value,i)=>Math.abs(value-is.get(name).elements[i])));
  if(drift>1e-6)throw new Error(`${authored} moved by ${drift} on its way to ${name}.`);
}
// The frame the hips now sit in has to be the model's own: turning it would put
// the pinned lateral axes and the driven vertical one somewhere else entirely,
// and a non-uniform scale would stretch the character by pose.
const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
after.scene.getObjectByName('Hips').parent.matrixWorld.decompose(position,rotation,scale);
const turned=THREE.MathUtils.radToDeg(2*Math.acos(Math.min(1,Math.abs(rotation.w))));
if(turned>1e-4)throw new Error(`The hips still sit in a frame turned ${turned.toFixed(3)}° away from the model's.`);
if(Math.abs(scale.x-scale.y)>1e-6||Math.abs(scale.y-scale.z)>1e-6)throw new Error(`The hips sit in a frame scaled unevenly: ${scale.toArray()}`);
const bounds=new THREE.Box3().setFromObject(after.scene,true);
console.log(`${dialect} rig: ${Object.keys(rename).length} joints renamed, hips lifted through ${lifted.length||'no'} root bone${lifted.length===1?'':'s'}.`);
console.log(`Rest pose unmoved to within a micrometre; ${(bounds.max.y-bounds.min.y).toFixed(4)} units tall over feet at ${bounds.min.y.toFixed(4)}.`);
console.log(`${supplied.length.toLocaleString()} → ${result.length.toLocaleString()} bytes; binary chunk ${createHash('sha256').update(rest).digest('hex').slice(0,12)} carried through unchanged.`);
