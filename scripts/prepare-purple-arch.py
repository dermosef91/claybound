"""Repack the supplied purple canyon arch, preserving every geometry/UV buffer.

Usage: python3 scripts/prepare-purple-arch.py PATH_TO_SOURCE_GLB

Unlike the other canyon formations this one arrives with a 4096x4096
metallic-roughness map — 8.8 MB, half the upload, for a surface the chapter
renders as matte clay. `clayMaterials` forces metalness to 0 and overwrites
roughness, so the map cannot affect a single pixel; it is dropped the way the
parade hat's was, and its texture, image and buffer view go with it rather than
being left orphaned in the file. Colour and normal are kept: the clay relief
shader reads the normal, and `tests/scene-canyon.mjs` holds canyon formations to
carrying both maps.
"""
from pathlib import Path
from io import BytesIO
import hashlib, json, struct, sys
import numpy as np
from PIL import Image

source = Path(sys.argv[1])
data = source.read_bytes()
size = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + size])
binary = data[28 + size:]

def pad(b, value=b'\0'): return b + value * ((-len(b)) % 4)
def digest(b): return hashlib.sha256(b).hexdigest()

def texture_slots(material):
    pbr = material.get('pbrMetallicRoughness', {})
    for slot in (material.get('normalTexture'), material.get('emissiveTexture'),
                 material.get('occlusionTexture'), pbr.get('baseColorTexture')):
        if slot: yield slot

# Drop the metallic-roughness slot from every material first, so the textures
# and images it was the only user of fall out of the file with it.
for material in doc['materials']:
    material.get('pbrMetallicRoughness', {}).pop('metallicRoughnessTexture', None)

used_textures = sorted({slot['index'] for m in doc['materials'] for slot in texture_slots(m)})
textures = [doc['textures'][i] for i in used_textures]
texture_map = {old: new for new, old in enumerate(used_textures)}
used_images = sorted({t['source'] for t in textures})
image_map = {old: new for new, old in enumerate(used_images)}
dropped = [doc['images'][i].get('name', i) for i in range(len(doc['images'])) if i not in image_map]
images = [doc['images'][i] for i in used_images]
for t in textures: t['source'] = image_map[t['source']]
for m in doc['materials']:
    for slot in texture_slots(m): slot['index'] = texture_map[slot['index']]
doc['textures'], doc['images'] = textures, images

normal_images = {doc['textures'][m['normalTexture']['index']]['source']
                 for m in doc['materials'] if 'normalTexture' in m}

# Resample what is left. 1024 for both maps: this formation reads at z -16,
# behind the riverbed, where the upload's 2048 carried no visible detail.
replacements, dimensions = {}, []
for i, image in enumerate(doc['images']):
    view = doc['bufferViews'][image['bufferView']]
    old = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    im = Image.open(BytesIO(old)).convert('RGB')
    im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    if i in normal_images:
        normals = np.asarray(im, dtype=np.float32) / 127.5 - 1
        normals /= np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-5)
        im = Image.fromarray(np.uint8(np.clip((normals + 1) * 127.5, 0, 255)))
    output = BytesIO()
    im.save(output, format='JPEG', quality=94 if i in normal_images else 91, subsampling=0, optimize=True)
    replacements[image['bufferView']] = output.getvalue()
    image['mimeType'] = 'image/jpeg'
    dimensions.append(list(im.size))

# Rebuild the buffer views, leaving out the one the dropped map owned. Geometry
# is copied byte for byte, so the manifest can claim the upload's own mesh.
image_views = {im['bufferView'] for im in doc['images']}
accessor_views = {a['bufferView'] for a in doc['accessors'] if 'bufferView' in a}
kept = [i for i in range(len(doc['bufferViews'])) if i in image_views or i in accessor_views]
view_map = {old: new for new, old in enumerate(kept)}
chunks, geometry, views, offset = [], [], [], 0
for i in kept:
    view = doc['bufferViews'][i]
    old = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    chunk = replacements.get(i, old)
    if i not in replacements: geometry.append(digest(chunk))
    view['byteOffset'], view['byteLength'] = offset, len(chunk)
    views.append(view)
    chunks.append(pad(chunk))
    offset += len(chunks[-1])
doc['bufferViews'] = views
for accessor in doc['accessors']:
    if 'bufferView' in accessor: accessor['bufferView'] = view_map[accessor['bufferView']]
for image in doc['images']:
    image['bufferView'] = view_map[image['bufferView']]

blob = b''.join(chunks)
doc['buffers'][0]['byteLength'] = len(blob)
header = pad(json.dumps(doc, separators=(',', ':')).encode(), b' ')
result = struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(blob)) + struct.pack('<II', len(header), 0x4e4f534a) + header + struct.pack('<II', len(blob), 0x004e4942) + blob
assets = Path(__file__).resolve().parents[1] / 'dist/assets'
(assets / 'canyon-purple-arch.glb').write_bytes(result)
(assets / 'canyon-purple-arch.json').write_text(json.dumps({
    'source': source.name,
    'provenance': "User-supplied Meshy model: the purple arch standing behind the Sandwright's Pocket",
    'sourceSha256': digest(data), 'shippedSha256': digest(result),
    'sourceBytes': len(data), 'shippedBytes': len(result), 'textures': dimensions,
    'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives']),
    'geometryBufferSha256': geometry, 'geometryUnchanged': True,
    'adaptation': 'metallic-roughness map dropped (the clay material forces metalness 0 and its own roughness); colour and normal resampled to 1024 JPEG'
}, indent=2) + '\n')
print(f'Purple arch: {len(data):,} → {len(result):,} bytes; dropped {dropped}; kept {dimensions}')
