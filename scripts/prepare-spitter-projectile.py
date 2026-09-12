"""Blender: -b --python scripts/prepare-spitter-projectile.py -- SOURCE OUTPUT
Preserves supplied material textures; creates a screen-size projectile mesh.
"""
import sys
import bpy
source, output = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Projectile screen-size mesh', 'DECIMATE')
        modifier.ratio = .003
        bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB')
