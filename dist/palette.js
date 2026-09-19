import {Color,SRGBColorSpace} from './lib/three.module.js';

// Rich fired-clay orange, matched to the original cottage roof and claylings.
// Shade with the pigment itself so highlights keep its saturated character.
const orange=0xe64e1e;
export const CLAY_PALETTE=Object.freeze({
  orange,
  orangeLight:new Color(orange).multiplyScalar(1.10).getHex(),
  orangeDark:new Color(orange).multiplyScalar(.65).getHex()
});

export function applyUIPalette(element){
  for(const [name,value]of Object.entries(CLAY_PALETTE)){
    const token=name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
    element.style.setProperty('--clay-'+token,'#'+value.toString(16).padStart(6,'0'));
  }
  // Keep the title artwork's alpha silhouette and sculpted luminance while
  // bringing its orange into the same palette. Text is outside these filters.
  const rgb=new Color(orange).getRGB({},SRGBColorSpace);
  for(const [id,sourceLuminance]of [['clay-logo-pigment',.394],['clay-button-pigment',.414]]){
    const matrix=[rgb.r,rgb.g,rgb.b].flatMap(channel=>[
      .2126*channel/sourceLuminance,.7152*channel/sourceLuminance,.0722*channel/sourceLuminance,0,0
    ]).concat([0,0,0,1,0]);
    element.ownerDocument.getElementById(id)?.setAttribute('values',matrix.join(' '));
  }
}

// Match only orange pigment in selected imported albedo maps. Neutral faces,
// eyes, blue walls, foliage and golden collectibles retain their source colors.
// sourceValue is a reference sRGB red measured from the source orange and
// calibrated for its main surface. Relative brightness preserves baked detail.
// `pigment` is the clay the matched orange becomes: the palette's by default,
// or a distant rank's dustier clay when a backdrop asks for one.
export function orangeTextureShader(shader,sourceValue,pigment=orange){
  if(!sourceValue)return;
  shader.uniforms.clayOrange={value:new Color(pigment)};
  shader.uniforms.clayOrangeSource={value:sourceValue};
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 clayOrange;
uniform float clayOrangeSource;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
#ifdef USE_MAP
vec3 pigment = sRGBTransferOETF(vec4(diffuseColor.rgb, 1.0)).rgb;
float chroma = max(pigment.r, max(pigment.g, pigment.b)) - min(pigment.r, min(pigment.g, pigment.b));
float saturation = chroma / max(pigment.r, 0.0001);
float warmth = (pigment.g - pigment.b) / max(chroma, 0.0001);
float orangeMask = step(pigment.g, pigment.r) * step(pigment.b, pigment.g)
  * smoothstep(0.38, 0.58, saturation)
  * (1.0 - smoothstep(0.60, 0.76, warmth))
  * smoothstep(0.20, 0.45, pigment.r);
float pigmentShade = pow(max(pigment.r, 0.001) / clayOrangeSource, 2.2);
diffuseColor.rgb = mix(diffuseColor.rgb, clayOrange * pigmentShade, orangeMask);
#endif`);
}
