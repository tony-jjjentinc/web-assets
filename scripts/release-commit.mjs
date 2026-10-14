// node scripts/release-commit.mjs create|promote --version X.Y.Z [--push]   |   node scripts/release-commit.mjs next [--push]
import { createRelease, promoteLatest, publishNext } from '../src/release/release-commit.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(`--${n}`);
const val = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const log = (m) => console.log(m);
try {
  const opts = { push: flag('push'), log };
  if (cmd === 'create') createRelease({ version: val('version'), ...opts });
  else if (cmd === 'promote') promoteLatest({ version: val('version'), force: flag('force'), ...opts });
  else if (cmd === 'next') publishNext(opts);
  else throw new Error('usage: release-commit.mjs create|promote --version X.Y.Z [--push] | next [--push]');
} catch (e) { console.error(`release failed: ${e.message}`); process.exit(1); }
