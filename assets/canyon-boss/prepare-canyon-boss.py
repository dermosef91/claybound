"""Build a rigid mechanical rig from the preserved Tripo quad source.

Run with Blender --background --python scripts/prepare-canyon-boss.py -- SOURCE.
The FBX source is never modified. The .blend retains quads; GLB triangulates
for the browser. Component masks and actual face counts are recorded for review.
"""
import bpy, bmesh, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT = ROOT / 'assets/canyon-boss/rigged'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
if SOURCE.suffix.lower() == '.fbx':
    bpy.ops.import_scene.fbx(filepath=str(SOURCE))
else:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert meshes, 'Source has no mesh'
# Bake import transforms before calculating a reproducible component layout.
for obj in meshes:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world.identity()
    # Tripo default forward is +X. Blender -Y becomes glTF +Z, facing the
    # gameplay camera; the crane consequently sits on the viewer's left.
    for v in obj.data.vertices:
        x,y,z=v.co
        v.co=(y,-x,z)
points = [v.co for o in meshes for v in o.data.vertices]
lo = Vector(tuple(min(v[i] for v in points) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in points) for i in range(3)))
source_extent = list(hi - lo)
height = hi.z - lo.z
assert height > 0
scale = 10.8 / height
center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for obj in meshes:
    for v in obj.data.vertices:
        v.co = (v.co - center) * scale
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes: obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'WanderingHearth_Sculpture'
W, D, H = (hi.x-lo.x)*scale, (hi.y-lo.y)*scale, 10.8
source_faces=len(mesh.data.polygons)
source_quads=sum(len(p.vertices)==4 for p in mesh.data.polygons)
# The generator included a thin grey presentation card beneath the feet.
# Remove only broad, connected, nearly horizontal surfaces near ground level;
# the small disconnected soles do not meet both width/depth thresholds.
bm=bmesh.new();bm.from_mesh(mesh.data);bm.normal_update()
candidates={f for f in bm.faces if abs(f.normal.z)>.965 and max(v.co.z for v in f.verts)<H*.065}
seen=set();floor_faces=[]
for f in candidates:
    if f in seen:continue
    todo=[f];seen.add(f);part=[]
    while todo:
        face=todo.pop();part.append(face)
        for e in face.edges:
            for other in e.link_faces:
                if other in candidates and other not in seen and face.normal.dot(other.normal)>.96:
                    seen.add(other);todo.append(other)
    vs=[v.co for face in part for v in face.verts]
    if max(v.x for v in vs)-min(v.x for v in vs)>W*.45 and max(v.y for v in vs)-min(v.y for v in vs)>D*.45:
        floor_faces.extend(part)
floor_count=len(floor_faces)
if floor_faces:bmesh.ops.delete(bm,geom=floor_faces,context='FACES')
bm.to_mesh(mesh.data);bm.free()

# Repack detailed source textures for the web; retain originals alongside FBX.
for image in bpy.data.images:
    if image.size[0] > 2048 or image.size[1] > 2048:
        factor = 2048 / max(image.size)
        image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
    if image.has_data: image.pack()
for material in bpy.data.materials:
    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = 0
                node.inputs['Roughness'].default_value = .88

armdata = bpy.data.armatures.new('WanderingHearth_MechanicalRig')
arm = bpy.data.objects.new('WanderingHearth_Rig', armdata)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
mesh.select_set(False); arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = armdata.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent: b.parent = armdata.edit_bones[parent]
    return b
bone('root', (0,0,0), (0,0,1))
bone('hull', (0,0,H*.36), (0,0,H*.65), 'root')
for suffix, sx, sy in [('fl',-1,-1),('fr',1,-1),('bl',-1,1),('br',1,1)]:
    bone('leg_'+suffix, (sx*W*.22,sy*D*.25,H*.33),
         (sx*W*.25,sy*D*.28,H*.1), 'hull')
bone('pulley', (-W*.28,0,H*.66), (-W*.42,0,H*.66), 'hull')
bone('counterweight', (-W*.42,0,H*.6), (-W*.42,0,H*.3), 'pulley')
bone('cockpit', (0,0,H*.7), (0,0,H*.9), 'hull')
bone('flag', (W*.27,0,H*.79), (W*.34,0,H*.96), 'cockpit')
bpy.ops.object.mode_set(mode='OBJECT')
groups = {b.name:mesh.vertex_groups.new(name=b.name) for b in armdata.bones}
counts = {name:0 for name in groups}
for v in mesh.data.vertices:
    x,y,z = v.co
    target = 'hull'
    if z < H*.335:
        target = 'leg_' + ('f' if y < 0 else 'b') + ('l' if x < 0 else 'r')
    if x < -W*.31 and H*.16 < z < H*.65:
        target = 'counterweight' if z < H*.57 else 'pulley'
    if z > H*.74:
        target = 'flag' if x > W*.2 and z > H*.82 else 'cockpit'
    # Small transition band at the hip prevents open seams while preserving
    # hard clay feet and wooden mechanisms below it.
    weight = 1.0
    if target.startswith('leg_') and z > H*.285:
        weight = max(.12, min(1, (H*.335-z)/(H*.05)))
        groups['hull'].add([v.index], 1-weight, 'REPLACE')
    groups[target].add([v.index], weight, 'REPLACE')
    counts[target] += 1
