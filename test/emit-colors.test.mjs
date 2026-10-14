import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import * as sass from 'sass';
import { validateAll } from '../src/build/validate.mjs';
import { emitColors, cssVar } from '../src/build/emit-colors.mjs';

const OUT = 'build/test-colors';
const { tokens, colors } = validateAll();
const slugs = Object.keys(tokens.groups);
const read = (f) => fs.readFileSync(`${OUT}/${f}`, 'utf8');
const gz = (f) => zlib.gzipSync(fs.readFileSync(`${OUT}/${f}`), { level: 9 }).length;
const vars = (css) => [...css.matchAll(/(--jjjei-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);

beforeAll(() => emitColors(tokens, colors, OUT, '9.9.9'));

describe('colours-only output', () => {
  it('emits base, a file and a bundle per group, all.css and the data files', () => {
    expect(fs.readdirSync(`${OUT}/groups`)).toHaveLength(slugs.length);
    for (const s of slugs) expect(fs.existsSync(`${OUT}/${s}.css`)).toBe(true);
    for (const f of ['base.css', 'all.css', 'tokens.json', 'tokens.flat.json', 'tokens.mjs', 'tokens.d.ts', '_tokens.scss']) expect(fs.existsSync(`${OUT}/${f}`)).toBe(true);
  });
  it('every group file defines the same variables (only primary), with correct values', () => {
    const names = (s) => vars(read(`groups/${s}.css`)).map(([k]) => k);
    const ref = [...new Set(names(slugs[0]))];
    for (const s of slugs) expect([...new Set(names(s))]).toEqual(ref);
    expect(ref.every((n) => n.startsWith('--jjjei-primary'))).toBe(true);
    const admin = Object.fromEntries(vars(read('groups/jjjei_admin-0.css').split('[data-bs-theme="dark"]')[0])); // light block only
    expect(admin[cssVar('primary', 'subtle')]).toBe(colors['jjjei_admin-0'].light.subtle);
    expect(admin['--jjjei-primary']).toBe('#FFD700');
  });
  it('base.css carries system + status, never a group primary', () => {
    const n = vars(read('base.css')).map(([k]) => k);
    expect(n).toContain('--jjjei-status-3-subtle');
    expect(n).toContain('--jjjei-success');
    expect(n.some((k) => k.startsWith('--jjjei-primary'))).toBe(false);
  });
  it('dark values come from the dark selector list', () => {
    const css = read('groups/jjjei_admin-0.css');
    expect(css).toContain('[data-bs-theme="dark"], [data-theme="dark"], .dark {');
    expect(css.split('.dark {')[1]).toContain(colors['jjjei_admin-0'].dark.subtle);
  });
  it('bundle = base + group, and all.css selects each group by attribute', () => {
    expect(read('jjjei_hr-0.css')).toBe(read('base.css') + read('groups/jjjei_hr-0.css'));
    const all = read('all.css');
    for (const s of slugs) expect(all).toContain(`[data-jjjei-group="${s}"]`);
  });
  it('is self-contained: no absolute URLs, no @import, no @main', () => {
    // the SVG xmlns inside data-URIs is a namespace identifier, not a request
    for (const f of ['base.css', 'all.css', 'groups/jjjei_hr-0.css']) expect(read(f).replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|@import|@main/);
  });
  it('stays inside the size budgets (gzip)', () => {
    expect(gz('groups/jjjei_admin-0.css')).toBeLessThan(1536);
    expect(gz('base.css')).toBeLessThan(6144);
  });
  it('tokens.mjs matches tokens.flat.json and the d.ts names every group', async () => {
    const mod = await import(pathToFileURL(`${process.cwd()}/${OUT}/tokens.mjs`).href + '?t=' + Date.now());
    const flat = JSON.parse(read('tokens.flat.json'));
    expect(mod.groups).toEqual(flat.groups);
    expect(flat.version).toBe('9.9.9');
    const dts = read('tokens.d.ts');
    for (const s of slugs) expect(dts).toContain(`'${s}'`);
  });
  it('DTCG tokens are typed colours with dark variants', () => {
    const t = JSON.parse(read('tokens.json'));
    expect(t.group['jjjei_admin-0'].subtle).toEqual({ $type: 'color', $value: colors['jjjei_admin-0'].light.subtle });
    expect(t.group['jjjei_admin-0'].dark.subtle.$value).toBe(colors['jjjei_admin-0'].dark.subtle);
    expect(t.status['3'].base.$description).toBe(tokens.status['3'].meaning);
  });
  it('_tokens.scss compiles and returns the same value', () => {
    const css = sass.compileString(`@use "sass:map"; @use "tokens" as t; a { b: map.get(t.$groups, "jjjei_admin-0", "light", "subtle"); c: map.get(t.$groups, "jjjei_admin-0", "dark", "subtle"); }`,
      { importers: [{ findFileUrl: (u) => (u === 'tokens' ? pathToFileURL(`${process.cwd()}/${OUT}/_tokens.scss`) : null) }] }).css;
    expect(css).toContain(colors['jjjei_admin-0'].light.subtle);
    expect(css).toContain(colors['jjjei_admin-0'].dark.subtle);
  });
});
