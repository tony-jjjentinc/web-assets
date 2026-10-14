import crypto from 'node:crypto';

const sri = (buf) => 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
export const cdnUrl = (slug, ref, file) => `https://cdn.jsdelivr.net/gh/${slug}@${ref}/dist/${file}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/** Ask jsDelivr to drop its cached copy of every file under <ref> (only the mutable refs, `latest` and `next`, need it). */
export async function purge({ slug, ref, files, fetch = globalThis.fetch, concurrency = 8 }) {
  const res = await pool(files, concurrency, async (f) => {
    try { return (await fetch(`https://purge.jsdelivr.net/gh/${slug}@${ref}/dist/${f}`)).ok ? null : f; } catch { return f; }
  });
  const failed = res.filter(Boolean);
  return { purged: files.length - failed.length, failed };
}

async function getJson(fetch, url, retries, delayMs) {
  let last;
  for (let a = 0; a <= retries; a++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); last = `HTTP ${r.status}`; } catch (e) { last = String(e.message ?? e); }
    if (a < retries) await sleep(delayMs);
  }
  throw new Error(`${url}: ${last}`);
}

/**
 * Check what jsDelivr really serves for a release: the exact tag (manifest + every file's SRI) and, for stable
 * releases, that `@latest` has moved. Range URLs are only reported (INFO); nothing depends on them.
 */
export async function verify({ slug, version, fetch = globalThis.fetch, retries = 6, delayMs = 10000, checkLatest = true, sample = Infinity, concurrency = 8 }) {
  const checks = [];
  const add = (name, status, detail = '') => checks.push({ name, status, detail });
  const tag = `v${version}`;
  let manifest;
  try {
    manifest = await getJson(fetch, cdnUrl(slug, tag, 'manifest.json'), retries, delayMs);
    add('exact tag serves manifest.json (tag-only commit is reachable)', manifest.version === version ? 'PASS' : 'FAIL', `version ${manifest.version}`);
  } catch (e) { add('exact tag serves manifest.json (tag-only commit is reachable)', 'FAIL', e.message); return checks; }

  const files = manifest.files.slice(0, sample);
  const bad = (await pool(files, concurrency, async (f) => {
    try { const r = await fetch(cdnUrl(slug, tag, f.path)); if (!r.ok) return `${f.path}: HTTP ${r.status}`; return sri(Buffer.from(await r.arrayBuffer())) === f.sri ? null : `${f.path}: SRI mismatch`; } catch (e) { return `${f.path}: ${e.message}`; }
  })).filter(Boolean);
  add(`${files.length} files match their SRI hashes`, bad.length ? 'FAIL' : 'PASS', bad.slice(0, 5).join('; '));

  if (checkLatest && !manifest.prerelease) {
    try {
      const m = await getJson(fetch, cdnUrl(slug, 'latest', 'manifest.json'), retries, delayMs);
      add('@latest serves this release', m.version === version ? 'PASS' : 'FAIL', `latest is ${m.version}`);
    } catch (e) { add('@latest serves this release', 'FAIL', e.message); }
  }
  const [maj, min] = version.split('.');
  for (const ref of [maj, `${maj}.${min}`]) {
    try { add(`range @${ref} (informational, not relied on)`, 'INFO', `resolves to ${(await getJson(fetch, cdnUrl(slug, ref, 'manifest.json'), 0, 0)).version}`); } catch (e) { add(`range @${ref} (informational, not relied on)`, 'INFO', `not served: ${e.message}`); }
  }
  return checks;
}
