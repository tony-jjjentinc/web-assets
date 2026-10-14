// The only colour maths in the project. Channels stay float until output, matching Sass mix().
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgbToHex = (c) =>
  '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
export const rgbString = (c) => c.map((v) => Math.round(v)).join(', ');

/** w% of a + (100-w)% of b, like Sass mix($a, $b, w) for opaque colours. */
export const mix = (a, b, w) => a.map((v, i) => (v * w) / 100 + (b[i] * (100 - w)) / 100);
export const tint = (c, w) => mix(WHITE, c, w); // Bootstrap tint-color
export const shade = (c, w) => mix(BLACK, c, w); // Bootstrap shade-color

const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const contrastRatio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Bootstrap color-contrast(): first of light, dark, white, black that reaches `min`, else the best. */
export function colorContrast(bg, { light, dark, min }) {
  const candidates = [light, dark, WHITE, BLACK];
  return candidates.find((f) => contrastRatio(bg, f) >= min) ?? candidates.reduce((a, b) => (contrastRatio(bg, b) > contrastRatio(bg, a) ? b : a));
}

/** Smallest shade weight (step 5) that reaches `min` against `bg`; falls back to `max`. */
export function accessibleShade(c, bg, min, { start = 0, max = 90, step = 5 } = {}) {
  for (let w = start; w <= max; w += step) if (contrastRatio(shade(c, w), bg) >= min) return { rgb: shade(c, w), weight: w };
  return { rgb: shade(c, max), weight: max };
}

export { WHITE, BLACK };
