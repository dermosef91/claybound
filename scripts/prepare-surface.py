"""Give a supplied character's surface the finish the game's clay has.

Usage: python scripts/prepare-surface.py SUPPLIED_GLB PREPARED_GLB
           [--smooth-normals] [--drop=normal,roughness] [--soften-normal=F] [--grade=NAME]

prepare-textures.py repacks a model's textures and touches nothing else, which
is right for a model whose surface already reads as clay. Some do not, for
reasons that are in the file rather than in how it is lit:

  * Meshy exports split every vertex per face and hand each copy the face's
    own normal, so the mesh shades flat — every facet of a hand or a boot shows
    through the clay press. `--smooth-normals` welds the normals across
    vertices that share a position (area-weighted, tangents re-orthogonalised)
    while leaving the vertices split for their UVs; positions, indices, weights
    and bind matrices are untouched.
  * Their metallic-roughness map is a near-uniform 0.6 that three.js multiplies
    into the material's roughness, so a character asked to be .94 rough renders
    at .56 — plastic among clay. `--drop=roughness` removes that texture;
    `--drop=normal` removes the baked normal map (and the tangents that exist
    only to read it) where the clay relief is meant to be the only surface
    detail. Dropped images leave the file along with their buffer views.
  * `--soften-normal=F` keeps the baked normal map but flattens it toward the
    surface by 1-F: the sculpted folds a modeller meant survive, the fabric
    weave that reads as cloth on a clay figure sinks under the clay press.
  * `--grade=NAME` re-tints the colour texture by one of the named grades below,
    which exist so a character painted for a neutral viewer can join a palette
    of terracotta, cream and sage without repainting it.

Everything done here is recorded in the manifest prepare-textures.py writes
next, under `surface`, from a sidecar this script leaves beside PREPARED_GLB.
"""
from pathlib import Path
from io import BytesIO
import hashlib, json, struct, sys
from PIL import Image
import numpy as np