modifier = mesh.modifiers.new('Mechanical articulation', 'ARMATURE')
modifier.object = arm
mesh.parent = arm
for p in arm.pose.bones: p.rotation_mode='XYZ'

scene = bpy.context.scene
scene.render.fps = 30
def clear_pose():
    for b in arm.pose.bones:
        b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
def clip(name, frames, fn):
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions.new(name)
    for f in range(frames+1):
        clear_pose();fn(f/frames)
        for b in arm.pose.bones:
            b.keyframe_insert('location',frame=f+1,group=b.name)
            b.keyframe_insert('rotation_euler',frame=f+1,group=b.name)
    action=arm.animation_data.action
    track=arm.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.name=name;track.mute=True
    arm.animation_data.action=None
    return action
def idle(t):
    a=t*math.tau
    arm.pose.bones['hull'].location.y=math.sin(a)*.055
    arm.pose.bones['hull'].rotation_euler.y=math.sin(a)*.012
    for i,n in enumerate(['leg_fl','leg_fr','leg_bl','leg_br']):
        arm.pose.bones[n].rotation_euler.x=math.sin(a+(i%2)*math.pi)*.045
    arm.pose.bones['counterweight'].rotation_euler.x=math.sin(a)*.095
    arm.pose.bones['flag'].rotation_euler.y=math.sin(a)*.07
def stomp(t):
    lift=math.sin(min(1,t/.6)*math.pi/2) if t<.6 else max(0,1-(t-.6)/.12)
    arm.pose.bones['leg_fl'].rotation_euler.x=-lift*.58
    arm.pose.bones['leg_fl'].location.y=-lift*.65
    arm.pose.bones['hull'].rotation_euler.y=lift*.035
    arm.pose.bones['counterweight'].rotation_euler.x=math.sin(t*math.tau)*.13
def sweep(t):
    a=math.sin(t*math.pi)
    arm.pose.bones['leg_fr'].rotation_euler.z=-a*.65
    arm.pose.bones['leg_fr'].rotation_euler.x=-a*.25
    arm.pose.bones['counterweight'].rotation_euler.x=math.sin(t*math.tau)*.25
def defeated(t):
    a=t*t*(3-2*t)
    arm.pose.bones['hull'].location.y=-a*.65
    for n in ['leg_fl','leg_fr','leg_bl','leg_br']:
        arm.pose.bones[n].rotation_euler.x=(-1 if n.endswith('l') else 1)*a*.24
    arm.pose.bones['pulley'].rotation_euler.z=-a*.15
    arm.pose.bones['counterweight'].rotation_euler.x=a*.18
    arm.pose.bones['cockpit'].rotation_euler.y=math.sin(t*math.tau)*.025
actions=[clip('idle',90,idle),clip('stomp',60,stomp),clip('sweep',72,sweep),clip('defeated',75,defeated)]
clear_pose();scene.frame_set(1)
for track in arm.animation_data.nla_tracks:track.mute=False

report={
    'source':str(SOURCE.relative_to(ROOT)),
    'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'sourceExtents':source_extent,'sourceFaces':source_faces,
    'sourceQuads':source_quads,'removedDisplayBaseFaces':floor_count,
    'riggedFaces':len(mesh.data.polygons),'riggedQuads':sum(len(p.vertices)==4 for p in mesh.data.polygons),
    'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),
    'vertices':len(mesh.data.vertices),'dimensions':[W,H,D],
    'rig':'local rigid mechanical skin','bones':counts,
    'clips':[a.name for a in actions],
    'textureMaxSize':2048,
    'orientation':'Tripo +X rotated to glTF +Z',
    'topology':'quads preserved in .blend and source FBX; runtime GLB triangulated',
}
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'canyon-boss.blend'))
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'canyon-boss.glb'),
    export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='NLA_TRACKS',export_nla_strips=True,
    export_image_format='AUTO',export_yup=True)
report['outputBytes']=(OUT/'canyon-boss.glb').stat().st_size
report['outputSha256']=hashlib.sha256((OUT/'canyon-boss.glb').read_bytes()).hexdigest()
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
