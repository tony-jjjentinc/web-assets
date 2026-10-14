import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// `dist/` never lives on main. A release is a commit holding main's tree plus dist/, tagged vX.Y.Z; the tag is
// what jsDelivr serves. The commit has main's tip as first parent and the previous `latest` as second, so
// `latest` only ever fast-forwards (no force pushes).

const git = (cwd, args, env = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (cwd, args) => { try { return git(cwd, args); } catch { return null; } };

function dist(cwd, distDir) {
  const f = path.join(cwd, distDir, 'manifest.json');
  if (!fs.existsSync(f)) throw new Error(`${distDir}/manifest.json is missing: run "npm run build" first`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Commit = HEAD's tree + dist/, built in a temporary index so the working tree and the real index are untouched. */
function commitWithDist(cwd, distDir, message, parents) {
  const gitDir = path.resolve(cwd, git(cwd, ['rev-parse', '--git-dir']));
  const index = path.join(gitDir, 'release-index');
  const env = { GIT_INDEX_FILE: index };
  try {
    git(cwd, ['read-tree', 'HEAD'], env);
    git(cwd, ['add', '-f', '--', distDir], env);
    const tree = git(cwd, ['write-tree'], env);
    return git(cwd, ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-m', message]);
  } finally { fs.rmSync(index, { force: true }); }
}

const lineage = (cwd, branch, remote) => tryGit(cwd, ['rev-parse', '-q', '--verify', `refs/remotes/${remote}/${branch}^{commit}`]) ?? tryGit(cwd, ['rev-parse', '-q', '--verify', `refs/heads/${branch}^{commit}`]);

/** Create (and optionally push) the tagged release commit for the version in dist/manifest.json. */
export function createRelease({ version, cwd = process.cwd(), distDir = 'dist', push = false, remote = 'origin', log = () => {} }) {
  if (version === '0.0.0') throw new Error('0.0.0 is the placeholder version: cut a real release through the release PR');
  const m = dist(cwd, distDir);
  if (m.version !== version) throw new Error(`dist/ was built for ${m.version}, not ${version}: rebuild before releasing`);
  const tag = `v${version}`;
  if (tryGit(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) throw new Error(`tag ${tag} already exists`);
  if (push && git(cwd, ['ls-remote', '--tags', remote, `refs/tags/${tag}`])) throw new Error(`tag ${tag} already exists on ${remote}`);
  const parents = [git(cwd, ['rev-parse', 'HEAD'])];
  if (!m.prerelease) { const prev = lineage(cwd, 'latest', remote); if (prev) parents.push(prev); } // prereleases stay out of latest's history
  const commit = commitWithDist(cwd, distDir, `release: ${tag}`, parents);
  git(cwd, ['tag', '-a', tag, commit, '-m', `Release ${tag}`]);
  log(`created ${tag} -> ${commit}`);
  if (push) { git(cwd, ['push', remote, `refs/tags/${tag}`]); log(`pushed ${tag} to ${remote}`); }
  return { tag, commit, prerelease: m.prerelease };
}

/** Fast-forward the `latest` branch to the tagged release (stable only). Idempotent. */
export function promoteLatest({ version, cwd = process.cwd(), push = false, remote = 'origin', force = false, log = () => {} }) {
  const tag = `v${version}`;
  if (version.includes('-')) throw new Error(`${tag} is a prerelease and never becomes latest`);
  const commit = tryGit(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`]);
  if (!commit) throw new Error(`tag ${tag} does not exist locally`);
  const prev = lineage(cwd, 'latest', remote);
  if (prev === commit) { log(`latest is already ${tag}`); return { commit, changed: false }; }
  if (prev && !force && tryGit(cwd, ['merge-base', '--is-ancestor', prev, commit]) === null) throw new Error(`latest (${prev}) is not an ancestor of ${tag}; refusing a non-fast-forward update`);
  git(cwd, ['update-ref', 'refs/heads/latest', commit]);
  if (push) { git(cwd, ['push', ...(force ? ['--force'] : []), remote, `${commit}:refs/heads/latest`]); log(`latest -> ${tag}`); }
  return { commit, changed: true };
}

/** A disposable `next` branch holding the current main + dist (force-updated, never tagged). */
export function publishNext({ cwd = process.cwd(), distDir = 'dist', push = false, remote = 'origin', log = () => {} }) {
  const m = dist(cwd, distDir);
  const head = git(cwd, ['rev-parse', 'HEAD']);
  const commit = commitWithDist(cwd, distDir, `next: ${m.version} @ ${head.slice(0, 7)}`, [head]);
  git(cwd, ['update-ref', 'refs/heads/next', commit]);
  if (push) { git(cwd, ['push', '--force', remote, `${commit}:refs/heads/next`]); log('next updated'); }
  return { commit };
}
