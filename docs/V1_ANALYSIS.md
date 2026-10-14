# JJJEI Core Assets — Analysis Report & V2 Roadmap

**Scope:** `assets_v1` (themed Bootstrap CSS generator + shared fonts/logos, served via jsDelivr) and `designHub_v1` (React preview/documentation site for those assets).
**Method:** Full read of generator/release/purge scripts, configs, docs, all hub config/hooks/components, plus runtime checks: a clean rebuild of all 37 CSS bundles in a scratch copy, `tsc -b`, `eslint .`, `npm audit`, and size measurements. Nothing in either repo was modified.

---

## 1. Executive Summary

| | assets_v1 | designHub_v1 |
|---|---|---|
| Role | Source of truth: design tokens → 37 compiled Bootstrap theme CSS files, fonts, logos | Browsable catalogue / setup guide for the above |
| Stack | Python 3 + Dart Sass + Bootstrap 5.3.8, git tags + jsDelivr | React 19, Vite 8, TS 6, react-router (HashRouter), GitHub Pages |
| Size | 241 tracked files, 31 MB (185 are generated CSS) | 45 files, ~300 KB JS bundle (89 KB gzip) |
| Tests | none (`npm test` is the npm placeholder that fails) | none |
| Health checks | Build is **reproducible** (clean rebuild matches committed `admin:0` byte-for-byte) | `tsc` clean, `eslint` clean, **2 high-severity `npm audit` findings** (react-router) |

**Overall:** The core idea is sound and the build output is deterministic. The weak points are not in the idea but in the seams: **documentation that contradicts the code, version/URL configuration copy-pasted in many places, a release pipeline with no safety net, and two repos that share data by hand-copying rather than by contract.** Almost every high-priority V2 item is "make one thing the single source of truth".

### Top 10 priorities for V2

1. **Stop the hub from fetching `main` at runtime for things it claims are versioned** (config JSON from `raw.githubusercontent.com/.../main`, favicon from `@main`) — hub and released CSS can silently drift apart. *(H-1)*
2. **Make "pinned" releases actually immutable:** the compiled CSS embeds `@main/fonts/Inter.woff2`, so a `@v4.0.0` pin still loads a mutable font. `colors/v4/` is also overwritten by every minor/patch release. *(A-1, A-2)*
3. **Fix the generator's silent-failure paths** (exit code 0 on config/compile errors → release script then tags and force-pushes a broken build). *(A-3)*
4. **Reconcile docs with reality** — `.bg-primary-gradient` is documented as 180°/90° fixed-attachment but ships as a 45° noise gradient; Gill Sans filename is wrong everywhere; "automatically darkened" status emphasis is not. *(A-15, A-22)*
5. **Add a smoke-test/CI layer** to both repos (CSS compile + contrast assertions; hub typecheck/lint/audit gate). *(A-25, H-9)*
6. **Fix the known runtime bug** in `FloatingToolbar` (`["Base"]` key does not exist) before it is re-enabled. *(H-4)*
7. **Generate the hub's colour/department lists from the assets repo** instead of maintaining `colorMapping.ts` by hand (it already omits `1a`/`5a`). *(H-2)*
8. **Shrink and de-duplicate the CSS** — 37 files × ~227 KB each differ almost only in hex values; ~80 copies of the same noise data-URI per file. *(A-18)*
9. **Migrate off Sass `@import`** (740 deprecation warnings per build; removed in Dart Sass 3.0). *(A-7)*
10. **Accessibility pass on the hub** (clickable `div`s, wrong alt text, hard-coded `text-dark`, no dark-mode switch although the CSS supports it). *(H-10)*

---

## 2. Project A — `assets_v1`

### 2.1 What it is (as built)

- `config/*.json` (group colours, system colours, status colours, design tokens, loaders, background patterns) → `scripts/generator.py` writes a temp SCSS per group, shells out to `npx sass`, and writes `colors/latest/<group>.css` + `colors/v<major>/<group>.css` + a `contrast-report.md`.
- `scripts/release.py` bumps `package.json`, regenerates, commits, tags `vX.Y.Z`, pushes `main`, force-pushes `main:latest`, then `scripts/purge_cdn.py` hits jsDelivr purge for 37 × 3 URLs.
- `index.html` is a standalone React-via-Babel-in-the-browser showcase page.
- Contrast engine: WCAG ratio checks on the primary colour only, with an automatic "darkened text-emphasis" fix.

