// Snapshot of v1's compiled colour values (assets_v1/colors/latest) used as the parity oracle.
// Run only when the v1 repo changes: node scripts/extract-v1-golden.mjs [v1Dir]
import fs from 'node:fs';
import { parse, formatHex } from 'culori';

const v1 = process.argv[2] ?? '../assets_v1';
const hex = (v) => formatHex(parse(v.trim().replace(/\s*!important/, ''))).toUpperCase();
const DROPPED = ['jjjei_facilities:1a', 'jjjei_facilities:5a']; // decision Q17: not carried to v2
const groups = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(`${v1}/config/groupColors.json`, 'utf8'))).filter(([id]) => !DROPPED.includes(id)));
const system = Object.keys(JSON.parse(fs.readFileSync(`${v1}/config/systemColors.json`, 'utf8')));
const status = Object.keys(JSON.parse(fs.readFileSync(`${v1}/config/statusColors.json`, 'utf8'))).map((k) => `status-${k}`);

const blocks = (css, re) => [...css.matchAll(re)].map((m) => m[1]).join(';');
const varIn = (decl, name) => decl.match(new RegExp(`--bs-${name}:\\s*([^;]+)`))?.[1];
const rule = (css, sel) => css.match(new RegExp(`${sel.replace(/[.[\]()]/g, '\\$&')}\\{[^}]*?:([^;}]+)`))?.[1];

function colorGolden(css, name) {
  const light = blocks(css, /:root,\[data-bs-theme=light\]\{([^}]*)\}/g);
  const dark = blocks(css, /\[data-bs-theme=dark\]\{([^}]*)\}/g);
  const g = { light: {}, dark: {} };
  for (const [k, v] of [['subtle', 'bg-subtle'], ['borderSubtle', 'border-subtle'], ['emphasis', 'text-emphasis']]) {
    g.light[k] = varIn(light, `${name}-${v}`);
    g.dark[k] = varIn(dark, `${name}-${v}`);
  }
  if (name === 'primary') for (const [m, blk] of [['light', light], ['dark', dark]]) { g[m].link = varIn(blk, 'link-color'); g[m].linkHover = varIn(blk, 'link-hover-color'); }
  for (const v of ['faint', 'shaded', 'body']) {
    g.light[v] = rule(css, `.bg-${name}-${v}`);
    g.light[v + 'Border'] = rule(css, `.border-${name}-${v}`);
    g.dark[v] = rule(css, `[data-bs-theme=dark] .bg-${name}-${v}`);
    g.dark[v + 'Border'] = rule(css, `[data-bs-theme=dark] .border-${name}-${v}`);
  }
  for (const m of ['light', 'dark']) for (const [k, v] of Object.entries(g[m])) if (v) g[m][k] = hex(v); else delete g[m][k];
  return g;
}

const out = { groups: {}, shared: {} };
for (const [id, h] of Object.entries(groups)) {
  const css = fs.readFileSync(`${v1}/colors/latest/${id}.css`, 'utf8');
  out.groups[id] = { hex: h, ...colorGolden(css, 'primary'),
    baseBg: { light: hex(rule(css, '.bg-primary-base')), dark: hex(rule(css, '[data-bs-theme=dark] .bg-primary-base')) } };
}
const css = fs.readFileSync(`${v1}/colors/latest/jjjei_admin:0.css`, 'utf8');
for (const n of [...system, ...status]) out.shared[n] = colorGolden(css, n);
fs.writeFileSync('test/fixtures/v1-golden.json', JSON.stringify(out, null, 1) + '\n');
console.log(`groups=${Object.keys(out.groups).length} shared=${Object.keys(out.shared).length}`);
