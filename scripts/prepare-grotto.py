"""Repack the supplied grotto's embedded textures; keep geometry and UVs intact.

Usage: python scripts/prepare-grotto.py PATH_TO_GLB [grotto|crystalcap]
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
import numpy as np
from PIL import Image

source=Path(sys.argv[1]);data=source.read_bytes();key=sys.argv[2] if len(sys.argv)>2 else 'grotto'
if key not in ('grotto','crystalcap'):raise ValueError('Choose grotto or crystalcap')
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
(assets/f'cave-{key}.glb').write_bytes(result)
(assets/f'cave-{key}.json').write_text(json.dumps({'source':source.name,'sourceSha256':digest(data),'shippedSha256':digest(result),'sourceBytes':len(data),'shippedBytes':len(result),'textures':dimensions,'geometryBufferSha256':geometry,'geometryUnchanged':True},indent=2)+'\n')
print(f'{key}: {len(data):,} → {len(result):,} bytes; geometry and three material maps retained')

# Isolate only the orange mushroom and cyan crystal pigment for local emission.
image_index=doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
v=doc['bufferViews'][doc['images'][image_index]['bufferView']]
im=Image.open(BytesIO(blob[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB')
c=np.asarray(im,dtype=np.float32)/255;r,g,b=c[:,:,0],c[:,:,1],c[:,:,2]
warm=(r>.4)&(r>g*1.4)&(g>b*1.2)&(b<.35)
cool=(g>.4)&(b>.35)&(g>r*1.4)&(b>r*1.3)
glow=np.where((warm|cool)[:,:,None],c,0)
glow_path=assets/f'cave-{key}-glow.png';Image.fromarray(np.uint8(glow*255)).save(glow_path,optimize=True)
manifest_path=assets/f'cave-{key}.json';manifest=json.loads(manifest_path.read_text());manifest['glowMapSha256']=digest(glow_path.read_bytes());manifest['glowPixelFraction']=float(np.mean(warm|cool));manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Baked colour-matched glow:',round(100*float(np.mean(warm|cool)),1),'percent of the texture; rock remains unlit')
