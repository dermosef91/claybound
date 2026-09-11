"""Bake reusable clay surface data from the supplied mesh and tangent normal map.
This is geometric/material baking: the uploaded source GLB is kept unchanged.
"""
from pathlib import Path
import json,struct,hashlib,io,sys
import numpy as np
from PIL import Image,ImageFilter

root=Path(__file__).resolve().parents[1];out=root/'dist/assets'
source=Path(sys.argv[1]);raw=source.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+length]);binary=raw[28+length:]
def accessor(index):
 a=gltf['accessors'][index];v=gltf['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 dtype=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],n),dtype=dtype,buffer=binary,offset=offset,strides=(v.get('byteStride',dtype.itemsize*n),dtype.itemsize)).copy()
def texture(index):
 im=gltf['images'][gltf['textures'][index]['source']];v=gltf['bufferViews'][im['bufferView']];offset=v.get('byteOffset',0)
 return np.asarray(Image.open(io.BytesIO(binary[offset:offset+v['byteLength']])).convert('RGB'),dtype=np.float32)/255
def sample(image,uv):
 h,w=image.shape[:2];xy=np.clip(uv,0,1)*[w-1,h-1];i=xy.astype(int);f=xy-i;j=np.minimum(i+1,[w-1,h-1])
 return (image[i[:,1],i[:,0]]*(1-f[:,0,None])+image[i[:,1],j[:,0]]*f[:,0,None])*(1-f[:,1,None])+(image[j[:,1],i[:,0]]*(1-f[:,0,None])+image[j[:,1],j[:,0]]*f[:,0,None])*f[:,1,None]
def normalized(v):return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-8)
def mirror(a):return np.concatenate([np.concatenate([a,a[:,::-1]],axis=1),np.concatenate([a,a[:,::-1]],axis=1)[::-1]],axis=0)
def save_gray(path,array):Image.fromarray(np.uint8(np.clip(array,0,1)*255)).convert('RGB').save(out/path,quality=95)

primitive=gltf['meshes'][0]['primitives'][0];attrs=primitive['attributes'];p=accessor(attrs['POSITION']);n=accessor(attrs['NORMAL']);t=accessor(attrs['TANGENT']);uv=accessor(attrs['TEXCOORD_0']);tri=accessor(primitive['indices']).reshape(-1,3)
material=gltf['materials'][primitive['material']];color=texture(material['pbrMetallicRoughness']['baseColorTexture']['index']);rough=texture(material['pbrMetallicRoughness']['metallicRoughnessTexture']['index']);normal=texture(material['normalTexture']['index'])
# Remove the blue pigment, retaining the source's baked creases and shading.
luma=color@np.array([.2126,.7152,.0722]);neutral=np.clip(luma/np.quantile(luma,.92)*.94,.45,1)
save_gray('clay-atlas.jpg',neutral)
size=512;extent=np.array([1.42,1.20]);low=-extent/2;zbuffer=np.full((size,size),-np.inf);baked_uv=np.zeros((size,size,2));baked_n=np.zeros((size,size,3));baked_t=np.zeros((size,size,4))
for face in tri:
 points=p[face];cross=np.cross(points[1]-points[0],points[2]-points[0])
 if cross[2]<=0 or points[:,2].max()<.1:continue
 xy=(points[:,:2]-low)/extent*(size-1);lo=np.maximum(np.floor(xy.min(0)).astype(int),0);hi=np.minimum(np.ceil(xy.max(0)).astype(int),size-1)
 if np.any(hi<lo):continue
 yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
 if abs(den)<1e-9:continue
 u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=1-u-v;weights=np.stack([u,v,w],-1);z=weights@points[:,2]
 visible=(weights.min(-1)>=-1e-5)&(z>zbuffer[yy,xx]);y=yy[visible];x=xx[visible];q=weights[visible]
 zbuffer[y,x]=z[visible];baked_uv[y,x]=q@uv[face];baked_n[y,x]=q@n[face];baked_t[y,x]=q@t[face]
if not np.isfinite(zbuffer).all():raise RuntimeError('The selected source face does not cover the bake. Reduce the sampling extent.')
N=normalized(baked_n);T=normalized(baked_t[...,:3]);B=np.cross(N,T)*baked_t[...,3:4]
map_n=sample(normal,baked_uv.reshape(-1,2)).reshape(size,size,3)*2-1
obj_n=normalized(T*map_n[...,0:1]+B*map_n[...,1:2]+N*map_n[...,2:3])
# Integrate the authored normal gradients; combine fine cracks with actual mesh relief.
gx=-obj_n[...,0]/np.maximum(obj_n[...,2],.2);gy=-obj_n[...,1]/np.maximum(obj_n[...,2],.2)
kx=2*np.pi*np.fft.fftfreq(size,d=extent[0]/size)[None,:];ky=2*np.pi*np.fft.fftfreq(size,d=extent[1]/size)[:,None];den=kx*kx+ky*ky;den[0,0]=1
integrated=np.fft.ifft2((-1j*kx*np.fft.fft2(gx)-1j*ky*np.fft.fft2(gy))/den).real
# A Fourier low-pass keeps the measured, broad dents separate from fine normal detail.
lowpass=np.exp(-den*.0015);fine=integrated-np.fft.ifft2(np.fft.fft2(integrated)*lowpass).real
height=zbuffer-zbuffer.mean()+fine*.6;hmin,hmax=np.quantile(height,[.005,.995]);height=np.clip((height-hmin)/(hmax-hmin),0,1)
tile_height=mirror(height);tile_color=mirror(sample(neutral[...,None].repeat(3,axis=2),baked_uv.reshape(-1,2)).reshape(size,size,3));tile_rough=mirror(sample(rough,baked_uv.reshape(-1,2)).reshape(size,size,3)[...,1])
Image.fromarray(np.uint8(tile_color*255)).save(out/'clay-surface.jpg',quality=95)
save_gray('clay-roughness.jpg',tile_rough);save_gray('clay-height.png',tile_height)
# One linear-data texture supplies triplanar relief, roughness and neutral pigment.
# Blur subpixel triangle boundaries only; retain the measured broad dents/cracks.
detail=np.asarray(Image.fromarray(np.uint8(tile_height*255)).filter(ImageFilter.GaussianBlur(.7)))/255
Image.fromarray(np.uint8(np.stack([detail,tile_rough,tile_color[...,0]],-1)*255)).save(out/'clay-detail.png')
small=np.asarray(Image.fromarray(np.uint8(tile_height*255)).resize((64,64),Image.Resampling.BILINEAR))/255
data={'sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceTriangles':len(tri),'sourceHasDepthMap':False,'sourceMaps':['baseColor','normal','metallicRoughness'],'bakedFrom':'front mesh relief and integrated tangent normal gradients','size':64,'height':small.round(5).reshape(-1).tolist(),'sourceRelief':float(hmax-hmin),'period':4.8}
(out/'clay-profile.json').write_text(json.dumps(data,separators=(',',':')));(out/'clay-cube.glb').write_bytes(raw)
print(f'Baked source clay: {len(tri)} triangles, {hmax-hmin:.3f} source units of face relief; source GLB unchanged.')
