// Computed-style parity between v1 CSS and v2 bundles on a fixture covering every colour x component x state x mode.
// Needs Chromium (CHROMIUM_PATH or `npx playwright install chromium`) and the v1 repo for the oracle.
// node scripts/style-parity.mjs [--groups jjjei_admin-0,jjjei_hr-0|all] [--out build/parity.json]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadTokens } from '../src/build/tokens-io.mjs';
import { computeAll } from '../src/build/compute-tokens.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const V1 = arg('v1', '../assets_v1');
const tokens = loadTokens();
const wanted = arg('groups', 'jjjei_admin-0,jjjei_hr-0,jjjei_gmo-1');
const slugs = wanted === 'all' ? Object.keys(tokens.groups) : wanted.split(',');
const computed = computeAll(tokens);
const BS = path.resolve('node_modules/bootstrap/dist/css/bootstrap.min.css');
const names = ['primary', ...Object.keys(tokens.system), ...Object.keys(tokens.status).map((n) => `status-${n}`)];
const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderBottomColor', 'boxShadow', 'textDecorationColor', 'outlineColor', 'borderTopLeftRadius', 'fontFamily', 'opacity'];
const STATES = ['', 'hover', 'focus', 'active', 'focus-visible'];

// ── fixture ──
let n = 0;
const items = []; // {id, html, ix}
const add = (label, html, ix = false) => { const id = `e${n++}`; items.push({ id, label, ix }); return html.replace('>', ` data-k="${id}">`); };
const rows = [];
for (const c of names) {
  rows.push(add(`btn-${c}`, `<button class="btn btn-${c}">b</button>`, true));
  rows.push(add(`btn-outline-${c}`, `<button class="btn btn-outline-${c}">b</button>`, true));
  rows.push(add(`text-bg-${c}`, `<span class="badge text-bg-${c}">b</span>`));
  rows.push(add(`alert-${c}`, `<div class="alert alert-${c}">a <a href="#" class="alert-link">l</a></div>`));
  rows.push(add(`list-group-item-${c}`, `<ul class="list-group"><li class="list-group-item list-group-item-${c}">l</li></ul>`));
  rows.push(add(`table-${c}`, `<table class="table table-${c}"><tr><td>t</td></tr></table>`));
  rows.push(add(`link-${c}`, `<a href="#" class="link-${c}">l</a>`, true));
  for (const u of ['bg', 'text', 'border']) rows.push(add(`${u}-${c}`, `<div class="${u}-${c} border">u</div>`));
  for (const v of ['bg-%-subtle', 'border-%-subtle border', 'text-%-emphasis', 'bg-%-gradient', 'bg-%-gradient-subtle', 'bg-%-shaded', 'border-%-shaded border', 'bg-%-faint', 'border-%-faint border', 'bg-%-body', 'border-%-body border'])
    rows.push(add(v.replace('%', c).split(' ')[0], `<div class="${v.replace('%', c)}">v</div>`));
  rows.push(add(`nav-pills-${c}`, `<ul class="nav nav-pills nav-pills-${c}"><li><a class="nav-link active" href="#">a</a></li></ul>`));
  rows.push(add(`nav-pills-subtle-${c}`, `<ul class="nav nav-pills nav-pills-subtle nav-pills-${c}"><li><a class="nav-link active" href="#">a</a></li></ul>`));
  rows.push(add(`loader-${c}`, `<span class="loader loader-${c}"></span>`));
}
rows.push(add('bg-primary-base', '<div class="bg-primary-base">b</div>'));
rows.push(add('a', '<a href="#">plain link</a>', true));
rows.push(add('btn-link', '<button class="btn btn-link">l</button>', true));
rows.push(add('mark', '<mark>m</mark>'));
rows.push(add('nav-tabs', '<ul class="nav nav-tabs"><li><a class="nav-link active" href="#">a</a></li><li><a class="nav-link" href="#">b</a></li></ul>', true));
rows.push(add('page-item-active', '<ul class="pagination"><li class="page-item active"><a class="page-link" href="#">1</a></li><li class="page-item"><a class="page-link" href="#">2</a></li></ul>', true));
rows.push(add('progress', '<div class="progress"><div class="progress-bar" style="width:50%">p</div></div>'));
rows.push(add('dropdown', '<div class="dropdown-menu show" style="position:static"><a class="dropdown-item active" href="#">a</a><a class="dropdown-item" href="#">b</a></div>', true));
rows.push(add('list-group-active', '<ul class="list-group"><li class="list-group-item active">a</li></ul>'));
rows.push(add('accordion', '<div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">o</button></h2><div class="accordion-collapse collapse show"><div class="accordion-body">b</div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button">c</button></h2></div></div>', true));
for (const [l, h] of [['input', '<input class="form-control" value="x">'], ['select', '<select class="form-select"><option>o</option></select>'], ['check', '<input type="checkbox" class="form-check-input" checked>'], ['radio', '<input type="radio" class="form-check-input" checked>'],
  ['switch', '<div class="form-check form-switch"><input type="checkbox" class="form-check-input" role="switch" checked></div>'], ['switch-off', '<div class="form-check form-switch"><input type="checkbox" class="form-check-input" role="switch"></div>'], ['range', '<input type="range" class="form-range">'],
  ['valid-input', '<input class="form-control is-valid" value="x">'], ['invalid-input', '<input class="form-control is-invalid" value="x">'], ['valid-check', '<input type="checkbox" class="form-check-input is-valid" checked>'], ['invalid-check', '<input type="checkbox" class="form-check-input is-invalid" checked>'],
  ['btn-close', '<button class="btn-close"></button>'], ['focus-ring', '<a href="#" class="focus-ring">f</a>']]) rows.push(add(l, h, true));
