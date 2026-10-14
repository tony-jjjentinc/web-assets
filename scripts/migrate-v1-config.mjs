// One-off: v1 config/*.json (+ hub labels) -> v2 tokens/*.json. Run: node scripts/migrate-v1-config.mjs [v1Dir] [hubDir]
import fs from 'node:fs';
const v1 = process.argv[2] ?? '../assets_v1';
const hub = process.argv[3] ?? '../designHub_v1';
const rd = (f) => JSON.parse(fs.readFileSync(`${v1}/config/${f}`, 'utf8'));
const wr = (f, o) => fs.writeFileSync(`tokens/${f}`, JSON.stringify(o, null, 2) + '\n');
const slug = (id) => id.replace(':', '-');
// decision Q17: these two v1 variants were never labelled and 5a duplicated 6; they have no v2 equivalent
export const DROPPED = ['jjjei_facilities:1a', 'jjjei_facilities:5a'];

// labels live only in the hub's colorMapping.ts: "Dept": { "Label": "jjjei_x:N.css", ... }
const labels = {}, depts = {};
let dept;
for (const line of fs.readFileSync(`${hub}/src/config/colorMapping.ts`, 'utf8').split('\n')) {
  const d = line.match(/^\s*"([^"]+)":\s*\{\s*$/);
  if (d) { dept = d[1]; continue; }
  const m = line.match(/^\s*"([^"]+)"\s*:\s*"(jjjei_[a-z]+:[0-9a-z]+)\.css"/);
  if (m && dept) { labels[m[2]] = m[1]; depts[m[2]] = dept; }
}
const groups = {};
for (const [id, hex] of Object.entries(rd('groupColors.json')).filter(([id]) => !DROPPED.includes(id))) {
  groups[slug(id)] = { hex, label: labels[id] ?? null, department: depts[id] ?? id.split(':')[0].replace('jjjei_', ''), legacyId: id, status: 'active' };
}
wr('groups.json', groups);

wr('system.json', rd('systemColors.json'));

const meanings = {};
for (const m of fs.readFileSync(`${hub}/src/config/statusConfig.ts`, 'utf8').matchAll(/class:\s*"status-(\d)",\s*meaning:\s*"([^"]*)"/g)) meanings[m[1]] = m[2];
const status = {};
for (const [k, hex] of Object.entries(rd('statusColors.json'))) status[k] = { hex, meaning: meanings[k] ?? null };
wr('status.json', status);

// design: drop comments; font-face-url is replaced by the Phase 5 fonts pipeline (relative URLs)
const design = Object.fromEntries(Object.entries(rd('designTokens.json')).filter(([k]) => !k.startsWith('_comment') && k !== 'font-face-url'));
// weights v1 hard-coded in generator.py (shaded/faint/gradient utilities) become real tokens
// v1 stored these as strings
design['min-contrast-ratio'] = Number(design['min-contrast-ratio']);
design['enable-shadows'] = design['enable-shadows'] === 'true';
design['gradient-tint-weight'] = 75;
design['dark-emphasis-tint-weight'] = 40; // Bootstrap's $*-text-emphasis-dark
design['light-emphasis-shade-weight'] = 60; // Bootstrap's $*-text-emphasis
design['accessible-shade-start'] = 40; // v1 find_accessible_shade start (parity mode)
wr('design.json', design);

wr('loaders.json', rd('loaders.json'));
wr('patterns.json', rd('backgroundPatterns.json'));
console.log(`groups=${Object.keys(groups).length} unlabeled=${Object.values(groups).filter((g) => !g.label).map((g) => g.legacyId)}`);
