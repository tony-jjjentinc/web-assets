# Versioning

JJJEI assets v2 follows [Semantic Versioning](https://semver.org). Releases are Git tags (`v2.3.1`) served by jsDelivr from GitHub.

## What consumers use

| URL form | Meaning | Use it for |
|---|---|---|
| `https://cdn.jsdelivr.net/gh/<owner>/<repo>@2.3.1/dist/…` | exact tag, immutable | **everything documented**; add the SRI hash from `manifest.json` |
| `…@latest/dist/…` | newest stable release, including future majors, no stability guarantee | only for consumers that deliberately want the newest design without editing the URL |
| `…@next/dist/…` | the current `develop` build | trying upcoming changes |

Range URLs (`@2`, `@2.3`) are **not** part of the contract and are never documented.

Every file inside a release refers to its siblings with relative URLs, so a stylesheet loaded from `@2.3.1` can only ever load fonts and images from `@2.3.1`.

Upgrading means changing the version in the URL. `manifest.json` (at the root of `dist/`) and the release notes list what changed.

## Which number changes

| Bump | When |
|---|---|
| **MAJOR** | Removing or renaming a CSS variable, class, group slug or file path; changing what a variable or class means; raising the minimum Bootstrap or Tailwind major |
| **MINOR** | New group, variant, class, variable, entry point, image or font; **changing the colour of an existing group** (called out as `visual-change` in the notes); deprecations |
| **PATCH** | Fixes that do not change how anything looks: build fixes, docs, asset optimisation, contrast fixes that move a value by one AA step or less |

Deprecate first: mark the thing deprecated in a minor release, keep it for at least one minor, remove it in the next major.

Releases are cut when there is something to release, not on a calendar.

## How the version is decided

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (the pull-request title is checked, because squash merges use it as the commit message):

| Prefix | Effect |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or a `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `test:`, `ci:`, `refactor:` | no release on their own |

Use `feat(tokens): …`-style scopes if useful. A colour change to an existing group is a `feat:` with `visual-change` in the body.

## Prereleases

`2.1.0-rc.1` style tags are normal tags. They are published and verified like any release, but never move `latest` and are marked as prereleases on GitHub.

## Where each release lives

`dist/` is not in `main`. A release is a commit that holds `main`'s tree plus `dist/`, tagged `vX.Y.Z`. Its parents are `main`'s tip and the previous `latest`, so `latest` only ever fast-forwards and nothing is force-pushed. Tags are never moved or deleted: a bad release is fixed with a new patch release.
