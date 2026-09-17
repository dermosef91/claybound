"""Repack the supplied watching flower (The Soft Dream's Crooked Garden): shrink
its embedded colour map, keep geometry and UVs byte for byte.

Usage: python scripts/prepare-dream-flower.py PATH_TO_FLOWER_GLB

The source is a Tripo export: one node, one mesh, one material with a JPEG
albedo, normalised to 1 unit tall with its origin at the root blob. It ships
as dist/assets/dream-flower.glb; dist/dream-assets.js adds the pupil it lacks
and splits the head from the stem at load. The manifest beside it records the
source and shipped fingerprints, and tests/assets.mjs holds the shipped file
to the manifest.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys

from PIL import Image

source=Path(sys.argv[1]);data=source.read_bytes()
size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+size]);binary=data[28+size:]
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
def digest(b):return hashlib.sha256(b).hexdigest()
replacements={};dimensions=[]
for image in doc['images']:
    view=doc['bufferViews'][image['bufferView']]
    old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    im=Image.open(BytesIO(old)).convert('RGB');im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    output=BytesIO();im.save(output,format='JPEG',quality=91,subsampling=0,optimize=True)
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
(assets/'dream-flower.glb').write_bytes(result)
(assets/'dream-flower.json').write_text(json.dumps({'source':source.name,'sourceSha256':digest(data),'shippedSha256':digest(result),'sourceBytes':len(data),'shippedBytes':len(result),'textures':dimensions,'geometryBufferSha256':geometry,'geometryUnchanged':True},indent=2)+'\n')
print(f'Watching flower: {len(data):,} -> {len(result):,} bytes; geometry retained, colour map {dimensions}')
