"""Project the supplied ball's mesh and tangent normal detail to a periodic clay field.
No mirrored quadrants, atlas seams, cube imprint, or source pigment is reused.
Usage: python scripts/prepare-clay-ball.py INPUT.glb
"""
from pathlib import Path
import json,struct,hashlib,io,sys
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root/'dist/assets'
raw=Path(sys.argv[1]).read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);binary=raw[28+length:]
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];d=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]);return np.ndarray((a['count'],n),dtype=d,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',d.itemsize*n),d.itemsize)).copy()
def texture(i):
 im=g['images'][g['textures'][i]['source']];v=g['bufferViews'][im['bufferView']];k=v.get('byteOffset',0);return np.asarray(Image.open(io.BytesIO(binary[k:k+v['byteLength']])).convert('RGB'),dtype=np.float64)/255

def sample(im,uv):
 h,w=im.shape[:2];xy=np.clip(uv,0,1)*[w-1,h-1];i=xy.astype(int);f=xy-i;j=np.minimum(i+1,[w-1,h-1]);return ((im[i[:,1],i[:,0]]*(1-f[:,0,None])+im[i[:,1],j[:,0]]*f[:,0,None])*(1-f[:,1,None])+(im[j[:,1],i[:,0]]*(1-f[:,0,None])+im[j[:,1],j[:,0]]*f[:,0,None])*f[:,1,None])
def norm(v):return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-9)
def periodic(a):
 # Periodic-plus-smooth decomposition removes boundary discontinuities without
 # reflecting the art (which created the recognisable X-shaped repeats).
 b=np.zeros_like(a);b[0,:]=a[-1,:]-a[0,:];b[-1,:]=-b[0,:];b[:,0]+=a[:,-1]-a[:,0];b[:,-1]-=a[:,-1]-a[:,0]
 h,w=a.shape;y,x=np.mgrid[:h,:w];d=2*np.cos(2*np.pi*x/w)+2*np.cos(2*np.pi*y/h)-4;d[0,0]=1;s=np.fft.fft2(b)/d;s[0,0]=0
 return a-np.fft.ifft2(s).real
pr=g['meshes'][0]['primitives'][0];a=pr['attributes'];p=accessor(a['POSITION']);n=accessor(a['NORMAL']);uv=accessor(a['TEXCOORD_0']);tri=accessor(pr['indices']).reshape(-1,3);m=g['materials'][pr['material']];col=texture(m['pbrMetallicRoughness']['baseColorTexture']['index']);rough=texture(m['pbrMetallicRoughness']['metallicRoughnessTexture']['index']);nm=texture(m['normalTexture']['index'])
S=768;extent=1.14;low=-extent/2;zbuf=np.full((S,S),-np.inf);UV=np.zeros((S,S,2));N=np.zeros((S,S,3));T=N.copy();B=N.copy()
for f in tri:
 q=p[f];cross=np.cross(q[1]-q[0],q[2]-q[0])
 if cross[2]<=0 or q[:,2].max()<.35:continue
 xy=(q[:,:2]-low)/extent*(S-1);lo=np.maximum(np.floor(xy.min(0)).astype(int),0);hi=np.minimum(np.ceil(xy.max(0)).astype(int),S-1)
 if np.any(hi<lo):continue
 yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0,v1,v2=xy;den=(v1[1]-v2[1])*(v0[0]-v2[0])+(v2[0]-v1[0])*(v0[1]-v2[1])
 if abs(den)<1e-10:continue
 u=((v1[1]-v2[1])*(xx-v2[0])+(v2[0]-v1[0])*(yy-v2[1]))/den;v=((v2[1]-v0[1])*(xx-v2[0])+(v0[0]-v2[0])*(yy-v2[1]))/den;w=1-u-v;weights=np.stack([u,v,w],-1);z=weights@q[:,2];valid=(weights.min(-1)>=-1e-5)&(z>zbuf[yy,xx]);y=yy[valid];x=xx[valid];wt=weights[valid];zbuf[y,x]=z[valid];UV[y,x]=wt@uv[f];ns=norm(wt@n[f]);N[y,x]=ns
 du=uv[f[1]]-uv[f[0]];dv=uv[f[2]]-uv[f[0]];det=du[0]*dv[1]-du[1]*dv[0]
 t=(q[1]-q[0])*dv[1]-(q[2]-q[0])*du[1];t/=det if abs(det)>1e-9 else 1;t=norm(t-ns*np.sum(ns*t,axis=-1,keepdims=True));T[y,x]=t;B[y,x]=np.cross(ns,t)*np.sign(det)