// nested components: tag the inner elements we want to measure
const k = (label, ix = false) => { const id = `e${n++}`; items.push({ id, label, ix }); return ` data-k="${id}"`; };
rows.push(`<nav class="navbar navbar-expand bg-body-tertiary"${k('navbar')}><div class="container-fluid"><a class="navbar-brand" href="#"${k('navbar-brand', true)}>B</a><button class="navbar-toggler" type="button"${k('navbar-toggler', true)}><span class="navbar-toggler-icon"${k('navbar-toggler-icon')}></span></button><ul class="navbar-nav"><li class="nav-item"><a class="nav-link active" href="#"${k('navbar-link-active', true)}>Home</a></li><li class="nav-item"><a class="nav-link" href="#"${k('navbar-link', true)}>Link</a></li><li class="nav-item"><a class="nav-link disabled" href="#"${k('navbar-link-disabled')}>Off</a></li></ul></div></nav>`);
rows.push(`<nav class="navbar bg-primary" data-bs-theme="dark"${k('navbar-primary')}><div class="container-fluid"><a class="navbar-brand" href="#"${k('navbar-primary-brand', true)}>B</a><a class="nav-link active" href="#"${k('navbar-primary-link', true)}>Home</a></div></nav>`);
rows.push(`<div id="car1" class="carousel slide" style="max-width:360px"${k('carousel')}><div class="carousel-indicators"><button type="button" class="active" data-bs-target="#car1"${k('carousel-indicator-active', true)}></button><button type="button" data-bs-target="#car1"${k('carousel-indicator', true)}></button></div><div class="carousel-inner"><div class="carousel-item active" style="height:60px"${k('carousel-item')}><div class="carousel-caption"${k('carousel-caption')}>c</div></div></div><button class="carousel-control-prev" type="button"${k('carousel-control-prev', true)}><span class="carousel-control-prev-icon"${k('carousel-control-prev-icon')}></span></button><button class="carousel-control-next" type="button"><span class="carousel-control-next-icon"${k('carousel-control-next-icon')}></span></button></div>`);
rows.push(`<div class="offcanvas offcanvas-start show" tabindex="-1" style="position:static;visibility:visible;transform:none;width:240px"${k('offcanvas')}><div class="offcanvas-header"${k('offcanvas-header')}><h5 class="offcanvas-title"${k('offcanvas-title')}>t</h5><button type="button" class="btn-close"${k('offcanvas-close', true)}></button></div><div class="offcanvas-body"${k('offcanvas-body')}>b</div></div>`);
const body = rows.join('\n');
const page = (mode, css) => `<!doctype html><html data-bs-theme="${mode}"><head><meta charset=utf-8><style>*{transition:none!important;animation:none!important}</style><link rel=stylesheet href="file://${BS}">${css.map((c) => `<link rel=stylesheet href="file://${path.resolve(c)}">`).join('')}</head><body style="width:900px">${body}</body></html>`;