def rgb_to_hsv(rgb):
    """HSV with hue in degrees, over a whole image at once."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(-1)
    c = v - rgb.min(-1)
    s = np.where(v > 0, c / np.maximum(v, 1e-12), 0)
    safe = np.maximum(c, 1e-12)
    h = np.where(c == 0, 0,
        np.where(v == r, ((g - b) / safe) % 6,
        np.where(v == g, (b - r) / safe + 2, (r - g) / safe + 4))) * 60
    return np.stack([h % 360, s, v], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] / 60, hsv[..., 1], hsv[..., 2]
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    table = np.stack([np.stack([v, t, p], -1), np.stack([q, v, p], -1), np.stack([p, v, t], -1),
                      np.stack([p, q, v], -1), np.stack([t, p, v], -1), np.stack([v, p, q], -1)], 0)
    return np.take_along_axis(table, i[None, ..., None], 0)[0]

# A grade is a list of steps applied in order to the colour texture, in HSV.
# `where` selects pixels by hue band (degrees), saturation and value ranges;
# `hue` turns them (degrees), `sat` and `val` scale them; `lift` raises value
# by lift*(1-V)^2, which reaches deep into the darks and leaves the lights alone.
GRADES = {
    # The Raincoat explorer: a lemon coat pulled toward marigold, hair, pack and
    # boots lifted out of black into a warm chestnut, hands a touch less pale.
    'explorer': [
        {'where': {'hue': (32, 62), 'sat': (.7, 1), 'val': (.7, 1)}, 'hue': -5, 'sat': .88, 'val': .96},
        {'where': {'val': (0, .55)}, 'hue': 3, 'sat': 1.06, 'lift': .32},
        {'where': {'hue': (22, 38), 'sat': (.35, .68), 'val': (.82, 1)}, 'sat': 1.10, 'val': .94},
    ],
}

MAGIC, JSON_CHUNK, BIN_CHUNK = 0x46546c67, 0x4e4f534a, 0x004e4942
DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(data):
    if data[:4] != b'glTF':
        raise SystemExit('Not a binary glTF file.')
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), bytearray(data[28 + size:])


def write_glb(doc, binary):
    pad = lambda b, value=b'\0': b + value * ((-len(b)) % 4)
    body = pad(bytes(binary))
    doc['buffers'][0]['byteLength'] = len(body)
    header = pad(json.dumps(doc, separators=(',', ':')).encode(), b' ')
    return (struct.pack('<III', MAGIC, 2, 28 + len(header) + len(body))
            + struct.pack('<II', len(header), JSON_CHUNK) + header
            + struct.pack('<II', len(body), BIN_CHUNK) + body)


def accessor(doc, binary, index):
    """The accessor's values as an (count, width) array, and where they live."""
    acc = doc['accessors'][index]
    view = doc['bufferViews'][acc['bufferView']]
    dtype, width = np.dtype(DTYPES[acc['componentType']]), WIDTH[acc['type']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride') or dtype.itemsize * width
    if stride != dtype.itemsize * width:
        raise SystemExit('Interleaved vertex data is not handled here.')
    values = np.frombuffer(binary, dtype=dtype, count=acc['count'] * width, offset=offset).reshape(acc['count'], width)
    return values, offset


def smooth_normals(doc, binary):
    """Weld normals across vertices that share a position, in place."""
    welded = 0
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            attrs = prim['attributes']
            if 'NORMAL' not in attrs:
                continue
            positions, _ = accessor(doc, binary, attrs['POSITION'])
            normals, offset = accessor(doc, binary, attrs['NORMAL'])
            indices, _ = accessor(doc, binary, prim['indices'])
            tri = indices.reshape(-1, 3).astype(np.int64)
            pos = positions.astype(np.float64)
            # One id per distinct position, so the accumulation below sums every
            # face that touches a place in space, not just a vertex record.
            _, place = np.unique(np.round(pos, 5), axis=0, return_inverse=True)
            place = place.ravel()
            face = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])  # area-weighted
            summed = np.zeros((place.max() + 1, 3))
            for corner in range(3):
                np.add.at(summed, place[tri[:, corner]], face)
            length = np.linalg.norm(summed, axis=1, keepdims=True)
            smooth = np.where(length > 1e-12, summed / np.maximum(length, 1e-12), np.array([0, 1, 0]))[place]
            binary[offset:offset + normals.nbytes] = smooth.astype(np.float32).tobytes()
            if 'TANGENT' in attrs:
                tangents, toffset = accessor(doc, binary, attrs['TANGENT'])
                t = tangents.astype(np.float64)
                xyz = t[:, :3] - smooth * (t[:, :3] * smooth).sum(1, keepdims=True)
                xyz /= np.maximum(np.linalg.norm(xyz, axis=1, keepdims=True), 1e-12)
                t[:, :3] = xyz
                binary[toffset:toffset + tangents.nbytes] = t.astype(np.float32).tobytes()
            welded += len(pos) - summed.shape[0]
    return welded


def drop_slots(doc, slots):
    """Remove texture slots from every material, and the images they alone used."""
    keys = {'normal': [('normalTexture',)], 'roughness': [('pbrMetallicRoughness', 'metallicRoughnessTexture')],
            'occlusion': [('occlusionTexture',)], 'emissive': [('emissiveTexture',)]}
    dropped = []
    for slot in slots:
        if slot not in keys:
            raise SystemExit(f'Unknown texture slot {slot!r}; choose from {", ".join(keys)}.')
        for material in doc.get('materials', []):
            for path in keys[slot]:
                holder = material
                for key in path[:-1]:
                    holder = holder.get(key, {})
                if path[-1] in holder:
                    del holder[path[-1]]
                    dropped.append(slot)
    if 'normal' in slots:
        for mesh in doc.get('meshes', []):
            for prim in mesh['primitives']:
                prim['attributes'].pop('TANGENT', None)
    return dropped


