"""Repack the Soft Dream's supplied models for shipping; geometry stays byte-identical.

Usage: python3 scripts/prepare-dream-assets.py UPLOAD_DIRECTORY
       (UPLOAD_DIRECTORY is normally "new assets/level-5-surreal-psychadelic")

The source GLBs are untouched. Only the embedded textures are repacked — thumbnailed
to 1024 and re-encoded as JPEG — while every geometry buffer view is copied across
unchanged. That matters here more than elsewhere: PLANET_ORBS in dist/dream-assets.js
was fitted on these vertices, so the manifest records each geometry buffer's digest
and the triangle count, and tests/dream-models.mjs checks the shipped file against
them. Sources absent from the given directory keep their existing manifest entry, so
a single new upload can be prepared without re-encoding the others.
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
 'dream-saucer-raspberry.glb':'colorful+clay+platform+2.glb'
}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
def digest(b):return hashlib.sha256(b).hexdigest()
manifestPath=root/'dist/assets/dream-assets.json'
manifest=json.loads(manifestPath.read_text()) if manifestPath.exists() else {}
for shipped,source in assets.items():
 if not (Path(sys.argv[1])/source).exists():
  print(shipped,'unchanged; source not in this upload');continue
 data=(Path(sys.argv[1])/source).read_bytes()
 size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:]
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
 manifest[shipped]={'source':source,'sourceSha256':digest(data),'shippedSha256':digest(result),'sourceBytes':len(data),'shippedBytes':len(result),'textures':image_sizes,'triangles':triangles,'geometryBufferSha256':geometry,'geometryUnchanged':True}
 print(shipped,f'{len(data):,} → {len(result):,} bytes; {triangles:,} triangles, geometry preserved')
manifestPath.write_text(json.dumps(manifest,indent=2)+'\n')
