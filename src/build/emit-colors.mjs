import fs from 'node:fs';
import path from 'node:path';

export const DARK = '[data-bs-theme="dark"], [data-theme="dark"], .dark';
const DARK_IS = ':is([data-bs-theme="dark"], [data-theme="dark"], .dark)';
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
/** --jjjei-<colour>[-<role>]; the plain colour value has no role suffix. */
export const cssVar = (name, role) => `--jjjei-${name}${role === 'base' ? '' : '-' + kebab(role)}`;

const decls = (name, roles, indent = '  ') => Object.entries(roles).map(([r, v]) => `${indent}${cssVar(name, r)}: ${v};`).join('\n');
const block = (sel, body) => `${sel} {\n${body}\n}\n`;

/** Light + dark rule pair for one colour set: [{name, light, dark}] */
function rules(sets, lightSel, darkSel) {
  const light = sets.map((s) => decls(s.name, s.light) + (s.extraLight ? '\n' + s.extraLight : '')).join('\n');
  const dark = sets.map((s) => decls(s.name, s.dark) + (s.extraDark ? '\n' + s.extraDark : '')).join('\n');
  return block(lightSel, light) + block(darkSel, dark);
}

// Colours inside data-URIs cannot use var(), so they are precomputed per group (Spike B)
const uri = (svg) => `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
const NS = "xmlns='http://www.w3.org/2000/svg'";
const switchFocus = (fill) => uri(`<svg ${NS} viewBox='-4 -4 8 8'><circle r='3' fill='${fill}'/></svg>`);
const chevronLight = (stroke) => uri(`<svg ${NS} viewBox='0 0 16 16' fill='none' stroke='${stroke}' stroke-linecap='round' stroke-linejoin='round'><path d='m2 5 6 6 6-6'/></svg>`);
const chevronDark = (fill) => uri(`<svg ${NS} viewBox='0 0 16 16' fill='${fill}'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>`);

const validIcon = (fill) => uri(`<svg ${NS} viewBox='0 0 8 8'><path fill='${fill}' d='M2.3 6.73.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1'/></svg>`);
const invalidIcon = (c) => uri(`<svg ${NS} viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='${c}'><circle cx='6' cy='6' r='4.5'/><path stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/><circle cx='6' cy='8.2' r='.6' fill='${c}' stroke='none'/></svg>`);
const sharedExtra = { success: (c) => `  --jjjei-success-valid-icon: ${validIcon(c.light.base)};`, danger: (c) => `  --jjjei-danger-invalid-icon: ${invalidIcon(c.light.base)};` };

// a group sets only the primary colour; its department base-background helper and icons are group specific too
const groupSet = (c) => ({
  name: 'primary', light: c.light, dark: c.dark,
  extraLight: `  --jjjei-primary-base-bg: ${c.baseBg.light};\n  --jjjei-primary-switch-focus: ${switchFocus(c.light.focusBorder)};\n  --jjjei-primary-accordion-icon: ${chevronLight(c.light.emphasis)};`,
  extraDark: `  --jjjei-primary-base-bg: ${c.baseBg.dark};\n  --jjjei-primary-accordion-icon: ${chevronDark(c.dark.emphasis)};`,
});

function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }

export function emitColors({ groups, system, status }, colors, outDir, version = '0.0.0') {
  fs.rmSync(outDir, { recursive: true, force: true });
  const gdir = path.join(outDir, 'groups');
  fs.mkdirSync(gdir, { recursive: true });
  const slugs = Object.keys(groups);
  const shared = Object.keys(colors).filter((n) => colors[n].kind !== 'group');

  const base = `/* JJJEI colour tokens: system and status colours (same for every group) */\n` +
    rules(shared.map((n) => ({ name: n, ...colors[n], extraLight: sharedExtra[n]?.(colors[n]) })), ':root', DARK);
  fs.writeFileSync(path.join(outDir, 'base.css'), base);

  for (const slug of slugs) {
    const g = groups[slug];
    const head = `/* ${slug}: ${g.department}${g.label ? ' / ' + g.label : ''} (v1: ${g.legacyId}) */\n`;
    const body = rules([groupSet(colors[slug])], ':root', DARK);
    fs.writeFileSync(path.join(gdir, `${slug}.css`), head + body);
    fs.writeFileSync(path.join(outDir, `${slug}.css`), base + head + body); // one-link bundle
  }

  // all.css: every group scoped by [data-jjjei-group], so one file can switch departments at runtime
  const scoped = slugs.map((slug) => {
    const sel = `[data-jjjei-group="${slug}"]`;
    const set = groupSet(colors[slug]);
    return block(sel, decls('primary', set.light) + '\n' + set.extraLight) +
      block(`${sel}${DARK_IS}, ${DARK_IS} ${sel}`, decls('primary', set.dark) + '\n' + set.extraDark);
  });
  fs.writeFileSync(path.join(outDir, 'all.css'), `/* all groups, selected with data-jjjei-group="<slug>" (use with base.css) */\n` + scoped.join(''));

  // JSON / JS / Sass projections of the same computed set
  const flat = {
    version,
    groups: Object.fromEntries(slugs.map((s) => [s, { ...groups[s], ...colors[s], kind: undefined }])),
    system: Object.fromEntries(Object.keys(system).map((n) => [n, { hex: system[n], ...colors[n], kind: undefined }])),
    status: Object.fromEntries(Object.entries(status).map(([n, s]) => [`status-${n}`, { hex: s.hex, meaning: s.meaning, ...colors[`status-${n}`], kind: undefined }])),
  };
  const flatJson = JSON.parse(JSON.stringify(flat)); // drops the undefined `kind`
  writeJson(path.join(outDir, 'tokens.flat.json'), flatJson);

  // W3C Design Tokens (DTCG) draft format
  const tok = (v, d) => ({ $type: 'color', $value: v, ...(d ? { $description: d } : {}) });
  const dtcgColor = (c, desc) => ({
    ...Object.fromEntries(Object.entries(c.light).filter(([k]) => k !== 'rgb' && k !== 'focusRgb').map(([k, v]) => [kebab(k), tok(v, k === 'base' ? desc : undefined)])),
    dark: Object.fromEntries(Object.entries(c.dark).map(([k, v]) => [kebab(k), tok(v)])),
  });
  writeJson(path.join(outDir, 'tokens.json'), {
    group: Object.fromEntries(slugs.map((s) => [s, dtcgColor(colors[s], groups[s].label ?? groups[s].department)])),
    system: Object.fromEntries(Object.keys(system).map((n) => [n, dtcgColor(colors[n])])),
    status: Object.fromEntries(Object.keys(status).map((n) => [n, dtcgColor(colors[`status-${n}`], status[n].meaning)])),
  });

  fs.writeFileSync(path.join(outDir, 'tokens.mjs'),
    `// generated: computed colour tokens\nexport const version = ${JSON.stringify(version)};\nexport const groups = ${JSON.stringify(flatJson.groups, null, 2)};\nexport const system = ${JSON.stringify(flatJson.system, null, 2)};\nexport const status = ${JSON.stringify(flatJson.status, null, 2)};\n`);
  const roleKeys = (o) => Object.keys(o).map((k) => `  ${k}: string;`).join('\n');
  const first = colors[slugs[0]];
  fs.writeFileSync(path.join(outDir, 'tokens.d.ts'),
    `// generated\nexport type GroupSlug = ${slugs.map((s) => `'${s}'`).join(' | ')};\nexport type StatusName = ${Object.keys(status).map((n) => `'status-${n}'`).join(' | ')};\n` +
    `export interface LightRoles {\n${roleKeys(first.light)}\n}\nexport interface DarkRoles {\n${roleKeys(first.dark)}\n}\n` +
    `export interface ColorTokens { hex: string; light: LightRoles; dark: DarkRoles; }\n` +
    `export interface GroupTokens extends ColorTokens { label: string | null; department: string; legacyId: string; status: 'active' | 'deprecated'; baseBg: { light: string; dark: string }; }\n` +
    `export const version: string;\nexport const groups: Record<GroupSlug, GroupTokens>;\nexport const system: Record<string, ColorTokens>;\nexport const status: Record<StatusName, ColorTokens & { meaning: string | null }>;\n`);

  const sv = (x) => (/^#/.test(x) ? x : `"${x}"`); // hex stays a Sass colour, "r, g, b" strings are quoted
  const smap = (m) => `(${Object.entries(m).map(([r, x]) => `"${kebab(r)}": ${sv(x)}`).join(', ')})`;
  const scssMap = (o) => '(\n' + Object.entries(o).map(([k, v]) => `  "${k}": (\n    "light": ${smap(v.light)},\n    "dark": ${smap(v.dark)}\n  )`).join(',\n') + '\n)';
  fs.writeFileSync(path.join(outDir, '_tokens.scss'),
    `// generated: use with @use "tokens" as t; map.get(t.$groups, "jjjei_admin-0", "light", "subtle")\n$groups: ${scssMap(flatJson.groups)};\n$system: ${scssMap(flatJson.system)};\n$status: ${scssMap(flatJson.status)};\n`);
  return { files: fs.readdirSync(outDir).length + slugs.length };
}