def soften_normals(doc, binary, keep):
    """Blend every normal map toward flat, keeping `keep` of its tilt."""
    sources = {doc['textures'][m['normalTexture']['index']]['source'] for m in doc.get('materials', []) if 'normalTexture' in m}
    for index in sorted(sources):
        image = doc['images'][index]
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        picture = Image.open(BytesIO(bytes(binary[start:start + view['byteLength']]))).convert('RGB')
        n = np.asarray(picture, dtype=np.float64) / 127.5 - 1
        n[..., :2] *= keep
        n[..., 2] = np.sqrt(np.clip(1 - (n[..., :2] ** 2).sum(-1), 0, 1))
        encoded = BytesIO()
        Image.fromarray(np.uint8(np.clip(np.round((n + 1) * 127.5), 0, 255))).save(encoded, format='PNG', optimize=True)
        image['mimeType'] = 'image/png'
        image['_replacement'] = encoded.getvalue()


def grade_paint(doc, binary, steps):
    """Re-tint every colour texture by the grade's steps."""
    pbr_sources = {doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
                   for m in doc.get('materials', []) if 'baseColorTexture' in m.get('pbrMetallicRoughness', {})}
    for index in sorted(pbr_sources):
        image = doc['images'][index]
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        picture = Image.open(BytesIO(bytes(binary[start:start + view['byteLength']]))).convert('RGB')
        rgb = np.asarray(picture, dtype=np.float64) / 255
        hsv = rgb_to_hsv(rgb)
        for step in steps:
            where = step.get('where', {})
            mask = np.ones(hsv.shape[:2], bool)
            if 'hue' in where:
                lo, hi = where['hue']
                mask &= (hsv[..., 0] >= lo) & (hsv[..., 0] <= hi)
            if 'sat' in where:
                mask &= (hsv[..., 1] >= where['sat'][0]) & (hsv[..., 1] <= where['sat'][1])
            if 'val' in where:
                mask &= (hsv[..., 2] >= where['val'][0]) & (hsv[..., 2] <= where['val'][1])
            h, s, v = hsv[..., 0][mask], hsv[..., 1][mask], hsv[..., 2][mask]
            h = (h + step.get('hue', 0)) % 360
            s = np.clip(s * step.get('sat', 1), 0, 1)
            v = np.clip(v * step.get('val', 1), 0, 1)
            v = np.clip(v + step.get('lift', 0) * (1 - v) ** 2, 0, 1)
            hsv[..., 0][mask], hsv[..., 1][mask], hsv[..., 2][mask] = h, s, v
        out = hsv_to_rgb(hsv)
        encoded = BytesIO()
        Image.fromarray(np.uint8(np.round(out * 255))).save(encoded, format='PNG', optimize=True)
        image['mimeType'] = 'image/png'
        image['_replacement'] = encoded.getvalue()


