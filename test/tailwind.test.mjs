import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateAll } from '../src/build/validate.mjs';
import { emitTailwind, colourNames } from '../src/build/emit-tailwind.mjs';

const { tokens } = validateAll();
const OUT = path.resolve('build/test-tailwind');
const names = colourNames(tokens);
const KEYS = ['', '-subtle', '-border-subtle', '-emphasis', '-contrast', '-hover', '-active', '-faint', '-shaded', '-body', '-body-border'];
const css = (f) => fs.readFileSync(`${OUT}/${f}`, 'utf8');
const gz = (f) => zlib.gzipSync(fs.readFileSync(`${OUT}/${f}`), { level: 9 }).length;
const run = (bin, args, cwd) => execFileSync(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
const esc = (c) => c.replace(/[:/]/g, '\\$&');

// every colour x role as a bg- class, plus the other utility kinds, dark/hover variants and an opacity modifier
const classes = [...names.flatMap((n) => [...KEYS.map((k) => `bg-${n}${k}`), `text-${n}-emphasis`, `border-${n}-border-subtle`, `dark:bg-${n}`, `hover:bg-${n}-hover`, `bg-${n}/50`]), 'bg-primary-base'];

beforeAll(() => {
  emitTailwind(tokens, OUT);
  fs.mkdirSync(`${OUT}/v4work/vendor`, { recursive: true });
  for (const f of ['theme.css', 'dark-variant.css']) fs.copyFileSync(`${OUT}/v4/${f}`, `${OUT}/v4work/vendor/${f}`);
  fs.writeFileSync(`${OUT}/v4work/classes.html`, `<div class="${classes.join(' ')}"></div>`);
  fs.writeFileSync(`${OUT}/v4work/input.css`, '@import "tailwindcss";\n@import "./vendor/theme.css";\n@import "./vendor/dark-variant.css";\n');
  run(process.execPath, [path.resolve('node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', 'input.css', '-o', 'out.css'], `${OUT}/v4work`);

  fs.mkdirSync(`${OUT}/v3work`, { recursive: true });
  fs.writeFileSync(`${OUT}/v3work/classes.html`, `<div class="${classes.join(' ')}"></div>`);
  fs.writeFileSync(`${OUT}/v3work/tailwind.config.cjs`, `module.exports = { presets: [require('../v3/preset.cjs')], content: ['./classes.html'], corePlugins: { preflight: false } };`);
  fs.writeFileSync(`${OUT}/v3work/input.css`, '@tailwind utilities;\n');
  run(process.execPath, [path.resolve('node_modules/tailwindcss3/lib/cli.js'), '-c', 'tailwind.config.cjs', '-i', 'input.css', '-o', 'out.css'], `${OUT}/v3work`);
}, 120000);

describe('Tailwind v4 theme', () => {
  it('compiles with the real CLI and every colour x role resolves to its live variable', () => {
    const out = fs.readFileSync(`${OUT}/v4work/out.css`, 'utf8');
    const missing = [];
    for (const n of names) for (const k of KEYS) {
      const v = k === '' ? `--jjjei-${n}` : `--jjjei-${n}${{ '-hover': '-hover-bg', '-active': '-active-bg' }[k] ?? k}`;
      if (!new RegExp(`\\.bg-${esc(n + k)}\\s*\\{\\s*background-color:\\s*var\\(${v}\\)`).test(out)) missing.push(`bg-${n}${k}`);
    }
    expect(missing).toEqual([]);
    expect(out).toMatch(/\.bg-primary-base\s*\{\s*background-color:\s*var\(--jjjei-primary-base-bg\)/);
  });
  it('supports opacity modifiers, hover and the dark variant (children of [data-bs-theme=dark] included)', () => {
    const out = fs.readFileSync(`${OUT}/v4work/out.css`, 'utf8');
    expect(out).toContain('color-mix(in oklab, var(--jjjei-primary) 50%');
    expect(out).toMatch(/\.hover\\:bg-primary-hover:hover/);
    expect(out).toContain('[data-bs-theme="dark"] *');
    expect(out).toMatch(/\.dark\\:bg-primary:where\(/);
  });
  it('the prefixed variant exposes jj-* names and nothing unprefixed', () => {
    const p = css('v4/theme.prefixed.css');
    expect(p).toContain('--color-jj-primary: var(--jjjei-primary);');
    expect(p).not.toMatch(/--color-primary\b/);
  });
  it('stays inside the size budget (4 KB gzip) and is self-contained', () => {
    expect(gz('v4/theme.css')).toBeLessThan(4096);
    for (const f of ['v4/theme.css', 'v4/theme.prefixed.css', 'v4/dark-variant.css', 'extras.css']) expect(css(f).replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|@import|@main/);
  });
});

describe('Tailwind v3 preset', () => {
  it('compiles with the real CLI: base colour keeps alpha support, roles are variables', () => {
    const out = fs.readFileSync(`${OUT}/v3work/out.css`, 'utf8');
    expect(out).toMatch(/\.bg-primary\s*\{[^}]*rgb\(var\(--jjjei-primary-rgb\) \/ var\(--tw-bg-opacity, 1\)\)/);
    expect(out).toMatch(/\.bg-primary-subtle\s*\{[^}]*var\(--jjjei-primary-subtle\)/);
    expect(out).toMatch(/\.bg-status-3-emphasis\s*\{[^}]*var\(--jjjei-status-3-emphasis\)/);
    expect(out).toMatch(/\.bg-primary-base\s*\{[^}]*var\(--jjjei-primary-base-bg\)/);
    expect(out).toContain('[data-bs-theme="dark"] *');
  });
  it('defines every colour name and the ESM preset equals the CJS one', async () => {
    const cjs = createRequire(import.meta.url)(`${OUT}/v3/preset.cjs`);
    for (const n of names) expect(cjs.theme.extend.colors[n].DEFAULT).toContain(`--jjjei-${n}-rgb`);
    const esm = (await import(pathToFileURL(`${OUT}/v3/preset.mjs`).href)).default;
    expect(esm).toEqual(cjs);
  });
});

describe('Tailwind extras', () => {
  it('provides what a theme cannot: gradients, patterns, loaders, and no Bootstrap component CSS', () => {
    const x = css('extras.css');
    for (const c of ['.bg-primary-gradient', '.bg-status-3-gradient-subtle', '.bg-pattern-grid', '.loader-pulse', '--jjjei-noise']) expect(x).toContain(c);
    expect(x).not.toMatch(/\.btn-|\.alert-|--bs-/);
  });
});
