"""Prepare the supplied Breathing Tree models and their mobile variants.

Usage: python scripts/prepare-breathing-tree.py UPLOAD_DIRECTORY SIMPLIFIED_CLAYCAP_GLB
The source GLBs remain untouched. Variants retain the original PBR detail.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct,sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]
assets={
 'forest-hero-mushroom.glb':'Meshy_AI_Claycap_Mushroom_0910095608_texture(1).glb',
 'forest-canopy.glb':'Meshy_AI_Clay_Canopy_0910095554_texture.glb',
 'forest-canopy-distant.glb':'Meshy_AI_Clay_Canopy_0910095548_texture(1).glb',
 'forest-mushroom.glb':'Meshy_AI_Spotted_Scarlet_Mushr_0910095602_texture(1).glb',
 'forest-bloom.glb':'Meshy_AI_Clay_Garden_Bloom_0910095541_texture(1).glb'
}
def pad(b,value=b'\0'):return b+value*((-len(b))%4)
manifest={}
for shipped,source in assets.items():
 original=(Path(sys.argv[1])/source).read_bytes()
 data=Path(sys.argv[2]).read_bytes() if shipped=='forest-hero-mushroom.glb' else original
 size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:]
 # The spotted source has a tall conical cap. Broaden its silhouette by
 # compressing the cap and lengthening/narrowing the stalk in the shipped copy.
 if shipped=='forest-mushroom.glb':
  binary=bytearray(binary)
  attrs=doc['meshes'][0]['primitives'][0]['attributes']
  def values(index):
   a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
   return np.ndarray((a['count'],3),dtype='<f4',buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4))
  p=values(attrs['POSITION']);n=values(attrs['NORMAL']);oldy=p[:,1].copy();cut=-.28
  vertical=np.where(oldy<cut,1.4,.46)
  radial=.68+.32*np.clip((oldy+.4)/.23,0,1)
  derivative=np.where((oldy>-.4)&(oldy<-.17),.32/.23,0)
  oldx=p[:,0].copy();oldz=p[:,2].copy()
  p[:,0]*=radial;p[:,2]*=radial;p[:,1]=cut+(oldy-cut)*vertical
  n[:,1]=(n[:,1]-(n[:,0]*oldx+n[:,2]*oldz)*derivative/radial)/vertical
  n[:,0]/=radial;n[:,2]/=radial;n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-6)
  # Recompute the tangent basis at load time after the deliberate deformation.
  attrs.pop('TANGENT',None)
  a=doc['accessors'][attrs['POSITION']];a['min']=p.min(axis=0).tolist();a['max']=p.max(axis=0).tolist()
 normal_images={doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
 color_images={doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in doc['materials']}
 replacements={};image_sizes=[]
 for i,im in enumerate(doc['images']):
  view=doc['bufferViews'][im['bufferView']];old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  image=Image.open(BytesIO(old)).convert('RGB');image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  if i in normal_images:
   n=np.asarray(image,dtype=np.float32)/127.5-1
   n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-5)
   image=Image.fromarray(np.uint8(np.clip((n+1)*127.5,0,255)))
  if shipped in ['forest-mushroom.glb','forest-hero-mushroom.glb'] and i in color_images:
   hsv=np.array(image.convert('HSV'));mask=((hsv[:,:,0]<25)|(hsv[:,:,0]>238))&(hsv[:,:,1]>90)
   hue=hsv[:,:,0].astype(float);hsv[:,:,0][mask]=np.clip(12+(np.minimum(hue[mask],255-hue[mask])-4)*.3,8,18)
   hsv[:,:,1][mask]=np.clip(hsv[:,:,1][mask]*.8,0,255)
   hsv[:,:,2][mask]=np.clip(hsv[:,:,2][mask]*1.05+8,0,255)
   image=Image.fromarray(hsv,mode='HSV').convert('RGB')
   if shipped=='forest-hero-mushroom.glb':
    # Press the cream pigment into the existing UV surface. Separate spot
    # meshes create small floating shadows; a pigment bake keeps one surface.
    def read_acc(index):
     a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];dim={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
     return np.ndarray((a['count'],dim),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dtype).itemsize*dim),np.dtype(dtype).itemsize))
    primitive=doc['meshes'][0]['primitives'][0];attrs=primitive['attributes']
    pos=read_acc(attrs['POSITION']);normal=read_acc(attrs['NORMAL']);uv=read_acc(attrs['TEXCOORD_0']);faces=read_acc(primitive['indices']).reshape(-1,3)
    low=pos.min(axis=0);high=pos.max(axis=0);center=(low+high)*.5;span=high-low
    spots=[(center[0]+fx*span[0],center[2]+fz*span[2],r) for fx,fz,r in [(-.3,.18,.11),(.03,.29,.14),(.27,.13,.1),(-.1,-.04,.09),(.26,-.16,.06),(-.28,-.18,.085),(.04,-.31,.07)]]
    pixels=np.array(image);h,w=pixels.shape[:2];mask=np.zeros((h,w),bool)
    for f in faces:
     p=pos[f]
     if p[:,1].max()<.15 or normal[f,1].mean()<.15:continue
     tuv=uv[f]*[w,h];lo=np.maximum(np.floor(tuv.min(axis=0)).astype(int),0);hi=np.minimum(np.ceil(tuv.max(axis=0)).astype(int),[w-1,h-1])
     if np.any(hi<lo):continue
     yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];a=tuv[0];b=tuv[1]-a;c=tuv[2]-a;det=b[0]*c[1]-b[1]*c[0]
     if abs(det)<1e-8:continue
     dx=xx+.5-a[0];dy=yy+.5-a[1];u=(dx*c[1]-dy*c[0])/det;v=(b[0]*dy-b[1]*dx)/det
     inside=(u>=-.015)&(v>=-.015)&(u+v<=1.015);xyz=p[0]+u[...,None]*(p[1]-p[0])+v[...,None]*(p[2]-p[0])
     on=np.zeros(inside.shape,bool)
     for x,z,r in spots:
      angle=np.arctan2((xyz[:,:,2]-z)/.85,xyz[:,:,0]-x);radius=r*(1+.045*np.sin(angle*3))
      on|=((xyz[:,:,0]-x)**2+((xyz[:,:,2]-z)/.85)**2<radius**2)&(xyz[:,:,1]>.15)
     mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=inside&on
    pixels[mask]=[246,219,165]
    # The supplied stem is beige; lift it slightly into the reference's cream.
    pale=(pixels.max(axis=2)-pixels.min(axis=2)<75)&(~mask)
    pixels[pale]=np.clip(pixels[pale].astype(float)*1.06+5,0,255)
    image=Image.fromarray(pixels)
  out=BytesIO();image.save(out,format='JPEG',quality=94 if i in normal_images else 91,subsampling=0,optimize=True)
  replacements[im['bufferView']]=out.getvalue();image_sizes.append(list(image.size));im['mimeType']='image/jpeg'
 chunks=[];offset=0
 for i,view in enumerate(doc['bufferViews']):
  chunk=replacements.get(i,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
  view['byteOffset']=offset;view['byteLength']=len(chunk);chunks.append(pad(chunk));offset+=len(chunks[-1])
 blob=b''.join(chunks);doc['buffers'][0]['byteLength']=len(blob)
 header=pad(json.dumps(doc,separators=(',',':')).encode(),b' ')
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
 (root/'dist/assets'/shipped).write_bytes(result)
 manifest[shipped]={'source':source,'sourceSha256':hashlib.sha256(original).hexdigest(),'shippedSha256':hashlib.sha256(result).hexdigest(),'sourceBytes':len(original),'shippedBytes':len(result),'textures':image_sizes,'geometryUnchanged':shipped not in ['forest-mushroom.glb','forest-hero-mushroom.glb'],'topologyUnchanged':shipped!='forest-hero-mushroom.glb','triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'adaptation':'compressed cap, longer stalk, warm scarlet pigment' if shipped=='forest-mushroom.glb' else 'glTF Transform 4.5.0 simplify ratio=.01 error=.001; warm scarlet cap, cream stem, UV-baked cream spots' if shipped=='forest-hero-mushroom.glb' else None}
 print(shipped,f'{len(data):,} → {len(result):,} bytes; prepared mobile asset')
(root/'dist/assets/breathing-tree-assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
