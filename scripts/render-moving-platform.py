"""Offline review of exported runtime geometry; lighting approximates the game."""
import bpy,json,sys,math
from mathutils import Vector
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];folder=Path(args[0]);data=json.loads((folder/'scene.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
for i,item in enumerate(data['items']):
 bpy.ops.wm.ply_import(filepath=str(folder/item['file']))
 obj=bpy.context.object
 mat=bpy.data.materials.new('Clay '+str(i));mat.diffuse_color=(*item['color'],1);mat.use_nodes=True
 nodes=mat.node_tree.nodes;p=nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*item['color'],1);p.inputs['Roughness'].default_value=item['roughness']
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=32;noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.75
 bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.025
 mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 obj.data.materials.append(mat)
 for poly in obj.data.polygons:poly.use_smooth=True
c=data['camera'];bpy.ops.object.camera_add(location=(c['x'],c['y']+c['elevation'],c['z']))
cam=bpy.context.object;cam.rotation_euler=(-math.atan2(c['elevation'],c['z']),0,0);cam.data.type='ORTHO';cam.data.ortho_scale=c['viewW'];scene.camera=cam
world=bpy.data.worlds.new('Cream studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.75,.67,1);world.node_tree.nodes['Background'].inputs[1].default_value=.8;scene.world=world
for loc,power,size in [((-3,8,9),1600,7),((7,3,6),700,6)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((2.9,1,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(args[1]).resolve())
bpy.ops.render.render(write_still=True)
