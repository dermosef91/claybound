import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/canyon-boss/rigged/canyon-boss.blend'))
scene=bpy.context.scene
arm=bpy.data.objects['WanderingHearth_Rig']
for track in arm.animation_data.nla_tracks:track.mute=True
arm.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=20
scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
world=bpy.data.worlds.new('Boss studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.74,.85,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
def area(name,loc,power,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc
 obj.rotation_euler=(Vector((0,0,5))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(-9,-10,17),2400,9);area('Fill',(11,-4,10),1400,8);area('Rim',(2,9,16),2300,7)
data=bpy.data.cameras.new('Boss camera');camera=bpy.data.objects.new('Boss camera',data);scene.collection.objects.link(camera)
camera.location=(13,-30,14);camera.rotation_euler=(Vector((0,0,5.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=15.8;scene.camera=camera
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(root/'assets/canyon-boss/rigged/preview.png')
bpy.ops.render.render(write_still=True)
