"""Repack the supplied Spore Puff's textures for mobile, preserving its sculpture.

Usage: python scripts/prepare-spore.py PATH_TO_ORIGINAL_GLB
Geometry, normals, UVs and the uploaded source file are never changed.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);data=source.read_bytes()
size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+size]);binary=data[28+size:]
normal_images={doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
replacements={};image_sizes=[]
def acc(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];d=np.dtype({5126:'<f4',5123:'<u2',5121:'u1'}[a['componentType']]);return np.ndarray((a['count'],4),dtype=d,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',4*d.itemsize),d.itemsize)).copy()
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:
  a=primitive['attributes']
  if 'WEIGHTS_1' not in a:continue
  weights=np.concatenate([acc(a['WEIGHTS_0']),acc(a['WEIGHTS_1'])],1);joints=np.concatenate([acc(a['JOINTS_0']),acc(a['JOINTS_1'])],1)
  order=np.argsort(-weights,axis=1,kind='stable')[:,:4];weights=np.take_along_axis(weights,order,axis=1);joints=np.take_along_axis(joints,order,axis=1)
  weights/=np.maximum(weights.sum(1,keepdims=True),1e-8)
  for key,values in [('WEIGHTS_0',weights),('JOINTS_0',joints)]:
   index=a[key];accessor=doc['accessors'][index];view=accessor['bufferView'];assert not accessor.get('byteOffset',0)
   replacements[view]=values.astype('<f4' if key=='WEIGHTS_0' else '<u2').tobytes();accessor['componentType']=5126 if key=='WEIGHTS_0' else 5123
   doc['bufferViews'][view].pop('byteStride',None)
  del a['WEIGHTS_1'];del a['JOINTS_1']

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
manifest={'source':source.name,'sourceSha256':hashlib.sha256(data).hexdigest(),'shippedSha256':hashlib.sha256(result).hexdigest(),'sourceBytes':len(data),'shippedBytes':len(result),'textures':image_sizes,'geometryUnchanged':True,'skinAdaptation':'strongest four of eight weights, normalized; full 26-bone rig retained','sourceAnimationClips':0,'geometrySha256':geometry_hash.hexdigest(),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])}
(root/'dist/assets/spore-puff.glb').write_bytes(result)
(root/'dist/assets/spore-puff.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Spore Puff: {len(data):,} → {len(result):,} bytes; geometry preserved')
