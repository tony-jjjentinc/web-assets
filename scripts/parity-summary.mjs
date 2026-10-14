import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2] ?? 'build/parity.json', 'utf8'));
const only = process.argv[3]; // optional "slug|mode"
const names = ['jjjei-primary', 'jjjei-secondary', 'primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark', ...Array.from({ length: 10 }, (_, i) => `status-${i}`)].sort((a, b) => b.length - a.length);
const pat = (el) => { let p = el; for (const n of names) p = p.replace(new RegExp(`(^|-)${n}(?=-|$)`, 'g'), '$1{N}'); return p; };
for (const [key, v] of Object.entries(r)) {
  if (only && key !== only) continue;
  const g = new Map();
  for (const d of v.diffs) { const k = `${pat(d.el)} | ${d.state || '-'} | ${d.prop}`; const e = g.get(k) ?? { n: 0, ex: d }; e.n++; g.set(k, e); }
  console.log(`\n## ${key}: ${v.diffs.length} diffs in ${g.size} patterns`);
  for (const [k, e] of [...g].sort((a, b) => b[1].n - a[1].n)) console.log(String(e.n).padStart(3), k.padEnd(52), `[${e.ex.el}]`, e.ex.v1.slice(0, 48), '=>', e.ex.v2.slice(0, 48));
}
