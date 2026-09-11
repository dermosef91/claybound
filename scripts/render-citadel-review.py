"""Offline composition review of exported game meshes; not a WebGL screenshot.
Requires Mitsuba, NumPy and Pillow. Lighting is an approximation of Three.js.
"""
import json,sys,math,os
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
import mitsuba as mi
mi.set_variant('llvm_ad_rgb')
mi.set_log_level(mi.LogLevel.Warn)
folder=Path(sys.argv[1]);out=Path(sys.argv[2]);data=json.loads((folder/'scene.json').read_text());c=data['camera'];theme=data['theme']
root=Path(__file__).resolve().parents[1]
width=int(os.environ.get('REVIEW_RENDER_WIDTH','1003'));spp=int(os.environ.get('REVIEW_SPP','96'));height=round(width*c['viewH']/c['viewW'])
def save_png(image,path):
 buffer=BytesIO();image.save(buffer,format='PNG');payload=buffer.getvalue()
 assert payload[-8:]==b'IEND\xaeB`\x82'
 path=Path(path);temporary=path.with_suffix('.writing');temporary.write_bytes(payload);temporary.replace(path)

def srgb_to_linear(a):
 a=np.asarray(a);return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
def hex_rgb(h):return srgb_to_linear([(h>>16&255)/255,(h>>8&255)/255,(h&255)/255])
def aces(rgb):
 # Three.js uses the ACES fitted transform, including its 1/0.6 scale.
 a=np.array([[.59719,.35458,.04823],[.076,.90834,.01566],[.02840,.13383,.83777]])
 b=np.array([[1.60475,-.53108,-.07367],[-.10208,1.10813,-.00605],[-.00327,-.07276,1.07602]])
 rgb=np.einsum('...j,ij->...i',rgb*(1.08/.6),a)
 rgb=(rgb*(rgb+.0245786)-.000090537)/(rgb*(.983729*rgb+.4329510)+.238081)
 rgb=np.clip(np.einsum('...j,ij->...i',rgb,b),0,1)
 return np.where(rgb<=.0031308,rgb*12.92,1.055*rgb**(1/2.4)-.055)

to_world=mi.ScalarTransform4f().look_at(origin=[c['x'],c['y']+c['elevation'],c['z']],target=[c['x'],c['y'],0],up=[0,1,0]) @ mi.ScalarTransform4f().scale([c['viewW']/2,c['viewW']/2,1])
sensor={'type':'orthographic','to_world':to_world,'near_clip':.01,'far_clip':160,'film':{'type':'hdrfilm','width':width,'height':height,'pixel_format':'rgba','rfilter':{'type':'tent'}},'sampler':{'type':'independent','sample_count':spp}}
base={'type':'scene','integrator':{'type':'aov','aovs':'depth:depth','image':{'type':'direct','emitter_samples':4,'bsdf_samples':1}},'sensor':sensor,'sky':{'type':'constant','radiance':{'type':'rgb','value':(hex_rgb(theme['skyLight'])*theme['ambient']/math.pi).tolist()}},'sun':{'type':'directional','direction':[10,-18,-12],'irradiance':{'type':'rgb','value':(hex_rgb(theme['sun'])*theme['sunPower']).tolist()}}}
for i,light in enumerate(data.get('lights',[])):
 base['torch'+str(i)]={'type':'point','position':light['position'],'intensity':{'type':'rgb','value':(np.array(light['color'])*light['intensity']).tolist()}}
