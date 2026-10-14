import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { validateAll } from '../src/build/validate.mjs';
import { emitColors } from '../src/build/emit-colors.mjs';
import { emitFonts } from '../src/build/emit-fonts.mjs';
import { emitImages, svgo, isBrandMono } from '../src/build/emit-images.mjs';
import { emitBootstrap } from '../src/build/emit-bootstrap.mjs';
import { emitTailwind } from '../src/build/emit-tailwind.mjs';
import { listPatterns } from '../src/build/patterns.mjs';
import { emitManifest } from '../src/build/emit-manifest.mjs';

const { tokens, colors } = validateAll();
const D = 'build/test-dist';
const read = (f) => fs.readFileSync(`${D}/${f}`, 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
let index;

beforeAll(async () => {
  fs.rmSync(D, { recursive: true, force: true });
  emitColors(tokens, colors, `${D}/colors`);
  emitFonts(tokens, `${D}/fonts`);
  await emitImages(tokens, `${D}/images`);
  emitBootstrap(tokens, `${D}/colors`, `${D}/bootstrap`);
  emitTailwind(tokens, `${D}/tailwind`);
  index = JSON.parse(read('images/index.json')).files;
  emitManifest(tokens, D, { version: '2.0.0-rc.1', slug: 'o/r' });
}, 180000);

describe('fonts', () => {
  it('ships variable Inter as real woff2 files with the licence', () => {
    for (const f of ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2']) expect(fs.readFileSync(`${D}/fonts/files/${f}`).subarray(0, 4).toString()).toBe('wOF2');
    expect(read('fonts/files/INTER-LICENSE.txt')).toMatch(/SIL OPEN FONT LICENSE/i);
  });
  it('declares the full weight range, swap, subsets and a metric-matched fallback', () => {
    const css = read('fonts/inter.css');
    expect(css.match(/font-weight:100 900/g)).toHaveLength(2);
    expect(css.match(/font-display:swap/g)).toHaveLength(2);
    expect(css.match(/unicode-range:U\+/g)).toHaveLength(2);
    const adj = Number(css.match(/size-adjust:([\d.]+)%/)[1]);
    expect(adj).toBeGreaterThan(100); expect(adj).toBeLessThan(115);
    expect(css).toContain(`--jjjei-font-sans:${tokens.design['font-family']}`);
  });
  it('Gill Sans Nova is not shipped (decision Q4)', () => {
    expect(walk(D).filter((f) => /gill/i.test(f))).toEqual([]);
  });
});

describe('every relative url() in dist resolves (immutable by construction)', () => {
  it('no absolute URLs and no dangling references in any stylesheet', () => {
    const bad = [];
    for (const file of walk(D).filter((f) => f.endsWith('.css'))) {
      const css = fs.readFileSync(file, 'utf8').replace(/url\("data:[^"]*"\)/g, ''); // data-URIs may carry namespaces and filter refs
      if (/https?:\/\/|@import|@main/.test(css)) bad.push(`${file}: absolute url or @import`);
      for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        const u = m[1];
        if (u.startsWith('data:') || u.startsWith('#')) continue;
        if (!fs.existsSync(path.join(path.dirname(file), u))) bad.push(`${file}: ${u}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('core.css and the extras reference the same font and pattern files', () => {
    expect(read('bootstrap/core.css')).toContain('url("../fonts/files/inter-latin-wght-normal.woff2")');
    expect(read('bootstrap/core.css')).toContain('url("../images/patterns/grid.svg")');
    expect(read('tailwind/extras.css')).toContain('url("../images/patterns/dots.svg")');
  });
});

describe('logos', () => {
  const logos = () => index.filter((e) => e.kind === 'logo');
  it('brand-green logos get light, dark and currentColor variants; two-colour logos do not', () => {
    const names = new Set(logos().map((e) => e.path));
    for (const v of ['', '-light', '-dark', '-currentcolor']) expect(names.has(`logos/jjjei/stacked${v}.svg`)).toBe(true);
    expect([...names].filter((n) => n.startsWith('logos/marymart/') && /-(light|dark|currentcolor)/.test(n))).toEqual([]);
    expect(isBrandMono(fs.readFileSync('assets/images/source/logos/marymart/stacked.svg', 'utf8'))).toBe(false);
  });
  it('light is white and dark is the system dark colour (v1 mixed #000 and #191C1F)', () => {
    expect(read('logos/jjjei/mark-light.svg'.replace(/^/, 'images/'))).toMatch(/#fff/i);
    expect(read('images/logos/jjjei/stacked-dark.svg').toLowerCase()).toContain(tokens.system.dark.toLowerCase());
    expect(read('images/logos/jjjei/mark-currentcolor.svg')).toContain('currentColor');
  });
  it('SVGs are optimised (idempotent), keep a viewBox and contain nothing active', () => {
    for (const e of index.filter((x) => x.format === 'svg')) {
      const svg = read(`images/${e.path}`);
      expect(svgo(svg), e.path).toBe(svg);
      expect(svg, e.path).toContain('viewBox');
      expect(svg, e.path).not.toMatch(/<script|onload=|javascript:|xlink:href="https?:/i);
    }
  });
  it('optimisation does not change the picture (<= 0.1 % of pixels differ)', async () => {
    const flat = (b, w, h) => sharp(b).resize(w, h).flatten({ background: '#808080' }).raw().toBuffer();
    for (const [src, out] of [['logos/jjjei/stacked.svg', 'logos/jjjei/stacked.svg'], ['logos/marymart/horizontal.svg', 'logos/marymart/horizontal.svg'], ['patterns/topography.svg', 'patterns/topography.svg']]) {
      const a = fs.readFileSync(`assets/images/source/${src}`), b = fs.readFileSync(`${D}/images/${out}`);
      const m = await sharp(a).metadata();
      const [A, B] = await Promise.all([flat(a, m.width, m.height), flat(b, m.width, m.height)]);
      let n = 0; for (let i = 0; i < A.length; i += 3) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 24) n++;
      expect(n / (A.length / 3), src).toBeLessThan(0.001);
    }
  });
  it('PNG renditions have the width in their name; the raster-only logo is passed through untouched', async () => {
    for (const e of index.filter((x) => x.format === 'png' && /@\d+\.png$/.test(x.path))) expect(e.width, e.path).toBe(Number(e.path.match(/@(\d+)\.png$/)[1]));
    expect(fs.readFileSync(`${D}/images/logos/jjjei/horizontal-50yrs.png`).equals(fs.readFileSync('assets/images/source/logos/jjjei/horizontal-50yrs.png'))).toBe(true);
  });
});

describe('images/index.json', () => {
  it('lists every file under images/ with size, dimensions and SRI that match the bytes', () => {
    const onDisk = walk(`${D}/images`).map((f) => path.relative(`${D}/images`, f)).filter((f) => !['index.json', 'patterns.css'].includes(f)).sort();
    expect(index.map((e) => e.path).sort()).toEqual(onDisk);
    for (const e of index) {
      const buf = fs.readFileSync(`${D}/images/${e.path}`);
      expect(e.bytes).toBe(buf.length);
      expect(e.sri).toBe('sha384-' + crypto.createHash('sha384').update(buf).digest('base64'));
      expect(e.width).toBeGreaterThan(0);
    }
  });
  it('contains no duplicate files (v1 shipped base.svg and logo.svg byte-identical)', () => {
    const byHash = {};
    for (const e of index) (byHash[e.sri] ??= []).push(e.path);
    expect(Object.values(byHash).filter((p) => p.length > 1)).toEqual([]);
  });
});

describe('patterns and loaders', () => {
  it('every source pattern is emitted, with a class using a relative url', () => {
    const css = read('images/patterns.css');
    for (const p of listPatterns(tokens.patterns)) {
      expect(fs.existsSync(`${D}/images/patterns/${p.name}.svg`)).toBe(true);
      expect(css).toContain(`.bg-pattern-${p.name}{background-image:url("patterns/${p.name}.svg")`);
    }
    expect(css).toContain('background-size:20px 20px');
  });
  it('loader sizes and durations come from tokens/loaders.json', () => {
    const core = read('bootstrap/core.css');
    expect(core).toMatch(/\.loader\{[^}]*width:2rem[^}]*animation:loader-spin \.75s/);
    expect(core).toMatch(/\.loader-dots\{[^}]*width:3rem;height:1rem[^}]*animation:loader-dots 1\.2s/);
    expect(read('tailwind/extras.css')).toMatch(/\.loader-dots\{[^}]*width:3rem/);
  });
});

describe('manifest.json', () => {
  const m = () => JSON.parse(read('manifest.json'));
  it('describes the release: version, prerelease flag, pinned CDN base, tool versions, groups', () => {
    expect(m()).toMatchObject({ version: '2.0.0-rc.1', prerelease: true, cdnBase: 'https://cdn.jsdelivr.net/gh/o/r@v2.0.0-rc.1/dist/' });
    expect(m().groups).toHaveLength(Object.keys(tokens.groups).length);
    expect(m().bootstrap).toMatch(/^5\.3\./);
    expect(m().tailwind.v4).toMatch(/^4\./);
  });
  it('lists every file except itself, with bytes and an SRI that match', () => {
    const onDisk = walk(D).map((f) => path.relative(D, f)).filter((f) => f !== 'manifest.json').sort();
    expect(m().files.map((f) => f.path)).toEqual(onDisk);
    for (const f of m().files) {
      const buf = fs.readFileSync(`${D}/${f.path}`);
      expect(f.bytes).toBe(buf.length);
      expect(f.sri).toBe('sha384-' + crypto.createHash('sha384').update(buf).digest('base64'));
    }
  });
  it('lists the public classes and variables', () => {
    expect(m().classes).toEqual(expect.arrayContaining(['btn-primary', 'bg-status-3-subtle', 'bg-primary-gradient', 'link-success']));
    expect(m().variables).toEqual(expect.arrayContaining(['--jjjei-primary', '--jjjei-primary-subtle', '--jjjei-status-3-emphasis']));
  });
  it('has no cdnBase when the repository is unknown', () => {
    fs.mkdirSync(`${D}-nomain`, { recursive: true });
    fs.cpSync(D, `${D}-nomain`, { recursive: true });
    expect(emitManifest(tokens, `${D}-nomain`, { version: '1.0.0', slug: null }).cdnBase).toBeNull();
  });
});