def compact(doc, binary):
    """Rewrite the binary chunk with only the buffer views still referenced, in order."""
    used_images = set()
    for texture in doc.get('textures', []):
        used_images.add(texture['source'])
    referenced = set()
    for material in doc.get('materials', []):
        for holder in [material.get('normalTexture'), material.get('occlusionTexture'), material.get('emissiveTexture'),
                       material.get('pbrMetallicRoughness', {}).get('baseColorTexture'),
                       material.get('pbrMetallicRoughness', {}).get('metallicRoughnessTexture')]:
            if holder:
                referenced.add(holder['index'])
    # Textures nobody cites go, then images nobody's texture cites.
    texture_map = {}
    textures = []
    for i, texture in enumerate(doc.get('textures', [])):
        if i in referenced:
            texture_map[i] = len(textures)
            textures.append(texture)
    doc['textures'] = textures
    for material in doc.get('materials', []):
        for holder in [material.get('normalTexture'), material.get('occlusionTexture'), material.get('emissiveTexture'),
                       material.get('pbrMetallicRoughness', {}).get('baseColorTexture'),
                       material.get('pbrMetallicRoughness', {}).get('metallicRoughnessTexture')]:
            if holder:
                holder['index'] = texture_map[holder['index']]
    image_map, images = {}, []
    for i, image in enumerate(doc.get('images', [])):
        if any(t['source'] == i for t in textures):
            image_map[i] = len(images)
            images.append(image)
    doc['images'] = images
    for texture in textures:
        texture['source'] = image_map[texture['source']]
    # Accessors nobody's primitive cites (dropped tangents) go the same way.
    used_accessors = set()
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            used_accessors.update(prim['attributes'].values())
            if 'indices' in prim:
                used_accessors.add(prim['indices'])
            for target in prim.get('targets', []):
                used_accessors.update(target.values())
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            used_accessors.add(skin['inverseBindMatrices'])
    for animation in doc.get('animations', []):
        for sampler in animation['samplers']:
            used_accessors.update([sampler['input'], sampler['output']])
    accessor_map, accessors = {}, []
    for i, acc in enumerate(doc.get('accessors', [])):
        if i in used_accessors:
            accessor_map[i] = len(accessors)
            accessors.append(acc)
    doc['accessors'] = accessors
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            prim['attributes'] = {k: accessor_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = accessor_map[prim['indices']]
            if 'targets' in prim:
                prim['targets'] = [{k: accessor_map[v] for k, v in t.items()} for t in prim['targets']]
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
    for animation in doc.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'], sampler['output'] = accessor_map[sampler['input']], accessor_map[sampler['output']]
    # Now the buffer views: keep those an accessor or an image still cites.
    used_views = {acc['bufferView'] for acc in accessors} | {img['bufferView'] for img in images if 'bufferView' in img}
    view_map, views, chunks, offset = {}, [], [], 0
    pad = lambda b: b + b'\0' * ((-len(b)) % 4)
    replacements = {img['bufferView']: img.pop('_replacement') for img in doc.get('images', []) if '_replacement' in img}
    for i, view in enumerate(doc['bufferViews']):
        if i not in used_views:
            continue
        start = view.get('byteOffset', 0)
        chunk = replacements.get(i, bytes(binary[start:start + view['byteLength']]))
        view = dict(view, byteOffset=offset, byteLength=len(chunk))
        view_map[i] = len(views)
        views.append(view)
        chunks.append(pad(chunk))
        offset += len(chunks[-1])
    doc['bufferViews'] = views
    for acc in accessors:
        acc['bufferView'] = view_map[acc['bufferView']]
    for img in images:
        img['bufferView'] = view_map[img['bufferView']]
    return bytearray(b''.join(chunks))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a.split('=', 1)[0]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
    if len(args) != 2:
        raise SystemExit(__doc__)
    source, prepared = Path(args[0]), Path(args[1])
    data = source.read_bytes()
    doc, binary = read_glb(data)
    record = {'source': source.name, 'sourceSha256': hashlib.sha256(data).hexdigest()}

    if flags.get('--smooth-normals'):
        record['normalsWelded'] = smooth_normals(doc, binary)
    drops = [s for s in str(flags.get('--drop', '')).split(',') if s]
    if drops:
        record['dropped'] = drop_slots(doc, drops)
    if '--soften-normal' in flags:
        keep = float(flags['--soften-normal'])
        soften_normals(doc, binary, keep)
        record['normalMapKept'] = keep
    grade = flags.get('--grade')
    if grade:
        if grade not in GRADES:
            raise SystemExit(f'No grade named {grade!r}; known: {", ".join(GRADES)}.')
        grade_paint(doc, binary, GRADES[grade])
        record['grade'] = {'name': grade, 'steps': GRADES[grade]}

    binary = compact(doc, binary)
    result = write_glb(doc, binary)
    prepared.write_bytes(result)
    prepared.with_suffix('.surface.json').write_text(json.dumps(record, indent=2) + '\n')
    print(f"{prepared.name}: {len(data):,} → {len(result):,} bytes; "
          + ', '.join(f'{k} {v if not isinstance(v, dict) else v["name"]}' for k, v in record.items() if k not in ('source', 'sourceSha256')))
