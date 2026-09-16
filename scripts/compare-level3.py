#!/usr/bin/env python3
"""Quantitative distance between a captured Ember Caverns frame and the target.

  python3 scripts/compare-level3.py RENDER.png TARGET.png

Prints JSON. Lower `distance` is closer. This is a coarse instrument for the
qualities the redesign asks for (layered depth, lighting hierarchy, warm/cool
pockets, clay detail); a human or model judge still decides, this only keeps
the judgement honest across rounds.
"""
import json,sys
import numpy as np
from PIL import Image
from skimage import color
from skimage.metrics import structural_similarity

W,H=416,234
def load(p):
    im=Image.open(p).convert('RGB').resize((W,H),Image.LANCZOS)
    a=np.asarray(im).astype(np.float32)/255
    a=a[int(H*.09):]  # drop the HUD strip
    return a
def lab(a):return color.rgb2lab(a)
def grid(L,rows=3,cols=4):
    h,w=L.shape;g=np.zeros((rows,cols))
    for r in range(rows):
        for c in range(cols):
            g[r,c]=L[r*h//rows:(r+1)*h//rows,c*w//cols:(c+1)*w//cols].mean()
    return g
def masks(lab_img):
    L,a,b=lab_img[...,0],lab_img[...,1],lab_img[...,2]
    chroma=np.hypot(a,b);hue=np.degrees(np.arctan2(b,a))%360
    warm=(chroma>25)&(hue>30)&(hue<95)&(L>45)       # mushroom / lamp glow
    cyan=(chroma>18)&(hue>180)&(hue<260)&(L>55)     # crystal glow
    deep=(L<22)                                    # dark silhouette
    haze=(L>=30)&(L<60)&(chroma<22)&(b<-5)         # blue-grey distance
    return {'warm':warm.mean(),'cyan':cyan.mean(),'deep':deep.mean(),'haze':haze.mean()}
def local_contrast(L):
    from scipy.ndimage import laplace
    return float(np.abs(laplace(L)).mean())
def hist(L,bins=16):
    h,_=np.histogram(L,bins=bins,range=(0,100));return h/h.sum()
def emd1d(p,q):
    return float(np.abs(np.cumsum(p)-np.cumsum(q)).sum()/len(p))

render,target=load(sys.argv[1]),load(sys.argv[2])
lr,lt=lab(render),lab(target)
Lr,Lt=lr[...,0],lt[...,0]
out={}
out['lumaMean']=[float(Lr.mean()),float(Lt.mean())]
out['lumaStd']=[float(Lr.std()),float(Lt.std())]
out['gridMAE']=float(np.abs(grid(Lr)-grid(Lt)).mean())
out['lumaEMD']=emd1d(hist(Lr),hist(Lt))
out['chromaMean']=[float(np.hypot(lr[...,1],lr[...,2]).mean()),float(np.hypot(lt[...,1],lt[...,2]).mean())]
mr,mt=masks(lr),masks(lt)
out['coverage']={k:[round(mr[k],4),round(mt[k],4)] for k in mr}
out['coverageGap']=float(sum(abs(mr[k]-mt[k]) for k in mr))
try:
    out['contrast']=[local_contrast(Lr),local_contrast(Lt)]
except Exception:
    out['contrast']=None
out['ssim']=float(structural_similarity(Lr,Lt,data_range=100))
# Vertical depth gradient: the target darkens toward the top-left vault and
# the lower fore rocks and lightens the mid band; compare row profiles.
rows_r,rows_t=Lr.mean(axis=1),Lt.mean(axis=1)
out['rowProfileMAE']=float(np.abs(rows_r-rows_t).mean())
d=(out['gridMAE']/12+out['lumaEMD']/4+out['coverageGap']/.12+(1-out['ssim'])/.5)
if out['contrast']:d+=abs(out['contrast'][0]-out['contrast'][1])/max(out['contrast'][1],1e-6)
out['distance']=round(float(d),4)
print(json.dumps(out,indent=1))
