"""Repack the Soft Dream's supplied models for shipping; geometry stays byte-identical, bar the hat.

Usage: python3 scripts/prepare-dream-assets.py UPLOAD_DIRECTORY [DECIMATED_HAT_GLB]
       (UPLOAD_DIRECTORY is normally "new assets/level-5-surreal-psychadelic")

The source GLBs are untouched. Only the embedded textures are repacked — thumbnailed
to 1024 and re-encoded as JPEG — while every geometry buffer view is copied across
unchanged. That matters here more than elsewhere: PLANET_ORBS in dist/dream-assets.js
was fitted on these vertices, so the manifest records each geometry buffer's digest
and the triangle count, and tests/dream-models.mjs checks the shipped file against
them. Sources absent from the given directory keep their existing manifest entry, so
a single new upload can be prepared without re-encoding the others.

The hat is the one exception. hat.glb arrives at 324,212 triangles — thirty times a
planet, and the parade stacks five of them — so it is decimated first with glTF
Transform and the result is passed as the second argument:

    npx @gltf-transform/cli weld hat.glb welded.glb
    npx @gltf-transform/cli simplify welded.glb decimated.glb --ratio 0.025 --error 0.01

which lands at about 8,100 triangles with the brim and crown profile held to a
hundredth. The manifest still hashes the upload as the source and records the
adaptation; without the second argument the hat is skipped rather than shipped at
full weight. Its metallic-roughness map is dropped as well: the roughness it paints
(about .47) would make it the one glossy prop in a matte clay world, and
clayMaterials sets the roughness every supplied model shares.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]
assets={
 'dream-planet-mint.glb':'colorful+clay+planet+3d+model.glb',
 'dream-planet-raspberry.glb':'colorful+planet+3d+model.glb',
 'dream-saucer-mint.glb':'colorful+clay+platform+1.glb',
 'dream-saucer-raspberry.glb':'colorful+clay+platform+2.glb',
 'dream-hat.glb':'hat.glb',
 'dream-sculpture.glb':'colorful+abstract+sculpture+3d+model.glb'
}
# Models shipped from a decimated copy rather than the upload's own geometry.
decimated={'dream-hat.glb':Path(sys.argv[2]) if len(sys.argv)>2 else None}
adaptation={'dream-hat.glb':'glTF Transform 4.4.1 weld + simplify ratio=.025 error=.01; metallic-roughness map dropped'}
# Models whose metallic-roughness map is left out of the shipped file.
matte={'dream-hat.glb'}
SLOTS=['baseColorTexture','metallicRoughnessTexture','normalTexture','occlusionTexture','emissiveTexture']
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
def digest(b):return hashlib.sha256(b).hexdigest()
def texture_refs(material):
 """Every texture slot on a material, with the dict that holds its index."""
 for slot in SLOTS:
  holder=material.get('pbrMetallicRoughness',{}) if slot in ['baseColorTexture','metallicRoughnessTexture'] else material
  if slot in holder:yield slot,holder
def drop_textures(doc,slot):
 """Remove `slot` from every material, then the textures, images and buffer views nothing references any more."""
 for m in doc['materials']:
  holder=m.get('pbrMetallicRoughness',{}) if slot in ['baseColorTexture','metallicRoughnessTexture'] else m
  holder.pop(slot,None)
 used_textures=sorted({h[s]['index'] for m in doc['materials'] for s,h in texture_refs(m)})
 used_images=sorted({doc['textures'][t]['source'] for t in used_textures})
 dropped_views={doc['images'][i]['bufferView'] for i in range(len(doc['images'])) if i not in used_images}
 kept_views=[i for i in range(len(doc['bufferViews'])) if i not in dropped_views]
 tmap={old:new for new,old in enumerate(used_textures)};imap={old:new for new,old in enumerate(used_images)};vmap={old:new for new,old in enumerate(kept_views)}
 for m in doc['materials']:
  for s,h in texture_refs(m):h[s]['index']=tmap[h[s]['index']]
 doc['textures']=[dict(doc['textures'][t],source=imap[doc['textures'][t]['source']]) for t in used_textures]
 doc['images']=[dict(doc['images'][i],bufferView=vmap[doc['images'][i]['bufferView']]) for i in used_images]
 doc['bufferViews']=[doc['bufferViews'][i] for i in kept_views]
 for a in doc['accessors']:
  if 'bufferView' in a:a['bufferView']=vmap[a['bufferView']]
manifestPath=root/'dist/assets/dream-assets.json'
manifest=json.loads(manifestPath.read_text()) if manifestPath.exists() else {}
for shipped,source in assets.items():
 if not (Path(sys.argv[1])/source).exists():
  print(shipped,'unchanged; source not in this upload');continue
 original=(Path(sys.argv[1])/source).read_bytes()
 if shipped in decimated:
  if not decimated[shipped]:
   print(shipped,'skipped; pass the decimated GLB as the second argument to ship it');continue
  data=decimated[shipped].read_bytes()
 else:data=original
 size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:]
 if shipped in matte:drop_textures(doc,'metallicRoughnessTexture')
 normal_images={doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
 replacements={};image_sizes=[]
 for i,im in enumerate(doc['images']):
  view=doc['bufferViews'][im['bufferView']];old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  image=Image.open(BytesIO(old)).convert('RGB');image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  if i in normal_images:
   n=np.asarray(image,dtype=np.float32)/127.5-1
   n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-5)
   image=Image.fromarray(np.uint8(np.clip((n+1)*127.5,0,255)))
  out=BytesIO();image.save(out,format='JPEG',quality=91,subsampling=0,optimize=True)
  replacements[im['bufferView']]=out.getvalue();image_sizes.append(list(image.size));im['mimeType']='image/jpeg'
 chunks=[];offset=0;geometry=[]
 for i,view in enumerate(doc['bufferViews']):
  old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  chunk=replacements.get(i,old)
  if i not in replacements:geometry.append(digest(chunk))
  view['byteOffset']=offset;view['byteLength']=len(chunk);chunks.append(pad(chunk));offset+=len(chunks[-1])
 blob=b''.join(chunks);doc['buffers'][0]['byteLength']=len(blob)
 header=pad(json.dumps(doc,separators=(',',':')).encode(),b' ')
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
 triangles=sum(doc['accessors'][p['indices']]['count']//3 if 'indices' in p else doc['accessors'][p['attributes']['POSITION']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
 (root/'dist/assets'/shipped).write_bytes(result)
 manifest[shipped]={'source':source,'sourceSha256':digest(original),'shippedSha256':digest(result),'sourceBytes':len(original),'shippedBytes':len(result),'textures':image_sizes,'triangles':triangles,'geometryBufferSha256':geometry,'geometryUnchanged':shipped not in decimated}
 if shipped in adaptation:manifest[shipped]['adaptation']=adaptation[shipped]
 print(shipped,f'{len(original):,} → {len(result):,} bytes; {triangles:,} triangles,','decimated' if shipped in decimated else 'geometry preserved')
manifestPath.write_text(json.dumps(manifest,indent=2)+'\n')
