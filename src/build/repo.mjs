import { execFileSync } from 'node:child_process';

/** "owner/repo" from GITHUB_REPOSITORY, else the origin remote, else null. */
export function repoSlug(env = process.env) {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null;
  } catch { return null; }
}

export const cdnBase = (slug, ref) => `https://cdn.jsdelivr.net/gh/${slug}@${ref}/dist/`;
