"""Repack a supplied GLB's textures for mobile, preserving its sculpture.

Usage: python scripts/prepare-textures.py ORIGINAL_GLB SHIPPED_GLB [--max 1024]

The same method prepare-drifter.py and prepare-tent.py use, generalised so the
models that were never repacked can be brought down to the same budget:
every texture is capped at --max pixels square and re-encoded as 4:4:4 JPEG,
normal maps are renormalised after resampling, and geometry, rigs, animations
and UVs are copied through byte for byte. A manifest beside the shipped file
records both hashes so the repack can always be shown to be lossless in
everything except texture resolution.
"""
from pathlib import Path
from io import BytesIO
import hashlib, json, struct, sys
from PIL import Image
import numpy as np

QUALITY = {'normal': 94, 'baseColor': 92, 'other': 90}


def read_glb(data):
    if data[:4] != b'glTF':
        raise SystemExit('Not a binary glTF file.')
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), data[28 + size:]


def classify(doc):
    """Map each image index to the role it plays, so it can be encoded for it."""
    source = lambda holder: doc['textures'][holder['index']]['source']
    roles = {}
    for material in doc.get('materials', []):
        if material.get('alphaMode', 'OPAQUE') != 'OPAQUE':
            raise SystemExit(f"Material '{material.get('name')}' needs alpha; JPEG would drop it.")
        pbr = material.get('pbrMetallicRoughness', {})
        for role, holder in [('normal', material.get('normalTexture')),
                             ('baseColor', pbr.get('baseColorTexture')),
                             ('other', pbr.get('metallicRoughnessTexture')),
                             ('other', material.get('occlusionTexture')),
                             ('other', material.get('emissiveTexture'))]:
            # A normal map stays a normal map even if another slot also cites it.
            if holder and roles.get(source(holder)) != 'normal':
                roles[source(holder)] = role
    return roles


def repack(source_path, shipped_path, limit):
    data = Path(source_path).read_bytes()
    doc, binary = read_glb(data)
    roles = classify(doc)
    pad = lambda b, value=b'\0': b + value * ((-len(b)) % 4)

    replacements, sizes = {}, []
    for index, image in enumerate(doc.get('images', [])):
        view = doc['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        role = roles.get(index, 'other')
        picture = Image.open(BytesIO(binary[offset:offset + view['byteLength']])).convert('RGB')
        picture.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        if role == 'normal':
            vectors = np.asarray(picture, dtype=np.float32) / 127.5 - 1
            vectors /= np.maximum(np.linalg.norm(vectors, axis=2, keepdims=True), 1e-5)
            picture = Image.fromarray(np.uint8(np.clip((vectors + 1) * 127.5, 0, 255)))
        out = BytesIO()
        picture.save(out, format='JPEG', quality=QUALITY[role], subsampling=0, optimize=True)
        replacements[image['bufferView']] = out.getvalue()
        sizes.append({'role': role, 'size': list(picture.size)})
        image['mimeType'] = 'image/jpeg'

    chunks, offset, geometry = [], 0, hashlib.sha256()
    for index, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        chunk = replacements.get(index, binary[start:start + view['byteLength']])
        if index not in replacements:
            geometry.update(chunk)
        view['byteOffset'] = offset
        view['byteLength'] = len(chunk)
        chunks.append(pad(chunk))
        offset += len(chunks[-1])

    blob = b''.join(chunks)
    doc['buffers'][0]['byteLength'] = len(blob)
    header = pad(json.dumps(doc, separators=(',', ':')).encode(), b' ')
    result = (struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(blob))
              + struct.pack('<II', len(header), 0x4e4f534a) + header
              + struct.pack('<II', len(blob), 0x004e4942) + blob)

    triangles = sum(doc['accessors'][p['indices']]['count'] // 3 if 'indices' in p
                    else doc['accessors'][p['attributes']['POSITION']]['count'] // 3
                    for mesh in doc.get('meshes', []) for p in mesh['primitives'])
    manifest = {
        'source': Path(source_path).name,
        'sourceSha256': hashlib.sha256(data).hexdigest(),
        'shippedSha256': hashlib.sha256(result).hexdigest(),
        'sourceBytes': len(data), 'shippedBytes': len(result),
        'textures': sizes, 'textureLimit': limit,
        'geometryUnchanged': True, 'geometrySha256': geometry.hexdigest(),
        'animations': len(doc.get('animations', [])), 'triangles': triangles,
    }
    # A model that went through prepare-surface.py first leaves a note of what
    # was done to it; carry it, so the manifest still leads back to the file
    # the artist supplied.
    sidecar = Path(source_path).with_suffix('.surface.json')
    if sidecar.exists():
        manifest['surface'] = json.loads(sidecar.read_text())
    return result, manifest


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = dict(a.split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if len(args) != 2:
        raise SystemExit(__doc__)
    limit = int(flags.get('--max', 1024))
    result, manifest = repack(args[0], args[1], limit)

    # The geometry hash is taken from the original before anything is written,
    # so re-reading the shipped file is a genuine check, not a restatement.
    shipped = Path(args[1])
    shipped.write_bytes(result)
    doc, binary = read_glb(shipped.read_bytes())
    check = hashlib.sha256()
    images = {image['bufferView'] for image in doc.get('images', [])}
    for index, view in enumerate(doc['bufferViews']):
        if index not in images:
            start = view.get('byteOffset', 0)
            check.update(binary[start:start + view['byteLength']])
    assert check.hexdigest() == manifest['geometrySha256'], 'geometry changed during repack'

    shipped.with_suffix('.json').write_text(json.dumps(manifest, indent=2) + '\n')
    saved = manifest['sourceBytes'] - manifest['shippedBytes']
    print(f"{shipped.name}: {manifest['sourceBytes']:,} → {manifest['shippedBytes']:,} bytes "
          f"(−{saved / manifest['sourceBytes']:.0%}); {manifest['triangles']:,} triangles preserved")