### 2.2 Strengths (keep in V2)

- Config-driven; adding a group is a JSON edit.
- Deterministic build (verified by clean rebuild).
- Real WCAG maths and a generated contrast report — rare and valuable.
- Thoughtful extras: subtle/faint/shaded/body tints, dark-mode variants, `bg-*-gradient`, nav-pills variants, status palette 0–9, loader utilities.
- Good docs coverage by volume (6 markdown docs) and a documented release lifecycle.
- Dual-output scheme (`latest/` + `vN/`) shows the team already cares about backwards compatibility.

### 2.3 Shortcomings and improvements

Severity: **H** = breaks guarantees / can ship a broken release, **M** = correctness or maintainability debt, **L** = polish.

#### Release, versioning & delivery

| ID | Sev | Finding (evidence) | V2 improvement |
|---|---|---|---|
| A-1 | **H** | **"Immutable" pins aren't immutable.** `designTokens.json` → `font-face-url` is `…@main/fonts/Inter.woff2`, compiled into every CSS (`@font-face{…assets@main/fonts/Inter.woff2…}`). A `@v4.0.0` stylesheet therefore loads whatever `main` has. | Inject the font URL at build time from the release channel/tag (e.g. `@v{version}`), or use relative `url(../fonts/Inter.woff2)` so the font is resolved from the same ref as the CSS. |
| A-2 | **H** | **`colors/v4/` is documented as a "legacy guarantee" but is rewritten on every patch/minor** (`generator.py` writes `colors/v{major}`; `release.py` commits it; `@main` is mutable). Anyone on `@main/colors/v4/` gets silent visual changes. | Either (a) drop the `vN/` dir from new releases and rely on tags only, or (b) freeze `vN/` at the x.0.0 release and treat it as read-only. State the real guarantee in docs. |
| A-3 | **H** | **Silent failures.** `generate_css()` swallows config-load errors (`return`, exit 0) and per-group `CalledProcessError` (prints and continues, exit 0). `release.py` has already bumped `package.json` and will then commit, tag, push and force-push `latest` with partially stale CSS. | Exit non-zero on any error; have `release.py` verify all 37 expected outputs exist and are newer than the config before committing. |
| A-4 | M | **No release rollback / idempotency.** Sequence is bump → commit → tag → push → force-push `latest` → purge. A failed push after tagging leaves a local tag/commit and a half-published state; `main:latest --force` has no guard against overwriting an unexpected `latest`. Dry-run still executes read-only git calls and mutates nothing but never validates the tag doesn't already exist remotely. | Pre-flight: `git ls-remote --tags`, confirm remote `main` == local, run build + checks *before* bumping; make bump the last local step; prefer a CI-driven release (GitHub Action on tag) over a laptop script with `--force`. |
| A-5 | M | **Purge script limits.** 111 sequential HTTP requests, failures never change the exit code, only CSS is purged (not fonts, logos, patterns, `contrast-report.md`), and the `vX` path derivation uses a major-only guess with silent fallback to `v4`. | Use jsDelivr's batch purge or purge by directory; fail loudly; include fonts/images; consider switching to content-hashed file names so purging is unnecessary. |
| A-6 | M | **`package.json` hygiene:** `"main": "index.js"` (file doesn't exist), `"test"` is the failing npm stub, empty `author`/`keywords`, `license: ISC` unreviewed vs. the actual company licence, `bootstrap` and `sass` listed as runtime `dependencies` (they are build-only), `package-lock.json` not staged by `release.py` though version bumps touch it. | Set `private: true`, move to `devDependencies`, add real `test`/`lint` scripts, set `engines`, pin Python version in docs. |

#### Build system (`generator.py`)

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| A-7 | M | **Sass `@import` is deprecated** — a full build emits **740 deprecation warnings** and will break on Dart Sass 3.0. Bootstrap 5.3.x still ships `@import`-style partials, so this needs an explicit plan. | Move to `@use` with Bootstrap's module API (`@use "bootstrap/scss/functions" with (...)`) or at minimum pin `sass` to `<3` and silence-with-intent (`--quiet-deps` + tracked ticket). |
| A-8 | M | **SCSS is built by string concatenation in Python** (~350 `scss_content.append(...)` lines, with f-strings that mix Python braces and Sass interpolation `#{{$prefix}}`). Hard to review, easy to break, no syntax highlighting or linting. | Keep a real `theme.scss` (parameterised via `@use … with` or a generated `_tokens.scss` containing just the maps) and let Python only emit the token file. This also makes Sass-side maps (`$groups`, `$status`) usable directly. |
| A-9 | M | **`npx sass` spawned 37× sequentially** (a rebuild took >2 min wall-clock here). `npx` adds resolve overhead each time and can attempt a network install if `node_modules` is missing. | Compile in-process (`sass` JS API via a small Node script, or `sass --watch`-style multi-file `in:out` single invocation), parallelise, and fail fast if `node_modules/.bin/sass` is absent. |
| A-10 | M | **Duplicated logic between Python and Sass, with different rounding.** Python `tint_color/shade_color` use `int()` truncation (e.g. `$primary-bg-subtle`), while `.bg-*-shaded`, `-faint`, gradients are computed in Sass `mix()` (rounding). The same "35% shaded" colour can differ by 1 unit between `--bs-primary-bg-shaded` and `.bg-primary-shaded`. The hub's `SwatchCard.getSubtleHex` re-implements it a third time with `Math.round` and hard-coded `0.25/0.75`. | One implementation (Sass `mix()` or Python) feeding everything; export the *computed* tokens as JSON so the hub reads, not recomputes. |
| A-11 | M | **Token config is only partly honoured.** `shaded` (35%), `faint` (20%) and gradient 75% weights are read in Python for CSS variables but **hard-coded** in the emitted utility classes (`mix(#000,$value,35%)`, `mix(#fff,$value,20%)`, `…75%`). Changing `designTokens.json` changes variables but not `.bg-*-shaded/-faint/-gradient`. Also `box-shadow`, `font-url` keys are handled only if present (silent no-ops). Dead code: `safe_filename` temp-file rename dance; unused `output_dir` second element handling. | Drive *all* weights from tokens; validate the token file against a JSON Schema and fail on unknown keys. |
| A-12 | L | Group keys contain a colon (`jjjei_admin:0.css`). Colons are illegal in Windows filenames (clone/checkout fails on Windows), need `%3A` handling in some tooling, and look like a pseudo-selector in URLs. | V2 naming: `jjjei_admin-0.css` (or `admin/0.css`). Keep `:` as an alias via redirect-free duplicates only if consumers require it. |
| A-13 | L | `facilities:5a` and `facilities:6` are both `#1E90FF`; `facilities:1a`/`5a` exist only from v3/v4; the hub maps "Plumbing" to `5` and "Design and Drafting" to `6`. Duplicated values suggest an abandoned rename. | Add `name`, `status` (`active`/`deprecated`) and `aliasOf` to each group colour. |

#### Accessibility / contrast engine

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| A-14 | **H** | **Only the primary colour is validated, and only against white text-on-light.** The report says "37 groups, 26 auto-fixed" but nothing checks: dark-mode text/emphasis, `text-*-emphasis` on `bg-*-subtle` backgrounds, system colours, status colours, `.btn-*` text pairs, links on body. | Validate every generated colour role × light/dark × the actual foreground/background pairs the CSS emits; fail the build below threshold. |
| A-15 | M | **Docs promise behaviour the build doesn't deliver.** `REFERENCE.md`: status `.text-status-#-emphasis` is "automatically darkened to pass WCAG 4.5". Compiled CSS: `--bs-status-3-text-emphasis: #191C1F` — i.e. `color-contrast()` (near-black), not a darkened hue. It passes contrast but loses brand hue and is *identical* for most colours. | Either implement real darkened emphasis for system/status colours (reuse `find_accessible_shade`) or fix the docs. |
| A-16 | M | `find_accessible_shade` starts at 40% shade, so it can never return the *minimum* darkening its docstring promises (e.g. `gmo:1` gets 9.0:1 where far less would pass), producing over-dark emphasis colours. | Start at 0–5%, step 5, return the first pass; add dark-mode counterpart. |
| A-17 | L | Report is regenerated with a timestamp on every build and committed into 5 directories → noisy diffs; 4 identical copies in `v1…v4` plus `latest`. | Generate the report once, deterministically (no timestamp), publish only under `latest/`. |

#### Output size & duplication

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| A-18 | M | Each theme file is **~227 KB raw / ~25 KB gzip**; ~8.2 MB for `latest/` and another 8.2 MB for identical `v4/`, plus 3.9–5.4 MB for each of `v1`–`v3`. 80 copies of the same noise-filter data-URI exist in *each* file (one per colour × gradient variants). Diffing two groups after stripping hex colours still leaves ~446 KB of differences, i.e. they differ nearly everywhere because values are inlined. | Emit shared structure once and put group colour in CSS custom properties: ship one `core.css` (utilities reference `var(--bs-*)`) + a tiny per-group `tokens-<group>.css` (a few KB). Define the noise as one `--jjjei-noise` custom property. Expect >90% size reduction and far fewer cache misses when users switch group. |
| A-19 | M | **Repo bloat:** 185 tracked generated files; 5 copies of each in history. `colors/v1–v3` are historical artefacts committed as source. | Move build output to a `dist/` produced in CI and published only via release tag; keep history in tags, not folders. |
| A-20 | L | `images/logo` ships both SVG and PNG variants (`jjjei_horizontal-50yrs.png` has no SVG twin); `base.svg`, `logo.svg` are the same size (11,933 B) — probable duplicate; `.gitkeep` placeholders for empty `background/` and `misc/`. No optimisation (SVGO) or naming convention doc. | Add an asset manifest (`assets.json`: name, type, variant, dimensions, hash) generated at build; run SVGO; dedupe by hash. |
| A-21 | L | Fonts: only `Inter.woff2` (single weight in `@font-face`; the generator declares `font-weight: normal` only, so bold becomes synthetic faux-bold) and `GillSansNovaBold.woff2`. | Ship Inter as variable font (`wght 100–900`), declare `font-display: swap`, `unicode-range` subsets; document licences for both typefaces. |

#### Documentation

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| A-22 | **H** | **Doc/code contradictions** (verified): (1) `.bg-primary-gradient` is documented as responsive 180°/90° with `background-attachment: fixed`; the generated class is a 45° gradient with noise and **no** `background-attachment` (`OVERRIDE_REFERENCE.md` correctly says 45°, so the docs disagree with each other); (2) Gill Sans file is `GillSansNovaBold.woff2` on disk but `GillSansNova-Bold.woff2` in `REFERENCE.md` and the hub's reference copy → the documented `@font-face` URL 404s; (3) `SETUP.md` still describes `colors/v2/group_a.css`; (4) `VERSIONING.md` links to `file:///home/<user>/…/assets/scripts/generator.py` (absolute local path, 404 on GitHub); (5) docs say Bootstrap `5.3.8`, `5.3.3` and `5.3.0` interchangeably (the CSS is built against 5.3.8, the showcase page loads 5.3.3 CSS, docs load 5.3.0 JS). | Single generated reference (see A-23) and a CI link/URL checker; pin one Bootstrap version in one place. |
| A-23 | M | Docs are hand-written lists of class names (e.g. "`.bg-jjjei-secondary-gradient`, …" repeated for each colour) that must be edited on each change. | Generate the utility reference from the compiled CSS/config; keep prose docs short and link to it. |
| A-24 | L | `index.html` showcase: React 18 + `@babel/standalone` compiled in the browser (several MB, slow first paint), hard-codes the group/variant list (duplicate of config and of the hub), references `@main` and v4, and is a *third* showcase alongside the hub and docs. | Retire it in favour of the hub (`designHub`) or generate it; avoid in-browser Babel. |

#### Quality & operations

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| A-25 | M | **No tests/CI at all.** No lint for Python, no CSS validation, no check that every group in config has an output, no visual regression, no check that referenced fonts/images exist. | GitHub Action: build → assert file count == config count → stylelint/`csstree` parse → contrast assertions → link/URL check → size budget. |
| A-26 | L | Commit history is largely `UP: …` / `UP: date` (non-descriptive); only the last two commits describe the change. Release notes/CHANGELOG absent despite a formal versioning doc. | Conventional Commits + auto-generated changelog on release. |
| A-27 | L | `scripts/__pycache__/` exists on disk (correctly git-ignored). Python deps are stdlib-only (good) but there is no `.python-version`/CI pin; `datetime.now()` in the report breaks byte-reproducibility of the full output. | Pin runtimes; remove timestamps from committed outputs. |
| A-28 | L | `release.py` and the docs call out the `latest` branch as "synchronised with the latest tag" but nothing enforces that; `git push origin main:latest --force` could publish an unreleased `main`. | Make `latest` a pointer produced only by the release workflow from the tag commit. |

---

## 3. Project B — `designHub_v1`

### 3.1 What it is (as built)

A Vite + React 19 + TypeScript single-page app (HashRouter, base `/assets-preview/`) with pages: Home, Departmental Colours, System/Status colours, Images, Icons (Bootstrap Icons + Font Awesome browser), Typography, Setup & Usage; `Components` and `Patterns` pages exist but are commented out of navigation. Deployed to GitHub Pages via a workflow on push to `main`. The page theme CSS is loaded from jsDelivr; asset JSON is fetched live from GitHub raw.

### 3.2 Strengths (keep in V2)

- Clean, small codebase; TS strict config passes `tsc -b`; `eslint` clean.
- Useful features: copy-hex, copy/download images and icons, icon search over two libraries, setup snippets, responsive sidebar.
- Centralised `assetsConfig` helper for URLs (a good seed for a contract with the assets repo).
- Uses the assets repo's own utilities (`bg-primary-gradient-subtle`, `bg-jjjei-primary`) — good dog-fooding.

### 3.3 Shortcomings and improvements

#### Data contract & coupling with `assets_v1`

| ID | Sev | Finding (evidence) | V2 improvement |
|---|---|---|---|
| H-1 | **H** | **Runtime reads of mutable `main`.** `getConfigUrl()` → `raw.githubusercontent.com/<repo>/main/config/*.json` (Colour + Status pages), favicon → `@main`, legacy channel → `@main`. The hub claims to document `v4.0.0` but shows data from whatever is on `main`, including unreleased edits. GitHub raw is also rate-limited, served `text/plain`, and not a CDN. | Read versioned JSON from the same release the page documents (`@v{version}/…` via jsDelivr), or — better — bake the data in at build time from the pinned assets package. |
| H-2 | **H** | **Hand-maintained duplicate of the colour taxonomy.** `colorMapping.ts` lists groups/variants/department names; `assets_v1` has the real list. Already drifted: hub omits `facilities:1a` and `5a`; "Design and Drafting"→`6`, "Plumbing"→`5` while `5a` and `6` share a hex; the only place sub-department names (BLA, ACS, …) live is the hub. | Put `label`/`department`/`status` into `groupColors.json` (see A-13) and generate `colorMapping.ts` (or consume the JSON) so adding a group needs zero hub edits. |
| H-3 | M | `CURRENT_ASSET_VERSION = 'v4.0.0'` is hard-coded; so are the `SetupInstructions` snippets (`@v4.0.0`, `bootstrap@5.3.8`) and `ASSETS_REPO_REFERENCE.md` (an 8.8 KB hand copy of the assets docs with the same Gill Sans filename error). Every release needs manual edits in ≥4 places. | Single `version` imported from the assets package (or a generated `assets.manifest.json`) used by config, snippets and docs; delete `ASSETS_REPO_REFERENCE.md` in favour of a link/generated page. |

#### Runtime behaviour & bugs

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| H-4 | **H** (latent) | **`FloatingToolbar` crashes on group change:** `colorGroups[newGroup]["Base"].replace(...)` — the key is `"Base Color"`, so `undefined.replace` throws. Component is currently commented out in `App.tsx`, which is why it hasn't surfaced. | Fix or delete; add a unit test before re-enabling. Hold the "Base Color" label in one constant. |
| H-5 | M | **`useDynamicCss` is fragile:** fetches the whole ~227 KB CSS as text on every switch, injects it in a `<style>`, no `res.ok` check, no abort/race handling (fast switching can apply an older response last), `?t=Date.now()` defeats all caching, and runs *in addition to* the static `<link … jjjei_gmo:0.css>` in `index.html` (two competing stylesheets). It also applies a regex that rewrites `linear-gradient(225deg, …)` — a pattern the generator no longer emits (it outputs 45°), so the hack is dead. | Swap the `<link href>` of one `<link id="theme">` element (the browser handles caching/aborts); remove the dead regex; with the V2 split (A-18) switching becomes a ~few-KB token file. |
| H-6 | M | Error handling is mostly `console.error` or silent: `ColorPreview` never checks `res.ok` and shows `#E0E0E0` placeholder swatches on failure with no message; `SwatchCard.copyHex` swallows clipboard errors; `IconPreview` copy handlers call `navigator.clipboard.writeText` without try/catch (rejects outside a secure context/permission-denied). | Shared `useFetch` with loading/error/retry UI; centralised `copyToClipboard()` returning success/failure and showing a toast. |
| H-7 | M | **Third-party runtime dependencies:** icon metadata from `unpkg.com` and `raw.githubusercontent.com` (twbs/icons **`main`** — mutable; Font Awesome pinned to 6.5.1), Font Awesome CSS from cdnjs, Bootstrap Icons declared as an npm dependency (`^1.13.1`) but never imported — the app uses the CDN `1.11.3` build instead (unused dependency, version mismatch), Bootstrap JS `5.3.0` vs CSS `5.3.8`, no SRI hashes. Three icon/CDN hosts for a static page. | Bundle what you use (npm `bootstrap-icons`, `@fortawesome/fontawesome-free` data), align Bootstrap CSS/JS versions, add SRI or self-host. Remove the unused npm dependency or switch to it. |

#### Security & supply chain

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| H-8 | **H** | **`npm audit`: 2 high-severity** advisories in `react-router` / `react-router-dom` 7.12.0–7.18.1 (RSC-mode CSRF bypass — not exploitable in this client-only HashRouter app, but flagged and fixable with `npm audit fix`). CI uses `npm install` (not `npm ci`), no audit, lint, or typecheck step apart from the build. | Bump router; CI: `npm ci`, `npm run lint`, `npm audit --audit-level=high`, then build. Add Dependabot/Renovate. |
| H-9 | M | `deploy.yml` has no PR trigger (only `push` to `main`), so broken changes are discovered *after* merge; `cache: 'npm'` used with `npm install`; Node 20 pinned while eslint 10/vite 8 prefer newer LTS. | Add a `pull_request` workflow with the same checks; use `npm ci`; set Node ≥22 and `engines`. |

#### Accessibility, UX and maintainability

| ID | Sev | Finding | V2 improvement |
|---|---|---|---|
| H-10 | M | **Accessibility gaps:** swatch cards are click-to-copy `div`s with `onClick` only (no `role`/`tabIndex`/key handler → not keyboard operable); logo `alt="Marymart Logo"` is used on the JJJEI logo (Sidebar, MobileHeader); mobile hamburger button has no `aria-label`; two sidebar items share the same icon (`bi-palette`); copy success is only a visual badge swap with no `aria-live`; hard-coded `text-dark`/`link-dark` break the dark theme the CSS explicitly supports; `text-muted` is deprecated in Bootstrap 5.3 (used in ~10 files). | Use `<button>`s, correct alts, `aria-live` toast, `text-body-secondary`; add a light/dark switch that sets `data-bs-theme` (the generated CSS already supports it) and test with axe in CI. |
| H-11 | M | **Inline-style and logic duplication:** hover effects implemented with `useState` + inline `style` instead of CSS `:hover`; `Sidebar` injects a `<style>` tag in render; large inline `style={{…}}` objects; page components are 200–360 lines each (`SetupInstructions` 333, `IconPreview` 363, `ComponentPreview` 332) mixing data, copy text and markup. | Extract CSS modules/`App.css` classes, move content (snippet text) to data files, split big pages into components/hooks. |
| H-12 | L | **Dead and half-hidden features:** `/components` and `/patterns` routes exist but are hidden via commented-out JSX in `App.tsx`, `Sidebar.tsx`, `Home.tsx`; Vite-template leftovers that nothing imports (`src/assets/hero.png`, `react.svg`, `vite.svg`, and `App.css` containing the template's `.counter` styles). Sidebar logo link is a plain `<a href="/assets-preview/">` (full reload, hard-coded base) instead of `<Link>`. | Remove or feature-flag (`VITE_ENABLE_PATTERNS`) hidden pages; delete template assets; use `<Link to="/">` and `import.meta.env.BASE_URL`. |
| H-13 | L | `vite.config.ts` `base: '/assets-preview/'` vs repo/product name "designHub" — naming is inconsistent (package `assets-preview`, README "System Design Hub", UI "Dashboard Design Hub"). README is 26 lines and does not explain development, data sources or deployment. | Pick one product name; expand README (run, build, release-sync with assets repo). |
| H-14 | L | **No tests.** No unit tests for utilities (`formatName`, subtle-colour maths), no component or e2e tests, no Lighthouse/axe budgets. | Vitest for utils/hooks, Playwright smoke test of each route + theme switch, axe checks. |
| H-15 | L | Bundle is a single 303 KB JS chunk (89 KB gzip) — acceptable, but all pages (incl. 360-line icon browser and large metadata fetches) are eagerly bundled; no code-splitting, no PWA/offline. | `React.lazy` per route; virtualise the icon grid (thousands of icons rendered from search results). |

---

## 4. Cross-cutting issues (both repos)

| ID | Sev | Issue | V2 improvement |
|---|---|---|---|
| X-1 | **H** | **No machine-readable contract between the repos.** Versions, group list, status names, class names, asset filenames and URLs are retyped in `assets_v1` docs, `assets_v1/index.html`, hub config, hub `SetupInstructions`, and `ASSETS_REPO_REFERENCE.md`. Every drift found in this report is a symptom of this. | Have `assets_v1` publish `manifest.json` (version, groups with labels/colours/status, files, classes, CDN base) as a release artefact; the hub and docs consume it. |
| X-2 | M | Deployment: CSS served from jsDelivr (cache/purge dance), hub from GitHub Pages, hub fetches data from GitHub raw — three origins/caching models for one product. | Standardise on tagged jsDelivr URLs (immutable) + one "latest" alias; remove cache-busting hacks. |
| X-3 | M | **Naming inconsistency:** `jjjei` vs `Marymart`, `assets` vs `core_assets` vs `assets-preview` vs `designHub` vs "System Design Hub" vs "Dashboard Design Hub", `facilities:1a`, status `0–9` with prose meanings only in the hub. | Naming decision record; put status semantics (`status-5: Delayed, Danger`) in `statusColors.json` with a typo pass ("Due Progress, Delayed" for status-5 looks wrong). |
| X-4 | M | Consumers are Google Apps Script web apps in sandboxed iframes — the documentation describes workarounds (SVG sanitisation, 10-minute cache) but there is no automated test that an actual GAS page renders the CSS. | Add a minimal GAS-like HTML fixture (iframe sandbox attrs) to the CSS smoke tests. |
| X-5 | L | No LICENSE, SECURITY, CONTRIBUTING, or CODEOWNERS in either repo; two logos and fonts are brand/commercial assets published on a public CDN. | Confirm licensing for Inter (OFL) and Gill Sans Nova (commercial — is public redistribution permitted?), add a LICENSE/NOTICE, and decide whether logos should be on a public CDN. |

> **Flag for follow-up:** *Gill Sans Nova* is a commercial typeface (Monotype). Hosting `GillSansNovaBold.woff2` in a public GitHub repo served over a public CDN may breach its licence. I did not verify the company's licence terms; please check before V2.

---

## 5. Suggested V2 architecture

```
assets/ (v2)
├── tokens/                      # JSON, schema-validated (groups w/ labels+status, system, status, design)
├── src/
│   ├── theme.scss               # real Sass (@use), no Python string-building
│   └── core/                    # shared utilities referencing CSS variables only
├── build/                       # Node (sass JS API) or Python -> emits:
│   ├── dist/core.css            #   shared, ~25 KB gz total, cached once
│   ├── dist/groups/<group>.css  #   few-KB token files (CSS custom properties only)
│   ├── dist/manifest.json       #   version, groups, classes, files, hashes, CDN base
│   └── dist/contrast-report.json
├── fonts/ (variable Inter, licence-checked)  images/ (+ manifest)
└── .github/workflows/release.yml  # tag-triggered: build → test → publish → purge
```

**Consumer experience in V2:**
```html
<link href=".../bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
<link href=".../assets@2.0.0/dist/core.css" rel="stylesheet">
<link href=".../assets@2.0.0/dist/groups/jjjei_admin-0.css" rel="stylesheet">
```
Switching group = swapping one tiny file; pins are genuinely immutable; the hub reads `manifest.json` of the *same* version.

**Hub V2:** consumes the manifest (no raw/`main` fetches), generated colour pages, theme switcher with dark mode, accessible swatches, route-level code-splitting, CI with typecheck/lint/audit/axe/Playwright.

---

## 6. Phased plan

| Phase | Goal | Items | Effort |
|---|---|---|---|
| **0 – Hotfix (days)** | Remove known hazards | `npm audit fix` (H-8); fix doc errors (A-22); fix `["Base"]` bug (H-4); font URL @main (A-1); non-zero exit codes (A-3) | S |
| **1 – Safety net (1–2 wks)** | Make releases trustworthy | CI for both repos (A-25, H-9); release pre-flight + rollback (A-4); purge hardening (A-5); package.json hygiene (A-6) | M |
| **2 – Single source of truth (2–3 wks)** | End drift | `manifest.json` + group metadata (X-1, A-13, H-2, H-3); hub reads versioned data (H-1); drop `vN/` mutability (A-2) | M |
| **3 – Build modernisation (2–4 wks)** | Smaller, faster, future-proof CSS | `@use` migration (A-7), real SCSS source (A-8), core + token-file split (A-18), fast in-process compile (A-9), tokens fully honoured (A-11), full contrast matrix (A-14–A-16) | L |
| **4 – Hub polish (2 wks)** | Accessible, maintainable UI | A11y + dark mode (H-10), dynamic CSS rewrite (H-5), error handling (H-6), lazy routes, tests (H-14), remove dead code (H-12) | M |
| **5 – Governance** | Licensing and process | X-5 licence review, naming decisions (X-3), conventional commits + changelog (A-26) | S |

---

## 7. Evidence log (what was actually run/measured)

- Clean rebuild of all 37 groups in a scratch copy (`npx sass` per group): **succeeded, exit 0, output matches committed `colors/latest/jjjei_admin:0.css`** (reproducible); **740 `@import` deprecation warnings**; wall-clock > 2 minutes.
- `colors/latest/jjjei_admin:0.css`: 227,284 B raw, 24,950 B gzip; contains 80 copies of the `feTurbulence` noise data-URI. `latest/` = `v4/` byte-identical (8.2 MB each).
- Compiled CSS inspection: `--bs-status-3-text-emphasis: #191C1F` (not a darkened hue); `.bg-primary-gradient` is 45° with noise and no `background-attachment`; `@font-face` URL is `…assets@main/fonts/Inter.woff2`.
- Files on disk: `fonts/GillSansNova**B**old.woff2` (no hyphen) vs docs `GillSansNova-Bold.woff2`.
- Contrast report: 11 pass / 26 auto-fixed across 37 groups; only primary colour is validated.
- Hub: `npx tsc -b` exit 0; `npx eslint .` no findings; `npm audit --omit=dev`: 2 high (react-router); `dist/` JS 303 KB (88.8 KB gzip).
- Static review of every file under `designHub_v1/src` for fetch/URL/a11y/dead-code patterns; `FloatingToolbar` bug found by reading (component currently disabled, so not reproduced at runtime).

*Limitations:* I did not run the hub in a browser, test the live CDN/GitHub Pages deployments, inspect the remote repositories' settings/branch protection, or verify the licensing status of the fonts/logos. Severity ratings are my judgement; adjust to your release cadence and consumer base.
