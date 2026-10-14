# JJJEI Assets v2

Shared design assets (Bootstrap 5 override, Tailwind theme, colour tokens, fonts, images) served through jsDelivr from GitHub tags.
Documentation lives in [`docs/`](docs/README.md). Predecessor: `../assets_v1` (frozen).

> Status: **Phase 6 done (versioning and release automation)**; the pre-release decisions (contrast fixes, dropped variants, licence, Bootstrap 5.3.x coverage) are applied. The consumer docs and migration guide (Phase 7) wait for a verified release candidate; nothing is released or tagged yet. To test the pipeline see [docs/RELEASING.md](docs/RELEASING.md).

## Commands
| | |
|---|---|
| `npm run validate` | schema + contrast gate over `tokens/` |
| `npm run build` | validate, then write `build/computed.json` and `dist/` (`colors`, `bootstrap`, `tailwind`, `fonts`, `images`) |
| `npm run release:verify -- --version X.Y.Z` | check what jsDelivr serves for a published release (exact tag, SRI of every file, `@latest`) |
| `npm run parity` | computed-style comparison of v2 bundles against real v1 CSS in Chromium (needs `../assets_v1`, Chromium via `CHROMIUM_PATH` or `npx playwright install chromium`; `-- --groups all` for all 37) |
| `npm test` | colour maths, token schemas, **v1 parity**, contrast gate |

## Colours-only output (`dist/colors/`)
| File | Use |
|---|---|
| `jjjei_<dept>-<n>.css` | one link: base + group variables |
| `base.css` + `groups/<slug>.css` | split: shared system/status colours once, ~0.4 KB gz per group |
| `base.css` + `all.css` | every group in one file, switch with `data-jjjei-group="<slug>"` on any element |
| `tokens.json` (DTCG), `tokens.flat.json`, `tokens.mjs` + `tokens.d.ts`, `_tokens.scss` | same values for tools, JS/TS and Sass |

Variables: `--jjjei-<colour>[-<role>]`, e.g. `--jjjei-primary`, `--jjjei-primary-subtle`, `--jjjei-status-3-emphasis`. Dark values apply under `[data-bs-theme="dark"]`, `[data-theme="dark"]` or `.dark`. Sizes (gzip): base 3.8 KB, group 0.44 KB, `all.css` 6.6 KB. Verified in Chromium: group switching by attribute, and dark mode by attribute and by class.

## Bootstrap override (`dist/bootstrap/`)
Supported: **Bootstrap 5.3.x** (built and tested against 5.3.8; 5.2 and earlier lack the variables this layer relies on). Load after `bootstrap.min.css`:
```html
<link rel="stylesheet" href=".../bootstrap@5.3.8/dist/css/bootstrap.min.css">
<link rel="stylesheet" href=".../dist/bootstrap/jjjei_admin-0.css">   <!-- tokens + core, one link -->
```
Or split: `colors/base.css` + `colors/groups/<slug>.css` + `bootstrap/core.css` (core is the same for every group and is cached once). `core.css` is 9.4 KB gzip, a bundle 15.8 KB (v1 was 25 KB per group).

It re-points Bootstrap's own variables and component rules at the `--jjjei-*` tokens, so every v1 class keeps working (`bg-primary-subtle`, `btn-status-3`, `bg-*-gradient|faint|shaded|body`, `nav-pills-*`, `loader-*`, `bg-pattern-*`, `bg-primary-base`, …). New in v2: `link-<colour>`, `text-bg-<colour>` and `table-<colour>` for every colour. The bundle also carries the Inter `@font-face` (relative URLs into `../fonts/`).

Verification: `npm test` checks class coverage against v1 (235 classes), size budgets and Sass deprecations. `npm run parity` compares computed styles of 20 colours × 30 components (including navbar, carousel, offcanvas) × states × light/dark with v1 (see below); run it before every release.

