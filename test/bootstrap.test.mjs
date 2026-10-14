import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import * as sass from 'sass';
import zlib from 'node:zlib';
import { validateAll } from '../src/build/validate.mjs';
import { emitColors } from '../src/build/emit-colors.mjs';
import { emitBootstrap, compileCore } from '../src/build/emit-bootstrap.mjs';

const { tokens, colors } = validateAll();
const OUT = 'build/test-bootstrap';
const COLORS = 'build/test-bootstrap-colors'; // separate: emitBootstrap clears its output dir
const read = (f) => fs.readFileSync(`${OUT}/${f}`, 'utf8');
const gz = (f) => zlib.gzipSync(fs.readFileSync(`${OUT}/${f}`), { level: 9 }).length;
const v1Added = JSON.parse(fs.readFileSync('test/fixtures/v1-added-classes.json', 'utf8'));
let core;

beforeAll(() => {
  emitColors(tokens, colors, COLORS);
  emitBootstrap(tokens, COLORS, OUT);
  core = read('core.css');
});

describe('bootstrap override output', () => {
  it('emits core.css and one bundle per group', () => {
    expect(fs.readdirSync(OUT).filter((f) => f.endsWith('.css'))).toHaveLength(Object.keys(tokens.groups).length + 1);
  });
  it('covers every class v1 adds on top of stock Bootstrap', () => {
    const missing = v1Added.filter((c) => !new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`).test(core));
    expect(missing).toEqual([]);
  });
  it('the bundle is the group colour tokens followed by core', () => {
    expect(read('jjjei_hr-0.css')).toBe(fs.readFileSync(`${COLORS}/jjjei_hr-0.css`, 'utf8') + core);
  });
  it('stays inside the size budgets (gzip): core <= 18 KB, bundle <= 26 KB', () => {
    expect(gz('core.css')).toBeLessThan(18 * 1024);
    expect(gz('jjjei_admin-0.css')).toBeLessThan(26 * 1024);
  });
  it('is group independent: no group hex baked into core', () => {
    for (const g of Object.values(tokens.groups)) if (g.hex.toUpperCase() !== tokens.system.warning.toUpperCase()) expect(core.toLowerCase()).not.toContain(g.hex.toLowerCase() + ';');
  });
  it('has no absolute URLs or @import (immutable by construction)', () => {
    expect(core.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|@import|@main/);
  });
  it('adds a v2 helper class set for every colour', () => {
    for (const n of ['primary', 'success', 'jjjei-primary', 'status-0', 'status-9']) for (const c of [`btn-${n}`, `text-bg-${n}`, `link-${n}`, `bg-${n}-gradient`, `nav-pills-${n}`]) expect(core).toContain(`.${c}`);
  });
  it('dark scopes re-resolve the bridge (attribute, data-theme and .dark)', () => {
    expect(core).toContain(':root,[data-bs-theme],[data-theme],.dark{');
  });
  it('compiles without Sass deprecation warnings', () => {
    const seen = [];
    const logger = { warn: (m, o) => seen.push(o?.deprecation ? `deprecation: ${m}` : m), debug: () => {} };
    // positive control: the logger really sees deprecations (global map-get is one)
    sass.compileString('a { b: map-get((c: d), c) }', { logger });
    expect(seen.length).toBeGreaterThan(0);
    seen.length = 0;
    compileCore(tokens, logger);
    expect(seen).toEqual([]);
  });
});
