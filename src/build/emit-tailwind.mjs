import fs from 'node:fs';
import path from 'node:path';
import { compileScss } from './emit-bootstrap.mjs';

// Tailwind colour key suffix -> --jjjei-<colour> variable suffix. Names match the Bootstrap-mode classes (bg-primary-subtle, text-primary-emphasis, ...).
const ROLES = [['', ''], ['-subtle', '-subtle'], ['-border-subtle', '-border-subtle'], ['-emphasis', '-emphasis'], ['-contrast', '-contrast'],
  ['-hover', '-hover-bg'], ['-active', '-active-bg'], ['-faint', '-faint'], ['-shaded', '-shaded'], ['-body', '-body'], ['-body-border', '-body-border']];
const GROUP_ONLY = [['-base', '-base-bg']]; // the department background helper only exists for the group colour

const DARK_SELECTORS = ['[data-bs-theme="dark"]', '[data-theme="dark"]', '.dark'];
// descendants must match too: `.dark *` alone misses children of <html data-bs-theme="dark"> (Spike C)
const darkMatch = DARK_SELECTORS.flatMap((s) => [s, `${s} *`]).join(', ');

export const colourNames = ({ system, status }) => ['primary', ...Object.keys(system), ...Object.keys(status).map((n) => `status-${n}`)];

export function themeCss(names, prefix = '') {
  const lines = [];
  for (const n of names) {
    for (const [k, v] of [...ROLES, ...(n === 'primary' ? GROUP_ONLY : [])]) lines.push(`  --color-${prefix}${n}${k}: var(--jjjei-${n}${v});`);
  }
  return `/* JJJEI colours for Tailwind v4: utilities read the live --jjjei-* variables, so switching group needs no rebuild.\n   Use with colours/groups/<group>.css (or a bundle) for the values. */\n@theme inline {\n${lines.join('\n')}\n}\n`;
}

const darkVariant = `/* optional: make dark: follow data-bs-theme, data-theme and .dark (children included) */\n@custom-variant dark (&:where(${darkMatch}));\n`;

function presetSource(names, esm) {
  const colours = Object.fromEntries(names.map((n) => {
    const o = { DEFAULT: `rgb(var(--jjjei-${n}-rgb) / <alpha-value>)` };
    for (const [k, v] of [...ROLES.slice(1), ...(n === 'primary' ? GROUP_ONLY : [])]) o[k.slice(1)] = `var(--jjjei-${n}${v})`;
    return [n, o];
  }));
  const body = `{\n  // dark: follows data-bs-theme, data-theme and .dark (needs Tailwind >= 3.4.1)\n  darkMode: ['variant', ${JSON.stringify(DARK_SELECTORS.map((s) => `&:where(${s}, ${s} *)`))}],\n  theme: { extend: { colors: ${JSON.stringify(colours, null, 2).replace(/\n/g, '\n  ')} } },\n}`;
  return `// generated. Only the base colour supports opacity modifiers (bg-primary/50); the role colours are plain variables.\n` + (esm ? `export default ${body};\n` : `module.exports = ${body};\n`);
}

export function emitTailwind(tokens, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const names = colourNames(tokens);
  for (const d of ['v4', 'v3']) fs.mkdirSync(path.join(outDir, d), { recursive: true });
  const w = (f, c) => fs.writeFileSync(path.join(outDir, f), c);
  w('v4/theme.css', themeCss(names));
  w('v4/theme.prefixed.css', themeCss(names, 'jj-')); // jj-primary: coexists with Bootstrap's bg-primary
  w('v4/dark-variant.css', darkVariant);
  w('v3/preset.cjs', presetSource(names, false));
  w('v3/preset.mjs', presetSource(names, true));
  w('extras.css', compileScss('extras.scss', tokens));
}
