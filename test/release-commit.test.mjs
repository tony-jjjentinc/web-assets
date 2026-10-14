import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRelease, promoteLatest, publishNext } from '../src/release/release-commit.mjs';

const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let remote, work;

const fakeDist = (version) => {
  fs.mkdirSync(`${work}/dist/colors`, { recursive: true });
  fs.writeFileSync(`${work}/dist/manifest.json`, JSON.stringify({ version, prerelease: version.includes('-') }));
  fs.writeFileSync(`${work}/dist/colors/base.css`, `/* ${version} */`);
};
const commitMain = (msg) => { fs.writeFileSync(`${work}/src.txt`, msg); sh(work, 'add', 'src.txt', '.gitignore'); sh(work, 'commit', '-m', msg); sh(work, 'push', 'origin', 'main'); };

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  remote = `${root}/remote.git`; work = `${root}/work`;
  sh(root, 'init', '--bare', '-b', 'main', remote);
  sh(root, 'clone', remote, work);
  for (const [k, v] of [['user.name', 't'], ['user.email', 't@t']]) sh(work, 'config', k, v);
  fs.writeFileSync(`${work}/.gitignore`, 'dist\n'); // like the real repo: dist is not tracked on main
  commitMain('init');
});

describe('release commits', () => {
  it('tags a commit that holds dist/, while main never does', () => {
    fakeDist('1.0.0');
    const { tag, commit } = createRelease({ version: '1.0.0', cwd: work, push: true });
    expect(sh(remote, 'rev-parse', `${tag}^{commit}`)).toBe(commit);
    expect(sh(remote, 'ls-tree', '-r', '--name-only', tag)).toContain('dist/manifest.json');
    expect(sh(remote, 'ls-tree', '-r', '--name-only', 'main')).not.toContain('dist/');
    expect(sh(work, 'status', '--porcelain')).toBe(''); // working tree and index untouched
  });
  it('refuses stale dist, existing tags and a missing build', () => {
    expect(() => createRelease({ version: '1.0.0', cwd: work })).toThrow(/npm run build/);
    fakeDist('1.0.0');
    expect(() => createRelease({ version: '1.1.0', cwd: work })).toThrow(/rebuild/);
    createRelease({ version: '1.0.0', cwd: work, push: true });
    expect(() => createRelease({ version: '1.0.0', cwd: work, push: true })).toThrow(/already exists/);
  });
  it('latest only fast-forwards, across releases, without force', () => {
    fakeDist('1.0.0'); createRelease({ version: '1.0.0', cwd: work, push: true }); promoteLatest({ version: '1.0.0', cwd: work, push: true });
    const first = sh(remote, 'rev-parse', 'latest');
    commitMain('feat: more'); fakeDist('1.1.0');
    createRelease({ version: '1.1.0', cwd: work, push: true }); promoteLatest({ version: '1.1.0', cwd: work, push: true });
    expect(sh(remote, 'rev-parse', 'latest')).toBe(sh(remote, 'rev-parse', 'v1.1.0^{commit}'));
    expect(() => sh(remote, 'merge-base', '--is-ancestor', first, 'latest')).not.toThrow();
    expect(promoteLatest({ version: '1.1.0', cwd: work, push: true }).changed).toBe(false); // idempotent
  });
  it('refuses a non-fast-forward latest unless forced', () => {
    fakeDist('1.0.0'); createRelease({ version: '1.0.0', cwd: work, push: true });
    sh(work, 'update-ref', 'refs/heads/latest', sh(work, 'commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'unrelated')); // empty tree: shares no history
    expect(() => promoteLatest({ version: '1.0.0', cwd: work })).toThrow(/non-fast-forward/);
    expect(promoteLatest({ version: '1.0.0', cwd: work, force: true }).changed).toBe(true);
  });
  it('prereleases are tagged but never touch latest', () => {
    fakeDist('2.0.0-rc.1');
    createRelease({ version: '2.0.0-rc.1', cwd: work, push: true });
    expect(sh(remote, 'tag', '-l')).toContain('v2.0.0-rc.1');
    expect(() => promoteLatest({ version: '2.0.0-rc.1', cwd: work })).toThrow(/prerelease/);
    expect(sh(remote, 'branch', '-l')).not.toContain('latest');
  });
  it('next is a force-updated branch with dist and no tag', () => {
    fakeDist('1.0.0'); publishNext({ cwd: work, push: true });
    commitMain('feat: x'); fakeDist('1.0.1'); publishNext({ cwd: work, push: true });
    expect(sh(remote, 'show', 'next:dist/manifest.json')).toContain('1.0.1');
    expect(sh(remote, 'tag', '-l')).toBe('');
  });
});

describe('placeholder version', () => {
  it('0.0.0 can never be released', () => {
    fakeDist('0.0.0');
    expect(() => createRelease({ version: '0.0.0', cwd: work })).toThrow(/placeholder/);
  });
});
