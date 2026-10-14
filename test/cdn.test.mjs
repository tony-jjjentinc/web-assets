import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { purge, verify } from '../src/release/cdn.mjs';

const sri = (s) => 'sha384-' + crypto.createHash('sha384').update(s).digest('base64');
const FILES = { 'colors/base.css': 'a{}', 'bootstrap/core.css': 'b{}' };
const manifestFor = (version) => ({ version, prerelease: version.includes('-'), files: Object.entries(FILES).map(([path, c]) => ({ path, sri: sri(c) })) });
const res = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, arrayBuffer: async () => Buffer.from(body) });

// a fake jsDelivr: refs -> { manifest, files }
const cdn = (refs, calls = []) => async (url) => {
  calls.push(url);
  const m = url.match(/gh\/o\/r@([^/]+)\/dist\/(.+)$/);
  if (url.startsWith('https://purge.')) return res('{}');
  const r = m && refs[m[1]];
  if (!r) return res('', false, 404);
  return m[2] === 'manifest.json' ? res(r.manifest) : r.files[m[2]] !== undefined ? res(r.files[m[2]]) : res('', false, 404);
};
const ok = (v) => ({ manifest: manifestFor(v), files: FILES });
const opts = { slug: 'o/r', retries: 1, delayMs: 0 };
const status = (checks, text) => checks.find((c) => c.name.includes(text))?.status;

describe('verify', () => {
  it('passes a stable release that jsDelivr serves correctly', async () => {
    const checks = await verify({ ...opts, version: '2.1.0', fetch: cdn({ 'v2.1.0': ok('2.1.0'), latest: ok('2.1.0') }) });
    expect(checks.filter((c) => c.status === 'FAIL')).toEqual([]);
    expect(status(checks, 'SRI')).toBe('PASS');
  });
  it('fails when a file differs from the manifest (tampered or stale CDN copy)', async () => {
    const bad = { ...ok('2.1.0'), files: { ...FILES, 'colors/base.css': 'evil{}' } };
    const checks = await verify({ ...opts, version: '2.1.0', fetch: cdn({ 'v2.1.0': bad, latest: ok('2.1.0') }) });
    expect(status(checks, 'SRI')).toBe('FAIL');
    expect(checks.find((c) => c.status === 'FAIL').detail).toContain('colors/base.css');
  });
  it('fails when the tag is not served at all (tag-only commit not reachable)', async () => {
    const checks = await verify({ ...opts, version: '2.1.0', fetch: cdn({}) });
    expect(status(checks, 'exact tag')).toBe('FAIL');
  });
  it('fails when @latest still points at the previous release', async () => {
    const checks = await verify({ ...opts, version: '2.1.0', fetch: cdn({ 'v2.1.0': ok('2.1.0'), latest: ok('2.0.0') }) });
    expect(status(checks, '@latest')).toBe('FAIL');
  });
  it('skips @latest for prereleases and only reports ranges', async () => {
    const checks = await verify({ ...opts, version: '2.2.0-rc.1', fetch: cdn({ 'v2.2.0-rc.1': ok('2.2.0-rc.1') }) });
    expect(status(checks, '@latest')).toBeUndefined();
    expect(checks.filter((c) => c.name.startsWith('range')).every((c) => c.status === 'INFO')).toBe(true);
  });
  it('retries while the CDN catches up', async () => {
    let n = 0; const inner = cdn({ 'v2.1.0': ok('2.1.0'), latest: ok('2.1.0') });
    const flaky = async (u) => (u.endsWith('v2.1.0/dist/manifest.json') && n++ < 1 ? res('', false, 404) : inner(u));
    expect(status(await verify({ ...opts, version: '2.1.0', fetch: flaky }), 'exact tag')).toBe('PASS');
  });
});

describe('purge', () => {
  it('purges every file and reports the ones that failed', async () => {
    const calls = [];
    const fetch = async (u) => { calls.push(u); return u.endsWith('core.css') ? res('', false, 500) : res('{}'); };
    const r = await purge({ slug: 'o/r', ref: 'latest', files: ['colors/base.css', 'bootstrap/core.css'], fetch });
    expect(calls).toContain('https://purge.jsdelivr.net/gh/o/r@latest/dist/colors/base.css');
    expect(r).toEqual({ purged: 1, failed: ['bootstrap/core.css'] });
  });
});
