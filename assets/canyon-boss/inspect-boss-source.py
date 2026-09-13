import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(root/'assets/canyon-boss/tripo-out/reference-7e9e7ebc/model.fbx'))
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 pts=[o.matrix_world@v.co for v in o.data.vertices]
 print(json.dumps({'name':o.name,'faces':len(o.data.polygons),'quads':sum(len(p.vertices)==4 for p in o.data.polygons),'vertices':len(pts),'min':[min(v[i] for v in pts) for i in range(3)],'max':[max(v[i] for v in pts) for i in range(3)],'materials':[m.name for m in o.data.materials]}))
 for i,m in enumerate(o.data.materials):
  ps=[p for p in o.data.polygons if p.material_index==i]
  print('material',i,m.name,'faces',len(ps),'nodes',[(n.type,n.image.name if n.type=='TEX_IMAGE' and n.image else '') for n in m.node_tree.nodes] if m.use_nodes else None)
 # Connected components expose a distinct display plinth without changing feet.
 adj=[[] for v in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();components=[]
 for i in range(len(pts)):
  if i in seen:continue
  todo=[i];seen.add(i);indices=[]
  while todo:
   j=todo.pop();indices.append(j)
   for k in adj[j]:
    if k not in seen:seen.add(k);todo.append(k)
  vs=[pts[j] for j in indices]
  components.append({'count':len(indices),'min':[min(v[c] for v in vs) for c in range(3)],'max':[max(v[c] for v in vs) for c in range(3)]})
 print('components',json.dumps(sorted(components,key=lambda c:-c['count'])[:25]))