missing=np.argwhere(~np.isfinite(zbuf))
assert len(missing)<=4, 'Projection must cover the selected patch'
# Subpixel raster rounding can leave a corner texel. Copy the adjacent sample.
for y,x in missing:
 ay=min(max(y,1),S-2);ax=min(max(x,1),S-2)
 for field in (zbuf,UV,N,T,B):field[y,x]=field[ay,ax]
assert np.isfinite(zbuf).all()
mapped=sample(nm,UV.reshape(-1,2)).reshape(S,S,3)*2-1;obj=norm(T*mapped[...,0:1]+B*mapped[...,1:2]+N*mapped[...,2:3])
# Subtract the smooth ball normal before integrating, avoiding its spherical bulge.
gx=-obj[...,0]/np.maximum(obj[...,2],.25)+N[...,0]/np.maximum(N[...,2],.25);gy=-obj[...,1]/np.maximum(obj[...,2],.25)+N[...,1]/np.maximum(N[...,2],.25)
kx=2*np.pi*np.fft.fftfreq(S,d=extent/S)[None,:];ky=2*np.pi*np.fft.fftfreq(S,d=extent/S)[:,None];den=kx*kx+ky*ky;den[0,0]=1
integrated=np.fft.ifft2((-1j*kx*np.fft.fft2(gx)-1j*ky*np.fft.fft2(gy))/den).real
# Remove only overall ball curvature; preserve small presses, cracks and prints.
yy,xx=np.mgrid[:S,:S];X=(xx/(S-1)-.5)*extent;Y=(yy/(S-1)-.5)*extent;terms=np.stack([np.ones_like(X),X,Y,X*X,Y*Y,X*Y,X**4,Y**4,X*X*Y*Y],-1);coef=np.linalg.lstsq(terms.reshape(-1,9)[::32],zbuf.ravel()[::32],rcond=None)[0];mesh=zbuf-terms@coef
h=periodic(integrated*.7+mesh*.2);H=np.fft.fft2(h);H*=np.exp(-den*.0000015)*(1-np.exp(-den*.0025));h=np.fft.ifft2(H).real
lo,hi=np.quantile(h,[.008,.992]);height=np.clip((h-lo)/(hi-lo)*.9+.05,0,1)
color=sample(col,UV.reshape(-1,2)).reshape(S,S,3)@np.array([.2126,.7152,.0722]);color=periodic(color);color=np.clip(.94+(color-np.mean(color))*.55,.83,.99)
roughness=sample(rough,UV.reshape(-1,2)).reshape(S,S,3)[...,1];roughness=np.clip(periodic(roughness),.72,1)
# A gentle wrap crossfade makes endpoint texels identical as well as continuous.
def close_edges(a,n=16):
 for axis in (0,1):
  q=np.moveaxis(a,axis,0);v=(q[:n]+q[-n:])/2;f=np.linspace(1,0,n)
  for i in range(n):
   mean=(q[i]+q[-1-i])/2;mix=f[i]*.65 if i else 1;q[i]=q[i]*(1-mix)+mean*mix;q[-1-i]=q[-1-i]*(1-mix)+mean*mix
 return a
height=close_edges(height);color=close_edges(color);roughness=close_edges(roughness)
Image.fromarray(np.uint8(np.stack([height,roughness,color],-1)*255)).save(out/'clay-detail.png')
Image.fromarray(np.uint8(height*255)).save(out/'clay-height.png')
Image.fromarray(np.uint8(color*255)).save(out/'clay-surface.jpg',quality=94)
Image.fromarray(np.uint8(roughness*255)).save(out/'clay-roughness.jpg',quality=94)
small=np.asarray(Image.fromarray(np.uint8(height*255)).resize((64,64),Image.Resampling.LANCZOS))/255
# Fine cracks belong in the shading map. Low-pass the silhouette field so tiny
# gradients cannot fold long, thin triangles in extruded architectural faces.
frequency=2*np.pi*np.fft.fftfreq(64);kernel=np.exp(-.5*3**2*(frequency[:,None]**2+frequency[None,:]**2))
small=np.fft.ifft2(np.fft.fft2(small)*kernel).real
profile={'sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceName':Path(sys.argv[1]).name,'sourceTriangles':len(tri),'sourceHasDepthMap':False,'sourceMaps':['baseColor','normal','metallicRoughness'],'bakedFrom':'clay ball: projected tangent normals and mesh residual, curvature removed; periodic field without mirrored quadrants','geometryFilter':'periodic Gaussian, sigma 3 of 64 samples; fine cracks retained in shading maps','size':64,'height':small.round(5).ravel().tolist(),'sourceRelief':float(hi-lo),'period':2.8,'textureSize':S,'version':3}
(out/'clay-profile.json').write_text(json.dumps(profile,separators=(',',':')))
print({k:v for k,v in profile.items() if k!='height'})
