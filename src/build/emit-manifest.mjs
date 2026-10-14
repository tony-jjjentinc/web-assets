import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { repoSlug, cdnBase } from './repo.mjs';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const unique = (a) => [...new Set(a)].sort();
const pkgVersion = (name) => JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`, 'utf8')).version;

/**
 * dist/manifest.json: everything a doc page or the hub needs to describe this release, with an SRI hash per file.
 * Written last (it cannot hash itself). `slug` is "owner/repo" or null when unknown.
 */
export function emitManifest(tokens, distDir, { version, slug = repoSlug(), contrast } = {}) {
  const files = walk(distDir).map((f) => path.relative(distDir, f)).filter((f) => f !== 'manifest.json').sort().map((rel) => {
    const buf = fs.readFileSync(path.join(distDir, rel));
    return { path: rel, bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, sri: 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64') };
  });
  const css = (rel) => fs.readFileSync(path.join(distDir, rel), 'utf8');
  const classes = unique([...css('bootstrap/core.css').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c)));
  const variables = unique(files.filter((f) => f.path.startsWith('colors/') && f.path.endsWith('.css')).flatMap((f) => [...css(f.path).matchAll(/(--jjjei-[a-z0-9-]+)\s*:/g)].map((m) => m[1])));
  const manifest = {
    name: 'jjjei-assets',
    version,
    prerelease: version.includes('-'),
    cdnBase: slug ? cdnBase(slug, `v${version}`) : null,
    bootstrap: pkgVersion('bootstrap'), // built and tested against this version
    bootstrapSupported: '5.3.x', // decision Q22
    tailwind: { v3: pkgVersion('tailwindcss3'), v4: pkgVersion('tailwindcss') },
    groups: Object.entries(tokens.groups).map(([slug, g]) => ({ slug, hex: g.hex, label: g.label, department: g.department, status: g.status, legacyId: g.legacyId })),
    contrastExceptions: contrast?.allowed.length ?? null,
    classes,
    variables,
    files,
  };
  fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}
