import fs from 'node:fs';
import path from 'node:path';
import inter from '@capsizecss/metrics/inter';
import arial from '@capsizecss/metrics/arial';

const PKG = 'node_modules/@fontsource-variable/inter';
// latin first: the browser only downloads the faces whose unicode-range it needs
const SUBSETS = [
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
];

/** Fallback face that makes Arial take Inter's space, so the swap to the web font does not shift the layout. */
function fallbackFace() {
  const adj = inter.xWidthAvg / inter.unitsPerEm / (arial.xWidthAvg / arial.unitsPerEm);
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  return `@font-face{font-family:"Inter Fallback";src:local("Arial"),local("Helvetica");size-adjust:${pct(adj)};ascent-override:${pct(inter.ascent / inter.unitsPerEm / adj)};descent-override:${pct(-inter.descent / inter.unitsPerEm / adj)};line-gap-override:0%}`;
}

/** @font-face rules. `prefix` is the relative path from the including stylesheet to the fonts/ directory. */
export function interFontFaces(prefix, family = 'Inter') {
  const faces = SUBSETS.map(([name, range]) =>
    `@font-face{font-family:"${family}";font-style:normal;font-weight:100 900;font-display:swap;src:url("${prefix}files/inter-${name}-wght-normal.woff2") format("woff2");unicode-range:${range}}`);
  return [...faces, fallbackFace()].join('\n') + '\n';
}

export function emitFonts(tokens, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'files'), { recursive: true });
  for (const [name] of SUBSETS) fs.copyFileSync(`${PKG}/files/inter-${name}-wght-normal.woff2`, path.join(outDir, 'files', `inter-${name}-wght-normal.woff2`));
  fs.copyFileSync(`${PKG}/LICENSE`, path.join(outDir, 'files', 'INTER-LICENSE.txt')); // the OFL requires the licence to travel with the font
  const stack = tokens.design['font-family'];
  fs.writeFileSync(path.join(outDir, 'inter.css'),
    `/* Inter (variable, wght 100-900), SIL OFL 1.1. latin + latin-ext, loaded only when a page needs them. */\n${interFontFaces('')}:root{--jjjei-font-sans:${stack}}\n`);
}
