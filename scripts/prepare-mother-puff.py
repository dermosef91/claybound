"""Repack a supplied Mother Puff model's textures for mobile, preserving its sculpture.

Usage: python scripts/prepare-mother-puff.py PATH_TO_ORIGINAL_GLB NAME
NAME is one of the three body poses (idle|cast|friendly) or one of the four
blighted clearing sculptures (corrupt|semi)-(tree|mushroom).
Geometry, normals, UVs and the uploaded source file are never changed.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);pose=sys.argv[2]
assert pose in ('idle','cast','friendly','corrupt-tree','corrupt-mushroom','semi-tree','semi-mushroom')
data=source.read_bytes()
size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+size]);binary=data[28+size:]
normal_images={doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
replacements={};image_sizes=[]
for i,im in enumerate(doc['images']):
    view=doc['bufferViews'][im['bufferView']]
    old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    image=Image.open(BytesIO(old)).convert('RGB')
    image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    if i in normal_images:
        n=np.asarray(image,dtype=np.float32)/127.5-1
        n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-5)
        image=Image.fromarray(np.uint8(np.clip((n+1)*127.5,0,255)))
    out=BytesIO()
    image.save(out,format='JPEG',quality=94 if i in normal_images else 91,subsampling=0,optimize=True)
    replacements[im['bufferView']]=out.getvalue()
    image_sizes.append(list(image.size));im['mimeType']='image/jpeg'
chunks=[];offset=0;geometry_hash=hashlib.sha256()
for i,view in enumerate(doc['bufferViews']):
    chunk=replacements.get(i,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
    if i not in replacements:geometry_hash.update(chunk)
    view['byteOffset']=offset;view['byteLength']=len(chunk)
    chunks.append(pad(chunk));offset+=len(chunks[-1])
blob=b''.join(chunks);doc['buffers'][0]['byteLength']=len(blob)
header=pad(json.dumps(doc,separators=(',',':')).encode(),b' ')
result=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
manifest={'source':source.name,'sourceSha256':hashlib.sha256(data).hexdigest(),'shippedSha256':hashlib.sha256(result).hexdigest(),'sourceBytes':len(data),'shippedBytes':len(result),'textures':image_sizes,'geometryUnchanged':True,'geometrySha256':geometry_hash.hexdigest(),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])}
(root/f'dist/assets/mother-puff-{pose}.glb').write_bytes(result)
(root/f'dist/assets/mother-puff-{pose}.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Mother Puff: {len(data):,} → {len(result):,} bytes; geometry preserved')
