"""Resize embedded forest textures for mobile without changing geometry/UVs.

Usage: python scripts/prepare-forest-assets.py UPLOAD_DIRECTORY
The source GLBs remain untouched. Only embedded JPEG payloads are repacked.
Sources absent from the given directory keep their existing manifest entry, so
a single new upload can be prepared without the others being re-encoded.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]
assets={
 'forest-hills.glb':'Meshy_AI_Mossy_Blossom_Hills_0909184629_texture.glb',
 'forest-grove.glb':'Meshy_AI_Floating_Clay_Grove_0909184637_texture.glb',
 'forest-falls.glb':'Meshy_AI_Skybridge_Falls_0909184644_texture.glb',
 'forest-waterfall.glb':'waterfall-background.glb'
}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
manifestPath=root/'dist/assets/forest-assets.json'
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
  out=BytesIO();image.save(out,format='JPEG',quality=94 if i in normal_images else 91,subsampling=0,optimize=True)
  replacements[im['bufferView']]=out.getvalue();image_sizes.append(list(image.size));im['mimeType']='image/jpeg'
 chunks=[];offset=0
 for i,view in enumerate(doc['bufferViews']):
  chunk=replacements.get(i,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
  view['byteOffset']=offset;view['byteLength']=len(chunk);chunks.append(pad(chunk));offset+=len(chunks[-1])
 blob=b''.join(chunks);doc['buffers'][0]['byteLength']=len(blob)
 header=pad(json.dumps(doc,separators=(',',':')).encode(),b' ')
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
 (root/'dist/assets'/shipped).write_bytes(result)
 manifest[shipped]={'source':source,'sourceSha256':hashlib.sha256(data).hexdigest(),'shippedSha256':hashlib.sha256(result).hexdigest(),'sourceBytes':len(data),'shippedBytes':len(result),'textures':image_sizes,'geometryUnchanged':True}
 print(shipped,f'{len(data):,} → {len(result):,} bytes; geometry preserved')
manifestPath.write_text(json.dumps(manifest,indent=2)+'\n')
