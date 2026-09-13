"""Offline preview of exported runtime spore meshes; approximates game lighting."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
folder=Path(sys.argv[sys.argv.index('--')+1]);out=Path(sys.argv[-1]);data=json.loads((folder/'scene.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
for i,item in enumerate(data['items']):
 bpy.ops.wm.ply_import(filepath=str(folder/item['file']));obj=bpy.context.object
 mat=bpy.data.materials.new('Runtime '+str(i));mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*item['color'],1);p.inputs['Roughness'].default_value=item['roughness']
 if item['bump']:
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(Path(__file__).resolve().parents[1]/'dist/assets/clay-height.png'),check_existing=True);tex.image.colorspace_settings.name='Non-Color';tex.extension='REPEAT'
  bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.5;bump.inputs['Distance'].default_value=item['bumpScale'];mat.node_tree.links.new(tex.outputs['Color'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 p.inputs['Emission Color'].default_value=(*item['emissive'],1);p.inputs['Emission Strength'].default_value=item['emissiveIntensity'];obj.data.materials.append(mat)
 for poly in obj.data.polygons:poly.use_smooth=True
c=data['camera'];target=Vector((c['x'],c['y'],0));bpy.ops.object.camera_add(location=(c['x'],c['y']+c['elevation'],c['z']));cam=bpy.context.object;direction=(target-cam.location).normalized();right=direction.cross(Vector((0,1,0))).normalized();up=right.cross(direction);cam.rotation_euler=Matrix((right,up,-direction)).transposed().to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=c['viewW'];scene.camera=cam
world=bpy.data.worlds.new('Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.76,.67,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
for loc,power,size in [((-2,6,6),650,5),((6,2,3),220,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out);bpy.ops.render.render(write_still=True)
