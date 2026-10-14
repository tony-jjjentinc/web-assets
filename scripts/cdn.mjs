// node scripts/cdn.mjs purge --ref latest|next [--repo owner/repo]
// node scripts/cdn.mjs verify --version X.Y.Z [--repo owner/repo] [--sample N] [--no-latest]
import fs from 'node:fs';
import { purge, verify } from '../src/release/cdn.mjs';
import { repoSlug } from '../src/build/repo.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const val = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const slug = val('repo') ?? repoSlug();
if (!slug) { console.error('unknown repository: pass --repo owner/repo'); process.exit(1); }

if (cmd === 'purge') {
  const files = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8')).files.map((f) => f.path).concat('manifest.json');
  const r = await purge({ slug, ref: val('ref') ?? 'latest', files });
  console.log(`purged ${r.purged}/${files.length} (${val('ref') ?? 'latest'})`);
  if (r.failed.length) { console.error('failed:', r.failed.slice(0, 10).join(', ')); process.exit(1); }
} else if (cmd === 'verify') {
  const checks = await verify({ slug, version: val('version'), sample: val('sample') ? Number(val('sample')) : Infinity, checkLatest: !rest.includes('--no-latest') });
  for (const c of checks) console.log(`${c.status.padEnd(4)} ${c.name}${c.detail ? ' - ' + c.detail : ''}`);
  if (checks.some((c) => c.status === 'FAIL')) process.exit(1);
} else { console.error('usage: cdn.mjs purge --ref latest|next | verify --version X.Y.Z'); process.exit(1); }
