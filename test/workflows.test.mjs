import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const wf = fs.readdirSync('.github/workflows').map((f) => [f, fs.readFileSync(`.github/workflows/${f}`, 'utf8')]);

describe('workflows only call things that exist', () => {
  it('npm scripts', () => {
    for (const [f, text] of wf) for (const m of text.matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts[m[1]], `${f}: npm run ${m[1]}`).toBeTruthy();
  });
  it('node scripts and subcommands', () => {
    for (const [f, text] of wf) for (const m of text.matchAll(/node (scripts\/[\w.-]+)/g)) expect(fs.existsSync(m[1]), `${f}: ${m[1]}`).toBe(true);
    const rc = fs.readFileSync('scripts/release-commit.mjs', 'utf8'), cdn = fs.readFileSync('scripts/cdn.mjs', 'utf8');
    for (const [, text] of wf) {
      for (const m of text.matchAll(/release-commit\.mjs (\w+)/g)) expect(rc).toContain(`'${m[1]}'`);
      for (const m of text.matchAll(/cdn\.mjs (\w+)/g)) expect(cdn).toContain(`'${m[1]}'`);
    }
  });
  it('the release workflow never publishes the 0.0.0 placeholder and only touches latest for stable versions', () => {
    const r = fs.readFileSync('.github/workflows/release.yml', 'utf8');
    expect(r).toContain('placeholder');
    expect(r.match(/pre == 'false'/g).length).toBeGreaterThanOrEqual(2);
  });
  it('release-please never creates the tag itself (the tag must point at the commit holding dist/)', () => {
    const c = JSON.parse(fs.readFileSync('release-please-config.json', 'utf8'));
    expect(c.packages['.']['skip-github-release']).toBe(true);
    expect(JSON.parse(fs.readFileSync('.release-please-manifest.json', 'utf8'))['.']).toBe(pkg.version);
  });
});

describe('repository hygiene', () => {
  it('.gitignore ignores the output directories only at the root (src/build must be committed)', () => {
    const ignore = fs.readFileSync('.gitignore', 'utf8').split('\n');
    expect(ignore).toContain('/build/');
    expect(ignore).toContain('/dist/');
    expect(ignore).not.toContain('build/');
  });
});

describe('licence', () => {
  it('a LICENSE exists, covers Inter and Bootstrap-derived icons, and travels in the release zip', () => {
    const l = fs.readFileSync('LICENSE', 'utf8');
    expect(l).toMatch(/All rights reserved/);
    expect(l).toMatch(/SIL Open Font License/);
    expect(l).toMatch(/Bootstrap/);
    expect(pkg.license).toBe('SEE LICENSE IN LICENSE');
    expect(fs.readFileSync('src/build/index.mjs', 'utf8')).toContain("copyFileSync('LICENSE', 'dist/LICENSE')");
  });
});