images=[]
for background in [True,False]:
 scene=dict(base)
 for i,item in enumerate(data['items']):
  if item['background']!=background:continue
  color=np.array(item['color']);fog=srgb_to_linear([int(data['fog'][i:i+2],16)/255 for i in [1,3,5]])
  f=0
  if background:
   near=data.get('fogNear',34);far=data.get('fogFar',104)
   f=np.clip((26-item['z']-near)/(far-near),0,1);f=f*f*(3-2*f)
   # Fog is composited after lighting using actual per-pixel depth below.
   color=np.clip(color,0,.99)
  reflectance={'type':'rgb','value':color.tolist()}
  if item['texture']:
   tex=srgb_to_linear(np.asarray(Image.open(folder/item['texture']).convert('RGB'))/255)*color

   tex=np.where(tex<=.0031308,tex*12.92,1.055*np.clip(tex,0,1)**(1/2.4)-.055)
   tinted=folder/('tinted-'+str(i)+'.png');save_png(Image.fromarray(np.uint8(np.clip(tex,0,1)*255)),tinted)
   reflectance={'type':'bitmap','filename':str(tinted),'filter_type':'bilinear','wrap_mode':'repeat'}
  bsdf={'type':'roughplastic','distribution':'ggx','alpha':.34 if item.get('clay') else .55,'diffuse_reflectance':reflectance,'specular_reflectance':{'type':'rgb','value':[.12,.12,.12]},'int_ior':1.45}
  if item.get('normalTexture'):
   bsdf={'type':'normalmap','normalmap':{'type':'bitmap','filename':str(folder/item['normalTexture']),'raw':True,'wrap_mode':'repeat'},'bsdf':bsdf}
  if item['bump']:
   bsdf={'type':'bumpmap','texture':{'type':'bitmap','filename':str(folder/'clay-height.png' if (folder/'clay-height.png').exists() else root/'dist/assets/clay-height.png'),'raw':True,'filter_type':'bilinear','wrap_mode':'repeat'},'scale':item['bumpScale'],'bsdf':bsdf}
  shape={'type':'ply','filename':str(folder/item['file']),'bsdf':{'type':'twosided','bsdf':bsdf}}
  emission=np.array(item.get('emissive',[0,0,0]))*item.get('emissiveIntensity',0)
  if np.max(emission)>0:
   if item.get('emissiveTexture'):
    pixels=srgb_to_linear(np.asarray(Image.open(folder/item['emissiveTexture']).convert('RGB'))/255)*emission
    emitted=folder/('emission-'+str(i)+'.exr');mi.Bitmap(pixels.astype(np.float32)).write(str(emitted))
    radiance={'type':'bitmap','filename':str(emitted),'raw':True}
   else: radiance={'type':'rgb','value':emission.tolist()}
   shape['emitter']={'type':'area','radiance':radiance}
  scene['mesh'+str(i)]=shape
 print('Rendering', 'background' if background else 'foreground',flush=True)
 loaded=mi.load_dict(scene);result=np.nan_to_num(np.array(mi.render(loaded,spp=spp,seed=42)),nan=0,posinf=10,neginf=0)
 # Keep emissive meshes visible without compositing the environment emitter
 # over the other layer. A separate geometry mask excludes only the sky.
 mask_scene=dict(scene);mask_scene['integrator']={'type':'path','max_depth':1,'hide_emitters':True}
 for key,value in scene.items():
  if key.startswith('mesh'):
   mask_scene[key]={k:v for k,v in value.items() if k!='emitter'}
 mask=np.array(mi.render(mi.load_dict(mask_scene),spp=8,seed=42))
 result[:,:,3]=mask[:,:,3];images.append(result)
 print('Rendered layer',flush=True)
sky=np.array([int(data['sky'][i:i+2],16)/255 for i in [1,3,5]])
bg,fg=images
depth=bg[:,:,4:5]/np.maximum(bg[:,:,3:4],1e-6)
near=data.get('fogNear',34);far=data.get('fogFar',104)
haze=np.clip((depth-near)/(far-near),0,1);haze=haze*haze*(3-2*haze)
fog_rgb=np.array([int(data['fog'][i:i+2],16)/255 for i in [1,3,5]])
back=np.clip((aces(bg[:,:,:3])*(1-haze)+fog_rgb*haze)*bg[:,:,3:4]+sky*(1-bg[:,:,3:4]),0,1)
back=np.asarray(Image.fromarray(np.uint8(back*255)).filter(ImageFilter.GaussianBlur(data.get('backgroundBlur',.9))))/255
front=aces(fg[:,:,:3]);final=front*fg[:,:,3:4]+back*(1-fg[:,:,3:4])
save_png(Image.fromarray(np.uint8(np.clip(final,0,1)*255)),out)
print(out,flush=True)