### Intentional differences from v1 (the parity run lists everything else as a failure)
- Button `:focus-visible` ring is back (v1's `none, <ring>` shadow list was invalid and dropped it).
- `.link-*` helpers and `.text-bg-*` follow the theme (v1 left Bootstrap's blue hover and white text); `text-bg-*`/`link-*`/`table-*` also exist for the custom colours.
- Active text on pagination, dropdown, list-group and progress uses the colour's contrast colour (v1: literal white, 1.4:1 on gold).
- Custom colours (`jjjei-*`, `status-N`) get a real emphasis colour and dark-mode subtle backgrounds (v1: `color-contrast()` output and none).
- `.btn-close` focus ring follows the theme (v1: stock blue).
- **Emphasis colours now pass AA** (v1 shipped 15 combinations below 4.5:1). 12 group colours shift slightly, in light mode: `admin-5` #8C6B00→#856600, `facilities-1` #53778C→#4F7185, `facilities-2` #007B8B→#006F7E, `procinv-1` #8C646A→#855F65, `controller-1` #3D7B66→#3A7561, `controller-3` #2B7D7A→#27716E, `treasury-1` #876B3A→#816637, `treasury-2` #926239→#8B5D37; in dark mode: `facilities-0` #6666FF→#7D7DFF, `leasing-0` #B36666→#BE7D7D, `hr-0` #B366B3→#BA75BA, `hr-2` #9366B4→#A37DBF; plus dark-mode emphasis of `jjjei-primary` and `status-9`.
- **Dropped:** `jjjei_facilities:1a` and `:5a` (never labelled; `5a` was identical to `6`). There is no v2 equivalent.

## Tailwind (`dist/tailwind/`)
The theme maps Tailwind colour keys to the live `--jjjei-*` variables, so switching department needs no rebuild. It only provides colours; load the values with a colours file (`colors/groups/<slug>.css` plus `colors/base.css`, a bundle, or `all.css` with `data-jjjei-group`).

**Tailwind v4** (build): copy `v4/theme.css` (and optionally `v4/dark-variant.css`) into your project. A remote `@import` from the CDN is *not* processed by Tailwind (Spike C), so vendor the file:
```css
@import "tailwindcss";
@import "./vendor/jjjei-theme.css";          /* v4/theme.css from the release */
@import "./vendor/jjjei-dark-variant.css";   /* optional: dark: follows data-bs-theme / data-theme / .dark */
```
**Tailwind v4 without a build** (browser script): paste the contents of `theme.css` inside `<style type="text/tailwindcss">` (the browser script cannot `@import` it) and `<link>` the colours file.

**Tailwind v3.4.1+**: `presets: [require('./vendor/jjjei-preset.cjs')]` (or `preset.mjs`). Only the base colour supports opacity modifiers (`bg-primary/50`); role colours are plain variables.

Class names match the Bootstrap-mode ones where Tailwind allows: `bg-primary`, `bg-primary-subtle`, `text-primary-emphasis`, `text-primary-contrast`, `hover:bg-primary-hover`, `bg-primary-faint|shaded|body`, `bg-primary-base`, `bg-status-3-subtle`, … Tailwind uses one colour key for background and border, so use `border-primary-border-subtle` (not `border-primary-subtle`) and `border-primary-body-border`.

`extras.css` (one `<link>`, works with v3 and v4) adds what a theme cannot express: `bg-<colour>-gradient`, `bg-<colour>-gradient-subtle` (with the noise layer), `bg-pattern-*` and `.loader*`. `v4/theme.prefixed.css` exposes the same colours as `jj-primary`, `jj-success`, … so they can coexist with Bootstrap's `bg-primary`. Sizes: theme 1.5 KB gzip, extras 1.3 KB.

## Fonts (`dist/fonts/`)
Variable **Inter** (weights 100–900, SIL OFL 1.1, from `@fontsource-variable/inter` 5.3.0, licence included), split into `latin` and `latin-ext` with `unicode-range`, so a page only downloads the subset it uses (47 KB / 83 KB; v1: one 23 KB static weight, bold was synthesised). `font-display: swap` with a metric-matched `Inter Fallback` (Arial, `size-adjust` 107.12 %) to avoid layout shift.
- Bootstrap bundles and `core.css` already include the `@font-face` (`url("../fonts/files/…")`).
- Everyone else: `<link rel="stylesheet" href=".../fonts/inter.css">` (also defines `--jjjei-font-sans`; Tailwind: `font-jjjei`).
- Preload the main file: `<link rel="preload" as="font" type="font/woff2" crossorigin href=".../fonts/files/inter-latin-wght-normal.woff2">`.
- **Gill Sans Nova is not shipped** (commercial typeface; decision Q4). Apps that need it must host it themselves.

## Images (`dist/images/`)
Sources are SVG masters under `assets/images/source/`; the build optimises them (SVGO) and generates everything else. `images/index.json` lists every file with format, dimensions, bytes and SRI (sha384).
| | |
|---|---|
| `logos/<brand>/<layout>.svg` | `jjjei/{mark,stacked,stacked-fit,horizontal}`, `marymart/{horizontal,stacked}` |
| `…-light.svg`, `…-dark.svg` | generated for the brand-green JJJEI logos: white, and the system dark `#191C1F` (v1 mixed `#000` and `#191C1F`) |
| `…-currentcolor.svg` | recolours with CSS `color`, **inline SVG only** (in an `<img>` it renders black) |
| `…@<width>.png` | generated renditions, e.g. `jjjei/stacked@512.png`, `jjjei/mark-dark@256.png` |
| `jjjei/horizontal-50yrs.png` | raster only: v1 had no SVG master for it |
| `patterns/<name>.svg`, `patterns.css` | 10 patterns (v1: 8 files + `grid` and `dots` as data-URIs); `.bg-pattern-<name>` works with `patterns.css`, the Bootstrap core or the Tailwind extras |

v1 → v2 file mapping (including which v1 files were duplicates or derived): `assets/images/source/v1-mapping.json`. `base.svg` and `logo.svg` were byte-identical; v2 ships one `mark.svg`. There are no `images/legacy` aliases: apps switch to the new paths.

Loaders (`.loader`, `.loader-pulse`, `.loader-dots`) are generated from `tokens/loaders.json`; v1's `.loader-dots` had no size and drew nothing, v2's is three bouncing dots.

## Releasing
Conventional Commits → release-please PR → merge → CI tags a commit that holds `dist/` (never on `main`), creates the GitHub Release and verifies jsDelivr. Consumers pin exact tags. Details: [docs/VERSIONING.md](docs/VERSIONING.md), [docs/RELEASING.md](docs/RELEASING.md). `dist/manifest.json` lists every file with its SRI hash, the groups, classes and variables.

## Licence
Proprietary, all rights reserved (public only so that jsDelivr can serve it); Inter stays under the SIL OFL 1.1. See [LICENSE](LICENSE) — **the text is a draft that needs the copyright holder's and counsel's confirmation before the first public release.**

## Layout
- `tokens/*.json` – source of truth (`groups`, `system`, `status`, `design`, `loaders`, `patterns`), validated by `tokens/schema/`.
- `tokens/contrast-allow.json` – contrast failures inherited from v1, each with a reason and expiry; the build fails when one expires or is no longer needed.
- `src/build/` – `color-math` (the only colour maths), `compute-tokens`, `contrast`, `validate`, `emit-colors`, `emit-bootstrap`, `emit-tailwind`, `emit-fonts`, `emit-images`, `emit-manifest`; `src/release/` – tag/branch logic and jsDelivr purge/verify (tested against temporary git repos and a fake CDN).
- `src/scss/core.scss` – the Bootstrap override layer (Sass `@use`, no `@import`); `_shared.scss` holds gradients, loaders and patterns used by both it and `extras.scss` (Tailwind).
- `test/fixtures/v1-golden.json` – v1's compiled colour values, the parity oracle. Regenerate only if v1 changes: `node scripts/extract-v1-golden.mjs`.
- `assets/images/source/` – logo and pattern masters; `scripts/migrate-v1-config.mjs` and `scripts/migrate-v1-images.mjs` – one-off v1 → v2 migrations (already run).

## Group ids
`jjjei_admin:0` (v1) is `jjjei_admin-0` (v2). `legacyId` in `groups.json` keeps the mapping.

## Known state (Phase 1)
- **Parity with v1:** 35 groups and 19 shared colours match v1's compiled CSS within 1 per channel (78.7 % exact; the rest are v1's Python vars truncating where Sass/browsers round, v2 rounds), except the emphasis colours deliberately fixed for AA (see above).
- **Intentional deviations:** v1's `text-emphasis` for status and custom colours was `color-contrast()` output (near-black/white); v2 computes a real emphasis colour, so emphasis parity is asserted for group primaries only. v1 emitted **no dark-mode subtle colours** for `jjjei-primary`, `jjjei-secondary` and `status-0…9` (12 of 19 shared colours); v2 computes them all.
- **No contrast exceptions:** `tokens/contrast-allow.json` is empty. v1 only tested each primary colour against white; v2 checks every role pairing, and the emphasis colours are fitted until they pass (see above).
