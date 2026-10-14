import fs from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';
import { listPatterns } from './patterns.mjs';
import { interFontFaces } from './emit-fonts.mjs';

const STOCK = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark']; // colours Bootstrap itself ships

const q = (s) => `"${s.replace(/"/g, '\\"')}"`;

/** Compile a src/scss entry with the colour names and design tokens of this build prepended. Returns minified CSS. */
export function compileScss(entry, { system, status, design, patterns, loaders }, logger) {
  const names = ['primary', ...Object.keys(system), ...Object.keys(status).map((n) => `status-${n}`)];
  const std = names.filter((n) => STOCK.includes(n));
  const custom = names.filter((n) => !STOCK.includes(n));
  const noise = design['enable-gradient-noise']
    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${design['gradient-noise-opacity']}'/%3E%3C/svg%3E")`
    : 'null';
  // both bootstrap/ and tailwind/ sit one level below dist/, so the pattern artwork is always ../images/patterns/
  const pat = listPatterns(patterns).map((p) => `(name: ${q(p.name)}, url: ${q(`../images/patterns/${p.name}.svg`)}${p.size ? `, size: ${q(p.size)}` : ''}, repeat: ${p.repeat})`).join(', ');
  const lv = loaders.variants;
  const loader = (v) => `(${Object.entries(v).filter(([k]) => k !== 'style').map(([k, x]) => `${k}: ${x}`).join(', ')})`;
  const prelude = `
$std: (${std.join(', ')});
$custom: (${custom.join(', ')});
$all: (${names.join(', ')});
$noise: ${noise};
$shadows: ${design['enable-shadows']};
$radius: ${design['border-radius']};
$font: ${design['font-family']};
$patterns: (${pat});
$loaders: (ring: ${loader(lv.ring)}, pulse: ${loader(lv.pulse)}, dots: ${loader(lv.dots)});
$override-spinner: ${design['override-bootstrap-spinner']};
`;
  const file = path.resolve('src/scss', entry);
  return sass.compileString(prelude + fs.readFileSync(file, 'utf8'), { style: 'compressed', logger, url: new URL(`file://${file}`) }).css;
}

export const compileCore = (tokens, logger) => compileScss('core.scss', tokens, logger);

/** dist/bootstrap/core.css plus one single-link bundle per group (colour tokens + core). */
export function emitBootstrap(tokens, colorsDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const core = interFontFaces('../fonts/') + compileCore(tokens); // the font-face is part of the cached core file
  fs.writeFileSync(path.join(outDir, 'core.css'), core);
  for (const slug of Object.keys(tokens.groups)) fs.writeFileSync(path.join(outDir, `${slug}.css`), fs.readFileSync(path.join(colorsDir, `${slug}.css`), 'utf8') + core);
  return { bytes: core.length };
}