// ── measurement ──
const measure = async (browser, mode, css, file) => {
  fs.mkdirSync('build/parity', { recursive: true });
  fs.writeFileSync(file, page(mode, css));
  const p = await browser.newPage();
  await p.route(/^https?:/, (r) => r.abort());
  await p.goto('file://' + path.resolve(file));
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const out = {};
  const read = (id, pseudo) => p.evaluate(([id, props, pseudo]) => { const el = document.querySelector(`[data-k="${id}"]`); const s = getComputedStyle(el.querySelector('.accordion-button') && pseudo ? el.querySelector('.accordion-button') : el, pseudo || null); return Object.fromEntries(props.map((k) => [k, s[k]])); }, [id, PROPS, pseudo]);
  for (const it of items) {
    // measure the first interactive/visible descendant if the wrapper is not the styled node
    const sel = `[data-k="${it.id}"]`;
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    for (const st of it.ix ? STATES : ['']) {
      if (st) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: st === 'focus-visible' ? ['focus', 'focus-visible'] : [st] });
      const v = await read(it.id);
      for (const [k, val] of Object.entries(v)) out[`${it.id}|${st}|${k}`] = val;
      if (it.label === 'accordion') { const a = await read(it.id, '::after'); out[`${it.id}|${st}|::after`] = a.backgroundImage; }
      if (st) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
  }
  await p.close();
  return out;
};

