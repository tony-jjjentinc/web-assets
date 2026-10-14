# Releasing

Maintainer guide. The versioning rules are in [VERSIONING.md](VERSIONING.md).

## How a release happens

1. Merge pull requests into `main` using Conventional Commit titles (`feat:`, `fix:`, …). A pull-request check enforces the format.
2. **release-please** keeps one release PR open ("chore(main): release x.y.z"): version bump in `package.json` and `CHANGELOG.md`. It never creates tags (`skip-github-release`).
3. Merge that PR when you want to release. The **Release** workflow then, in order:
   1. builds and runs every gate (`npm run validate`, `npm test`, `npm run build`);
   2. creates the release commit (main + `dist/`), tags it `vX.Y.Z` and pushes **only the tag**;
   3. creates the GitHub Release with `dist.zip` and `manifest.json`;
   4. stable versions only: fast-forwards `latest`, purges jsDelivr for `@latest`;
   5. verifies what jsDelivr serves (see below). The run fails if it does not match `manifest.json`.

The workflow is re-runnable: if the tag exists it skips building and only (re)promotes, purges and verifies.

`develop` (optional) feeds the `@next` channel: every push builds `next` (main + `dist/`, force-updated, never tagged).

## First-time setup checklist

1. **Repository settings → Actions → General**
   - Workflow permissions: *Read and write permissions*.
   - Tick *Allow GitHub Actions to create and approve pull requests* (release-please needs it).
2. **Push `main`** with the contents of this project. The Release workflow starts, finds `0.0.0` (the placeholder) and publishes nothing. release-please opens the first release PR ("release 2.0.0-rc.1": `release-as` in `release-please-config.json` forces the first version).
3. If you want `develop`/`@next`, create the branch.
4. Branch protection (if used): allow the Actions bot to push the tags and the `latest` / `next` branches.
5. PRs opened by `GITHUB_TOKEN` do not trigger other workflows. If you want CI on the release PR, give release-please a personal access token (`token:` input) instead.

## Testing the setup with a release candidate

1. Merge the first release PR (`2.0.0-rc.1`).
2. In the Actions tab the **Release** run should be green. It ends with the verification list; every line must be `PASS` (lines marked `INFO` are informational).
3. Check by hand, with `<owner>/<repo>` replaced:
   ```sh
   curl -sI https://cdn.jsdelivr.net/gh/<owner>/<repo>@v2.0.0-rc.1/dist/manifest.json | head -1        # 200
   npm run release:verify -- --version 2.0.0-rc.1 --no-latest                                          # same checks from your machine
   git ls-remote --tags origin                                                                         # only the vX tag, no dist on main
   git ls-tree -r --name-only origin/main | grep -c '^dist/'                                           # 0
   ```
4. Open a stylesheet from the tag in a browser and confirm its fonts and images load from the same tag (DevTools → Network).
5. Before the final release, edit `release-as` in `release-please-config.json` to `2.0.0` (or remove it to let commits decide) through a normal PR.

What the verification proves: the exact tag is served although its commit is on no branch, every file's SHA-384 matches `manifest.json`, and `@latest` moved (stable only). `@2` / `@2.0` style ranges are probed and printed as `INFO`; nothing relies on them.

## Rehearsing locally

```sh
npm run build
node scripts/release-commit.mjs create --version "$(node -p "require('./package.json').version")"   # local tag only, nothing pushed
git show --stat vX.Y.Z | head                  # the release commit
git tag -d vX.Y.Z                              # throw the rehearsal away
```
`create` refuses `0.0.0`, stale builds (`dist/` built for another version) and tags that already exist.

## Rolling back

Never move or delete a published tag. Fix forward with a patch release. If `latest` must go back to an older release, run (once, deliberately) `node scripts/release-commit.mjs promote --version <old> --force --push`.

## Mutable endpoints and caching

Only `@latest` and `@next` are mutable. The workflows purge them through `scripts/cdn.mjs purge`; jsDelivr may still serve stale copies for a short while. Exact tags are immutable and cached for a long time, so never re-use a version number.
