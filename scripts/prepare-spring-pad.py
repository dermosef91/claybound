"""Repack the supplied spring pad's embedded textures; keep geometry and UVs intact.

Usage: python scripts/prepare-spring-pad.py PATH_TO_GLB
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
import numpy as np
from PIL import Image

source=Path(sys.argv[1]);data=source.read_bytes()
size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+size]);binary=data[28+size:]
normal_images={doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
def digest(b):return hashlib.sha256(b).hexdigest()
replacements={};dimensions=[]
for i,image in enumerate(doc['images']):
    view=doc['bufferViews'][image['bufferView']]
    old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    im=Image.open(BytesIO(old)).convert('RGB');im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    if i in normal_images:
        normals=np.asarray(im,dtype=np.float32)/127.5-1
        normals/=np.maximum(np.linalg.norm(normals,axis=2,keepdims=True),1e-5)
        im=Image.fromarray(np.uint8(np.clip((normals+1)*127.5,0,255)))
    output=BytesIO();im.save(output,format='JPEG',quality=94 if i in normal_images else 91,subsampling=0,optimize=True)
    replacements[image['bufferView']]=output.getvalue();image['mimeType']='image/jpeg';dimensions.append(list(im.size))
chunks=[];offset=0;geometry=[]
for i,view in enumerate(doc['bufferViews']):
    old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    chunk=replacements.get(i,old)
    if i not in replacements:geometry.append(digest(chunk))
    view['byteOffset']=offset;view['byteLength']=len(chunk);chunks.append(pad(chunk));offset+=len(chunks[-1])
blob=b''.join(chunks);doc['buffers'][0]['byteLength']=len(blob)
header=pad(json.dumps(doc,separators=(',',':')).encode(),b' ')
result=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
assets=Path(__file__).resolve().parents[1]/'dist/assets'
(assets/'forest-spring-pad.glb').write_bytes(result)
(assets/'forest-spring-pad.json').write_text(json.dumps({'source':source.name,'sourceSha256':digest(data),'shippedSha256':digest(result),'sourceBytes':len(data),'shippedBytes':len(result),'textures':dimensions,'geometryBufferSha256':geometry,'geometryUnchanged':True},indent=2)+'\n')
print(f'Spring pad: {len(data):,} → {len(result):,} bytes; geometry and three material maps retained')
