import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { listPatterns, PATTERN_SRC } from './patterns.mjs';

const SRC = 'assets/images/source';
const BRAND = '#184421';
const PNG_WIDTHS = { mark: [256, 512], stacked: [512, 1024], 'stacked-fit': [512, 1024], horizontal: [1024, 2048] }; // others: 512, 1024

export const svgo = (svg) => optimize(svg, { multipass: true, plugins: ['preset-default'] }).data; // SVGO 4 keeps the viewBox by default
const sri = (buf) => 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');

/** A logo is recolourable when its only non-white colour is the brand green. */
export function isBrandMono(svg) {
  const colours = new Set([...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase()).filter((c) => !['none', 'white', '#fff', '#ffffff'].includes(c)));
  return colours.size === 1 && colours.has(BRAND);
}

export async function emitImages(tokens, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const entries = [];
  const write = async (rel, buf, meta) => {
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    const m = await sharp(buf).metadata();
    entries.push({ path: rel, ...meta, format: m.format, width: m.width, height: m.height, bytes: buf.length, sri: sri(buf) });
  };

  for (const brand of fs.readdirSync(`${SRC}/logos`).sort()) {
    for (const f of fs.readdirSync(`${SRC}/logos/${brand}`).sort()) {
      const layout = f.replace(/\.(svg|png)$/, '');
      const buf = fs.readFileSync(`${SRC}/logos/${brand}/${f}`);
      if (f.endsWith('.png')) { await write(`logos/${brand}/${f}`, buf, { kind: 'logo', brand, layout, variant: null, note: 'raster only, no SVG master' }); continue; }
      const svg = buf.toString('utf8');
      const variants = [['', svg]];
      if (isBrandMono(svg)) variants.push(['light', svg.replaceAll(BRAND, '#FFFFFF')], ['dark', svg.replaceAll(BRAND, tokens.system.dark)], ['currentcolor', svg.replaceAll(BRAND, 'currentColor')]);
      for (const [variant, source] of variants) {
        const name = variant ? `${layout}-${variant}` : layout;
        const out = Buffer.from(svgo(source));
        await write(`logos/${brand}/${name}.svg`, out, { kind: 'logo', brand, layout, variant: variant || null });
        if (variant === 'currentcolor') continue; // currentColor only means something inline; a PNG would be black
        for (const w of PNG_WIDTHS[layout] ?? [512, 1024]) {
          await write(`logos/${brand}/${name}@${w}.png`, await sharp(out).resize({ width: w }).png({ compressionLevel: 9 }).toBuffer(), { kind: 'logo', brand, layout, variant: variant || null });
        }
      }
    }
  }

  const patterns = listPatterns(tokens.patterns);
  for (const p of patterns) await write(`patterns/${p.name}.svg`, Buffer.from(svgo(fs.readFileSync(`${PATTERN_SRC}/${p.name}.svg`, 'utf8'))), { kind: 'pattern', name: p.name });
  fs.writeFileSync(path.join(outDir, 'patterns.css'), '/* background patterns: <div class="bg-pattern-grid"> */\n' + patterns.map((p) =>
    `.bg-pattern-${p.name}{background-image:url("patterns/${p.name}.svg") !important;${p.size ? `background-size:${p.size} !important;` : ''}background-repeat:${p.repeat} !important}`).join('\n') + '\n');

  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ files: entries }, null, 1) + '\n');
  return entries.length;
}
