"""Combine the supplied bat rig with its matching PBR maps; preserve source files.
Usage: python scripts/prepare-bat.py ANIMATED_GLB TEXTURED_GLB
Requires NumPy and Pillow. No mesh simplification or animation resampling.
"""
import copy, hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image

def read(path):
    raw = Path(path).read_bytes()
    assert raw[:4] == b'glTF'
    n = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+n]), raw[28+n:], raw

def values(g, data, index):
    a = g['accessors'][index]; v = g['bufferViews'][a['bufferView']]
    dtype = {5121:'u1', 5123:'<u2', 5125:'<u4', 5126:'<f4'}[a['componentType']]
    width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT4':16}[a['type']]
    assert 'byteStride' not in v
    return np.frombuffer(data, dtype, a['count']*width, v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)

g, binary, rig_source = read(sys.argv[1])
t, texture_binary, texture_source = read(sys.argv[2])
primitive = g['meshes'][0]['primitives'][0]; textured = t['meshes'][0]['primitives'][0]
for name in ['POSITION','NORMAL','TEXCOORD_0']:
    assert np.array_equal(values(g,binary,primitive['attributes'][name]), values(t,texture_binary,textured['attributes'][name])), f'Mismatched {name}'
assert np.array_equal(values(g,binary,primitive['indices']),values(t,texture_binary,textured['indices']))
assert {a['name'] for a in g['animations']} == {'Fly','Hover','Swoop'}
assert len(g['skins'][0]['joints']) == 8

# Repack each buffer view, replacing the old color image instead of retaining
# another copy. Vertex/index/joint/weight/animation data remains byte-identical.
chunks = [binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']]
old_image_view = g['images'][0]['bufferView']
g['images'] = []; image_info = []
for i, source in enumerate(t['images']):
    v=t['bufferViews'][source['bufferView']]
    image=Image.open(io.BytesIO(texture_binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB')
    image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    buf=io.BytesIO(); image.save(buf,format='JPEG',quality=92,subsampling=0,optimize=True)
    payload=buf.getvalue()
    if i==0: index=old_image_view; chunks[index]=payload
    else: index=len(chunks); chunks.append(payload); g['bufferViews'].append({'buffer':0})
    g['images'].append({'bufferView':index,'mimeType':'image/jpeg','name':source.get('name',str(i))})
    image_info.append({'name':source.get('name',str(i)),'width':image.width,'height':image.height,'bytes':len(payload)})
g['textures']=copy.deepcopy(t['textures']); g['samplers']=copy.deepcopy(t.get('samplers',[]))
g['materials']=copy.deepcopy(t['materials'])
g['materials'][0]['name']='Blue clay bat'
g['materials'][0]['pbrMetallicRoughness']['metallicFactor']=0
g['materials'][0]['pbrMetallicRoughness']['roughnessFactor']=1
primitive['material']=0

# Keep the authored tangent basis for the transferred normal map.
tangents=values(t,texture_binary,textured['attributes']['TANGENT'])
view_index=len(chunks); chunks.append(tangents.tobytes()); g['bufferViews'].append({'buffer':0,'target':34962})
primitive['attributes']['TANGENT']=len(g['accessors'])
g['accessors'].append({'bufferView':view_index,'componentType':5126,'count':len(tangents),'type':'VEC4'})
packed=bytearray()
for view,payload in zip(g['bufferViews'],chunks):
    packed.extend(b'\0'*((-len(packed))%4)); view.update(buffer=0,byteOffset=len(packed),byteLength=len(payload)); packed.extend(payload)
packed.extend(b'\0'*((-len(packed))%4)); g['buffers']=[{'byteLength':len(packed)}]
g['asset']['generator']='Claybound: supplied rig + matching PBR texture maps'
encoded=json.dumps(g,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
destination=Path(__file__).resolve().parents[1]/'dist/assets'
(destination/'bat.glb').write_bytes(result)
sha=lambda raw: hashlib.sha256(raw).hexdigest()
info={'rigSource':Path(sys.argv[1]).name,'rigSourceSha256':sha(rig_source),'textureSource':Path(sys.argv[2]).name,'textureSourceSha256':sha(texture_source),'shippedSha256':sha(result),'bytes':len(result),'vertices':g['accessors'][primitive['attributes']['POSITION']]['count'],'triangles':g['accessors'][primitive['indices']]['count']//3,'bones':8,'clips':[a['name'] for a in g['animations']],'images':image_info,'preserved':['positions','normals','UVs','indices','joints','weights','inverse bind matrices','animation channels','authored tangents']}
(destination/'bat.json').write_text(json.dumps(info,indent=2)+'\n')
print(json.dumps(info,indent=2))
