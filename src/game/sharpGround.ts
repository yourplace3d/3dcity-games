/**
 * Sharp edges for what is painted on the ground: parks, gardens, lawns, woods, water, paths.
 *
 * They are painted into one picture over the whole square (4096 px for 1.5 km on a computer,
 * 2048 px on a tablet or phone), so a pixel of it is 0.37 to 0.73 m. Seen from the street the
 * camera stretches each one over 20 to 30 pixels of the screen, and the edge of a park was a soft
 * smear beside the crisp streets and houses (the owner, after Kiel and Rio, 24 November).
 *
 * Painting more finely would cost memory the iPad does not have to spare. Instead, where the
 * stretched picture blends from one colour to another, the shader finds the colour on either side
 * (whole pixels of the picture a pixel and a half out) and cuts the blend down to about one pixel
 * of the screen, where it was half way. A straight edge stays where the map has it and a corner is
 * rounded by a fraction of a metre. Left as they were: a line about a pixel of the picture wide,
 * a spot where three colours meet within a pixel or two, faint shades, and everything when the
 * picture is not stretched (the look from high above).
 *
 * The cost: two more reads of the picture for each pixel of ground on the screen, and four more
 * at an edge. `?try=softground` in the link turns it off, to compare.
 */

import { Vector2, type MeshStandardMaterial } from 'three';

export function softGroundWanted(): boolean {
  try {
    return (new URLSearchParams(location.search).get('try') ?? '').split(',').includes('softground');
  } catch {
    return false;
  }
}

const SHARPEN = /* glsl */ `
uniform vec2 uTexel;
// The ground's colour, with a blend between two colours cut down to about one pixel of the screen.
vec3 sharpGround(sampler2D tex, vec2 uv, vec3 c) {
  // pixels of the picture under one pixel of the screen: from about one up, it is not stretched
  float foot = max(length(dFdx(uv) / uTexel), length(dFdy(uv) / uTexel));
  // which way the colour changes, and how much: none at all on most of the ground
  vec3 gu = textureLod(tex, uv + vec2(0.5 * uTexel.x, 0.0), 0.0).rgb - c;
  vec3 gv = textureLod(tex, uv + vec2(0.0, 0.5 * uTexel.y), 0.0).rgb - c;
  float a = dot(gu, gu);
  float b = dot(gu, gv);
  float d = dot(gv, gv);
  float edge = smoothstep(2e-4, 1e-3, a + d) * (1.0 - smoothstep(0.3, 0.8, foot));
  if (edge <= 0.0) return c;
  float th = 0.5 * atan(2.0 * b, a - d + 1e-7);
  vec2 n = vec2(cos(th), sin(th)) * 1.5 * uTexel;
  // the colours either side: whole pixels of the picture, clear of the blend at the edge (a blend
  // read there made the edge wavy)
  vec3 ca = textureLod(tex, (floor((uv - n) / uTexel) + 0.5) * uTexel, 0.0).rgb;
  vec3 cb = textureLod(tex, (floor((uv + n) / uTexel) + 0.5) * uTexel, 0.0).rgb;
  vec3 ab = cb - ca;
  float l2 = max(dot(ab, ab), 1e-6);
  // how far from one to the other, averaged a pixel of the picture along the edge either way: where
  // the picture was painted with few shades of blend (a browser that smooths with 4 samples), the
  // half-way line was wavy
  vec2 along = vec2(-n.y, n.x) / 1.5;
  vec3 m = (c + textureLod(tex, uv + along, 0.0).rgb + textureLod(tex, uv - along, 0.0).rgb) / 3.0;
  float t = clamp(dot(m - ca, ab) / l2, 0.0, 1.0);
  // the blend ran over about a pixel and a half of the picture; now over one of the screen
  float s = clamp((t - 0.5) / clamp(foot * 0.7, 1e-3, 1.0) + 0.5, 0.0, 1.0);
  // only where this pixel's own blend lies between the two colours found: where three meet, or a
  // narrow band made one of them a third colour, it is left as it was (else it showed nicks)
  float tc = clamp(dot(c - ca, ab) / l2, 0.0, 1.0);
  vec3 off = c - (ca + tc * ab);
  edge *= (1.0 - smoothstep(0.03, 0.1, dot(off, off) / l2)) * smoothstep(1e-3, 3e-3, l2);
  return c + edge * (s - tc) * ab;
}
`;

/** Patch the ground's material, on top of what it already does; `px` is the size of its picture. */
export function sharpenGround(mat: MeshStandardMaterial, px: number): void {
  const before = mat.onBeforeCompile;
  const key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => `${key}-sharp`;
  mat.onBeforeCompile = (shader, renderer) => {
    before.call(mat, shader, renderer);
    shader.uniforms.uTexel = { value: new Vector2(1 / px, 1 / px) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${SHARPEN}`)
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  sampledDiffuseColor.rgb = sharpGround( map, vMapUv, sampledDiffuseColor.rgb );
  diffuseColor *= sampledDiffuseColor;
#endif`,
      );
  };
}