// Normalise values that differ in notation only: zero-size shadow layers, data-URI hex case.
const canon = (prop, v) => {
  if (prop === 'boxShadow') {
    const layers = v.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => x && !/(^|\s)0px 0px 0px 0px($|\s)/.test(x));
    return layers.length ? layers.join(', ') : 'none';
  }
  if (prop === 'backgroundImage' || prop === '::after') return v.toLowerCase()
    .replace(/rgb%28([\d.]+)%, ?([\d.]+)%, ?([\d.]+)%%29/g, (_, r, g, b) => `rgb(${[r, g, b].map((x) => Math.round(x * 2.55)).join(',')})`) // Sass percent notation
    .replace(/z'/g, "'") // v1's Sass output dropped the path's closing z
    .replace(/(?:#|%23)([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/g, (_, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`);
  return v;
};
// equal after allowing +-1 on colour channels (Sass rounds half-up, v1's Python truncated)
const num = /-?\d+(?:\.\d+)?/g;
const near = (a, b) => {
  if (a.replace(num, '#') !== b.replace(num, '#')) return false;
  const x = (a.match(num) ?? []).map(Number), y = (b.match(num) ?? []).map(Number);
  return x.every((v, i) => Math.abs(v - y[i]) <= (Number.isInteger(v) && Number.isInteger(y[i]) ? 1 : 0.011));
};

// Differences we accept and explain. Anything else fails the run.
const CUSTOM = new Set(names.filter((x) => x.startsWith('jjjei-') || x.startsWith('status-')));
const customOf = (el) => [...CUSTOM].some((c) => el.includes(`-${c}`) || el.endsWith(c));
const EXPECTED = [
  ['v2 font stack adds the metric-matched Inter Fallback and system-ui', (d) => d.prop === 'fontFamily'],
  ['v1 dropped the button focus ring (its `none, <ring>` shadow list is invalid); v2 keeps it', (d) => /^btn-/.test(d.el) && d.state === 'focus-visible' && d.prop === 'boxShadow'],
  ['v1 left stock blue .link-* helpers for Bootstrap names and had none for custom names', (d) => /^link-(?!underline)/.test(d.el)],
  ['v1 left stock white/black text on .text-bg-*; none for custom names', (d) => /^text-bg-/.test(d.el)],
  ['v1 .btn-close focus ring stayed Bootstrap blue', (d) => d.el === 'btn-close' || d.el === 'offcanvas-close'],
  ['v1 emphasis for custom colours was color-contrast() near-black/white (A-15); v2 has a real emphasis', (d) => customOf(d.el) && /^(alert|list-group-item|text)-.*(?:emphasis)?|^(alert|list-group-item)-/.test(d.el) && ['color', 'borderTopColor', 'borderBottomColor', 'textDecorationColor', 'outlineColor'].includes(d.prop)],
  ['v1 had no .table-* / dark-mode subtle for custom colours', (d) => customOf(d.el) && /^(table-|alert-|list-group-item-|bg-.*-subtle|border-.*-subtle)/.test(d.el)],
];
const hexOf = (rgbStr) => { const m = rgbStr.match(/rgb\((\d+), (\d+), (\d+)\)/); return m && '#' + m.slice(1).map((x) => Number(x).toString(16).padStart(2, '0')).join(''); };
// Q16: where v2 changed the emphasis colour to reach AA, the value it shows must be exactly the computed emphasis token
const emphasisFix = (d, ctx) => {
  if (!/^(alert|list-group-item|text|nav-pills-subtle|accordion)/.test(d.el)) return false;
  const n = names.filter((x) => d.el.includes(x)).sort((a, b) => b.length - a.length)[0] ?? (d.el === 'accordion' ? 'primary' : null);
  if (!n) return false;
  const e = computed[n === 'primary' ? ctx.slug : n]?.[ctx.mode].emphasis.toLowerCase();
  return d.prop === '::after' ? d.v2.toLowerCase().includes(e.slice(1)) : hexOf(d.v2) === e;
};
const classify = (d, ctx) => (emphasisFix(d, ctx) ? 'v2 adjusted emphasis to reach AA (Q16)' : EXPECTED.find(([, f]) => f(d))?.[0]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const report = {};
for (const slug of slugs) {
  const legacy = tokens.groups[slug].legacyId;
  for (const mode of ['light', 'dark']) {
    const a = await measure(browser, mode, [`${V1}/colors/latest/${legacy}.css`], `build/parity/v1-${slug}-${mode}.html`);
    const b = await measure(browser, mode, [`dist/bootstrap/${slug}.css`], `build/parity/v2-${slug}-${mode}.html`);
    let exact = 0, close = 0; const diffs = [];
    for (const k of Object.keys(a)) {
      const prop = k.split('|')[2], x = canon(prop, a[k]), y = canon(prop, b[k]);
      if (x === y) exact++; else if (near(x, y)) close++;
      else { const [id, st, prop] = k.split('|'); diffs.push({ el: items.find((i) => i.id === id).label, state: st, prop, v1: a[k], v2: b[k] }); }
    }
    const unexpected = diffs.filter((d) => !classify(d, { slug, mode }));
    report[`${slug}|${mode}`] = { total: Object.keys(a).length, exact, close, expected: diffs.length - unexpected.length, diffs: unexpected };
    console.log(`${slug} ${mode}: ${Object.keys(a).length} values, ${exact} exact, ${close} within 1, ${diffs.length - unexpected.length} expected differences, ${unexpected.length} UNEXPECTED`);
  }
}
await browser.close();
fs.writeFileSync(arg('out', 'build/parity.json'), JSON.stringify(report, null, 1));
process.exitCode = Object.values(report).some((r) => r.diffs.length) ? 1 : 0;
