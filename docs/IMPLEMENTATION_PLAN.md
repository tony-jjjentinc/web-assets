# assets_v2 — Implementation Plan

**Goal:** a new `assets_v2` project, built from `assets_v1`'s source and configs, that serves the same brand assets with three colour delivery modes (**Bootstrap 5 override**, **Tailwind**, **colours-only**), a properly organised fonts/images/logos pipeline, and a GitHub-tag + jsDelivr versioning scheme that is genuinely immutable and semver-range friendly.

**Inputs reused unchanged from v1:** `config/groupColors.json`, `systemColors.json`, `statusColors.json`, `designTokens.json`, `loaders.json`, `backgroundPatterns.json`, `fonts/`, `images/`.
**Findings from the v1 analysis this plan resolves:** A-1, A-2, A-3, A-5, A-7, A-8, A-9, A-10, A-11, A-12, A-14–A-16, A-18–A-22, A-25, A-28, X-1 (see [V1_ANALYSIS.md](V1_ANALYSIS.md)).

> Scope note: this is a plan only. Nothing has been scaffolded. The open questions were answered on 2026-10-14; Section 12 records the decisions and the plan reflects them.

---

## 1. Design principles

1. **Tokens first, CSS second.** All colours are computed once, in one place, into a machine-readable token set. Every output (Bootstrap, Tailwind, JSON, SCSS) is a *projection* of that set. No second implementation of tint/shade maths anywhere (v1 had three).
2. **Group-independent code is shipped once.** In v1 each of the 37 files re-contained Bootstrap utilities, system colours, status colours and 80 copies of a noise image (~227 KB each). In v2 only the *primary-colour roles* vary per group (~1 KB); everything else is a shared file the browser caches once.
3. **CSS custom properties are the contract.** Bootstrap, Tailwind and plain CSS all read the same `--jjjei-*` variables. Switching department = swapping/overriding ~1 KB of variables, with no rebuild of components.
4. **Immutable by construction.** Every URL inside a released file (fonts, images, `@import`) is *relative*, so a file served from `@2.3.1` can only load things from `@2.3.1`. No `@main` anywhere in output.
5. **Fail the build, not the consumer.** Any compile, schema, contrast, size or parity failure exits non-zero and blocks the release.
6. **Back-compat is explicit, not accidental.** v1 consumers keep working on the v1 repo; migration to v2 is a URL change to the new slug names (no compat shims, §9).

---

## 2. Deliverables (what consumers get)

### 2.1 Entry points

| Mode | You want… | Files (served under `…/assets-v2@<exact-version>/dist/`) |
|---|---|---|
| **Bootstrap 5 override** (v1 parity) | Existing look on Bootstrap 5.3 | `bootstrap/<group>.css` — one link, includes everything (GAS-friendly). Or split: `bootstrap/core.css` + `colors/base.css` + `colors/groups/<group>.css` |
| **Tailwind v4** | Utilities `bg-primary`, `text-primary-emphasis`, `bg-status-3-subtle`… | `tailwind/v4/theme.css` (`@theme`) + `colors/groups/<group>.css` (runtime values) |
| **Tailwind v3** | Same, via preset | `tailwind/v3/preset.cjs` (+ `.mjs`) + `colors/groups/<group>.css` |
| **Colours only** | Variables / tokens, no framework | `colors/<group>.css` (base + group variables), `colors/all.css` (every group, selector-scoped), `colors/tokens.json` (W3C DTCG), `colors/tokens.flat.json`, `colors/tokens.mjs` + `.d.ts`, `colors/_tokens.scss` |
| **Fonts** | Brand typefaces | `fonts/inter.css`, `fonts/files/*.woff2` |
| **Images / logos / patterns** | Logos, patterns | `images/logos/…`, `images/patterns/…`, `images/patterns.css`, `images/index.json` |
| **Machine-readable index** | Docs, hub, tooling | `manifest.json` (every file, size, SRI hash, group list, class list, version) |

### 2.2 Naming
- **Group id:** `jjjei_admin:0` → file/URL slug **`jjjei_admin-0`** (no colon: Windows-safe, no `%3A`). `facilities:1a` → `jjjei_facilities-1a`.
- **CSS variable prefix:** `--jjjei-`. Per colour role: `--jjjei-primary`, `-rgb`, `-hover`, `-active`, `-contrast`, `-subtle`, `-border-subtle`, `-faint`, `-shaded`, `-body`, `-text`, `-emphasis` (each has a dark counterpart resolved by the dark selector). System colours: `--jjjei-success-*`, … `--jjjei-jjjei-primary-*`. Status: `--jjjei-status-0-*` … `-9-*`.
- **Dark-mode selector list** (one rule, all ecosystems): `[data-bs-theme="dark"], [data-theme="dark"], .dark`. `prefers-color-scheme` auto-mode is opt-in via a build flag, off by default (matches Bootstrap's behaviour).
- **Group switching without swapping files:** `colors/all.css` scopes each group as `[data-jjjei-group="jjjei_admin-0"] { … }` — the hub and multi-department apps can switch by changing an attribute (≈ 37 × 1 KB, ~6 KB gzipped).

### 2.3 Size budgets (enforced in CI)
| File | Budget (gzip) |
|---|---|
| `colors/groups/<group>.css` | ≤ 1.5 KB |
| `colors/base.css` (system + status) | ≤ 6 KB |
| `bootstrap/core.css` | ≤ 18 KB (v1 whole file was ~25 KB gz with the primary baked in) |
| `bootstrap/<group>.css` (bundle) | ≤ 26 KB |
| `tailwind/v4/theme.css` | ≤ 4 KB |

---

## 3. Repository layout (`assets_v2`)

```
assets_v2/
├── tokens/                         # copied from v1 config/, extended (see 4.1)
│   ├── groups.json                 # +label, department, status, aliasOf, since
│   ├── system.json  status.json  design.json  loaders.json  patterns.json
│   └── schema/*.schema.json        # JSON Schema (ajv), unknown keys fail
├── src/
│   ├── build/                      # Node ESM build (no framework)
│   │   ├── color-math.mjs          # tint/shade/mix/contrast — the ONLY implementation
│   │   ├── compute-tokens.mjs      # tokens → computed.json (all roles, light+dark)
│   │   ├── validate.mjs            # schema + contrast matrix + parity
│   │   ├── emit-css.mjs  emit-bootstrap.mjs  emit-tailwind.mjs  emit-colors.mjs
│   │   ├── emit-fonts.mjs  emit-images.mjs  emit-manifest.mjs
│   │   └── index.mjs               # orchestrates; parallel; non-zero on any failure
│   ├── scss/
│   │   ├── bootstrap-core.scss     # override layer (§5), uses var() references
│   │   ├── _utilities.scss  _loaders.scss  _patterns.scss  _gradients.scss
│   └── tailwind/                   # templates for theme.css / preset
├── assets/
│   ├── fonts/source/               # master font files + LICENSE notes
│   └── images/source/              # SVG masters (logos, patterns)
├── test/                           # §10
├── docs/                           # generated reference + hand-written guides
├── dist/                           # git-ignored on main; committed only on release tag commits (§8)
├── .github/workflows/             # ci.yml, release.yml, preview.yml
├── package.json                    # private:false only if npm publishing is chosen
└── CHANGELOG.md                    # generated
```

**Toolchain (default):** Node ≥ 22 only. `sass` (JS API, in-process, `@use` modules), `ajv`, `svgo`, `sharp` (PNG renditions), `fonttools`-equivalent via `subset-font`/`glyphhanger` (or one `pyftsubset` CI step), `playwright`, `vitest`. Python is dropped: one language shared with the hub, no `npx` spawn per file. (Rationale: v1 took >2 min to build 37 files by spawning `npx sass` 37 times; target for v2 is <20 s full build.)

---

## 4. Token pipeline

### 4.1 Source tokens (v1 → v2 migration of config)
- `groups.json` entries become objects, e.g.
  `"jjjei_facilities-1": { "hex": "#97D9FF", "label": "Architectural, Civil, and Structural (ACS)", "department": "Facilities", "status": "active", "legacyId": "jjjei_facilities:1" }`
  This moves the hub's hand-maintained `colorMapping.ts` into the source of truth (A-13, H-2). `status: deprecated` + `aliasOf` captures `facilities:5a`/`:6` (identical `#1E90FF`) without silently duplicating.
- Hard-coded values in v1's generator (shaded 35 %, faint 20 %, gradient 75 %) become real keys in `design.json` so *every* weight is token-driven (A-11).
- Add `schema/*.json`; unknown keys, bad hex, missing label → build error.

### 4.2 Computation (`compute-tokens.mjs`)
For every colour (each group primary, each system colour, each status colour) produce, for **light and dark**:
`base, rgb, hover, active, contrast (on-colour text), subtle, border-subtle, faint, shaded, body, text (accessible-on-white), emphasis`.

Rules:
- Mixing uses the **same rounding as Sass `mix()`** (v1's Python used `int()` truncation while Sass used rounding → 1-unit mismatches, A-10). One implementation, Sass-compatible.
- `hover/active` = Bootstrap's own formulas (`shade-color 15/20 %`, `tint` for light colours via contrast rule) **precomputed**, so v2 needs no `color-mix()` for button states (keeps broad browser support; GAS users are on arbitrary corporate browsers).
- `text`/`emphasis`: smallest shade step (start 0 %, step 5) meeting the AA threshold — fixes A-16 (v1 started at 40 %). Dark-mode counterpart = smallest *tint* meeting AA on the dark surface.
- **Parity requirement:** for all 37 groups, computed `subtle/border-subtle/faint/shaded/body` equals the values in v1's compiled CSS (golden test, §10). Intentional differences are listed in `docs/MIGRATION.md`.

### 4.3 Contrast matrix (replaces v1's primary-only check)
Check every role × mode × realistic pairing:
- `contrast` on `base`, `hover`, `active` (buttons) ≥ 4.5
- `emphasis` on `subtle` (alerts/badges) ≥ 4.5, light and dark
- `text` on white / on dark body ≥ 4.5 (links)
- `border-subtle` vs `body` non-text ≥ 3 (informational warning)
Output `dist/contrast-report.json` (+ md). Build fails on any failure not in `tokens/contrast-allow.json` (each entry needs a reason and an expiry).

### 4.4 Single-source outputs
`computed.json` is the intermediate artefact that all `emit-*` steps read. It is also published (as `colors/tokens.flat.json`) so the hub never recomputes colours (replaces `SwatchCard.getSubtleHex`).

---

## 5. Bootstrap 5 override (`bootstrap/`)

### 5.1 Approach: variable-driven override layer (recommended) — Phase 1 spike decides
Bootstrap 5.3 components read CSS variables (`--bs-btn-bg`, `--bs-alert-bg`, `--bs-nav-pills-link-active-bg`, …) so the theme can be a **group-independent stylesheet** that maps component variables to `--jjjei-*`:

```scss
@each $name in $theme-names {            // primary, secondary, success, …, jjjei-primary, status-0…9
  .btn-#{$name} {
    --bs-btn-color: var(--jjjei-#{$name}-contrast);
    --bs-btn-bg: var(--jjjei-#{$name});
    --bs-btn-border-color: var(--jjjei-#{$name});
    --bs-btn-hover-bg: var(--jjjei-#{$name}-hover);
    --bs-btn-active-bg: var(--jjjei-#{$name}-active);
    …
  }
}
```
Plus the Bootstrap root bridge: `:root { --bs-primary: var(--jjjei-primary); --bs-primary-rgb: var(--jjjei-primary-rgb); --bs-primary-text-emphasis: …; --bs-link-color: var(--jjjei-primary-text); … }`.

Component coverage = v1's list: `nav/nav-pills/nav-tabs/navbar, btn/btn-group, dropdown, accordion, alert, badge, list-group, progress, spinners, tables, forms (focus/checked), pagination, breadcrumb, carousel`, plus all utilities (`bg-*`, `text-*`, `border-*`, `*-subtle`, `*-emphasis`, `link-*`, `*-gradient`, `*-faint`, `*-shaded`, `*-body`, `nav-pills-*`, `loader-*`, `bg-pattern-*`, `bg-primary-base`).

**Gradient/noise:** define the noise image **once** as a custom property (`--jjjei-noise: url("data:…")`) and reference it in gradient classes (removes the 80 duplicates, A-18). Gradient behaviour is unchanged from v1 code (45° + noise, Q5).

### 5.2 Fallback (only if the spike fails a gate)
If some component cannot be themed through variables, compile that one component per group at build time via Sass (`@use` with `with()` config) into the *group* file, keeping everything else shared. The size budget in §2.3 tells us when this is acceptable.

### 5.3 Bundle files
`bootstrap/<group>.css` = `core + base + group` concatenated and minified, single `<link>` for GAS/iframe usage. Split files exist for apps that want better caching (core cached once across all departments).

### 5.4 Sass modernisation
`@use "bootstrap/scss/functions"`-style imports where Bootstrap's partials allow; any remaining `@import` is confined to one wrapper file with `--quiet-deps`, and a CI check fails on *new* deprecations (A-7). Bootstrap version is pinned in one place (`package.json`) and surfaced into docs/`manifest.json` (A-22: 5.3.0/5.3.3/5.3.8 confusion).

### 5.5 Acceptance for the spike (end of Phase 1)
- Playwright screenshots of a fixture page (every component × light/dark) for all 37 groups: **v2 vs v1 pixel diff ≤ 0.1 %** per page, or a documented, approved difference.
- Size budgets in §2.3 met.
- No `color-mix()` in component states.

### 5.6 Custom class API (Bootstrap mode)
The user-facing contract is **classes applied in markup**, delivered by one jsDelivr `<link>` on top of Bootstrap's own CSS. v2 keeps every v1 class and defines a naming rule so new ones are predictable:

`<utility>-<colour>[-<role>]` where colour ∈ `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `light`, `dark`, `jjjei-primary`, `jjjei-secondary`, `status-0…9` and role ∈ *(none)*, `subtle`, `emphasis`, `faint`, `shaded`, `body`, `gradient`, `gradient-subtle`.
Utilities: `bg-`, `text-`, `border-`, `link-`, `btn-`, `btn-outline-`, `alert-`, `badge-`, `table-`, `list-group-item-`, `loader-`, `nav-pills-`, `bg-pattern-`, `bg-primary-base`.

- They **override** Bootstrap's same-named classes (`.btn-primary`, `.bg-primary-subtle`, …) so existing markup is re-themed with zero edits, and extend them with the custom ones above.
- Selectors keep Bootstrap's specificity (no new `!important` beyond v1's custom utilities) so app CSS can still win.
- `manifest.json` lists every class (`classes[]`) and the docs reference is generated from it; CI fails if a v1 class disappears without a deprecation entry.

---

## 6. Tailwind (`tailwind/`)

### 6.1 Tailwind v4 (CSS-first) — primary target
`tailwind/v4/theme.css`:
```css
@theme inline {
  --color-primary: var(--jjjei-primary);
  --color-primary-subtle: var(--jjjei-primary-subtle);
  --color-primary-emphasis: var(--jjjei-primary-emphasis);
  /* …success, warning, danger, info, light, dark, secondary, jjjei-primary, status-0…9 × roles */
}
```
Consumer:
```css
@import "tailwindcss";
@import "./vendor/jjjei-theme-2.0.0.css";   /* theme.css copied from the 2.0.0 release; a remote @import is NOT processed (see §6.3) */
@custom-variant dark (&:where([data-bs-theme=dark], [data-bs-theme=dark] *, [data-theme=dark], [data-theme=dark] *, .dark, .dark *));
```
- `inline` keeps utilities pointing at the live variable, so changing group at runtime works without rebuilding Tailwind; opacity modifiers (`bg-primary/50`) work through Tailwind v4's `color-mix`.
- **Prefix option:** a second file `theme.prefixed.css` exposes `jjjei-*` names so Bootstrap and Tailwind can coexist in one page without class clashes (`bg-primary` means different things in each).
- Runtime values come from `colors/groups/<group>.css` — the same file the Bootstrap mode uses.

### 6.2 Tailwind v3 (compat)
`tailwind/v3/preset.cjs|mjs` with colours as `rgb(var(--jjjei-primary-rgb) / <alpha-value>)`, which is why `-rgb` channel variables are part of the token contract.

### 6.3 Tailwind via CDN script (no build)
**Verified in Spike C:** Tailwind's browser script (`@tailwindcss/browser`) does **not** support `@import` of a theme file (same-origin or cross-origin; error: "The browser build does not support @import"). No-build users paste an inline `@theme inline { … }` block (generated into the docs from `manifest.json`) and load runtime values with a normal `<link>` to `colors/groups/<group>.css`. **Tailwind CLI/Vite build users also cannot `@import` the theme from the CDN** — a remote `@import` is passed through un-inlined and the `@theme` is never processed (utilities missing). They must **vendor `theme.css`** into their project (download from the release / `dist.zip`). This makes the npm decision (Q3) worth revisiting for Tailwind build users; until then docs describe the vendoring step.

### 6.5 Custom class API (Tailwind mode)
Same mental model, Tailwind syntax: because the theme registers the colours, the class names are the ones Tailwind generates from the colour keys — `bg-primary`, `bg-primary-subtle`, `text-primary-emphasis`, `border-status-3`, `bg-status-3/20` — with the same colour and role vocabulary as §5.6. Classes that Tailwind can't derive from a colour token (noise `*-gradient`, `bg-pattern-*`, `loader-*`) ship as a small plain-CSS file, `tailwind/v4/extras.css` (v3: `tailwind/v3/extras.css`), loaded with one `<link>` or `@import`. Prefixed variant (`jjjei-primary`) avoids clashing with Bootstrap names on pages that use both.

### 6.4 Test
CI compiles a fixture with the real Tailwind CLI (v3 and v4) and asserts the expected utilities exist in the output and resolve to the `--jjjei-*` variables.

---

## 7. Colours-only (`colors/`)

| File | Contents | For |
|---|---|---|
| `colors/base.css` | system + status tokens (group-independent) | with any group file |
| `colors/groups/<slug>.css` | primary roles only, light + dark | the one file that changes per department |
| `colors/<slug>.css` | base + group | one `<link>` convenience |
| `colors/all.css` | all groups under `[data-jjjei-group]` | runtime switching, dashboards, hub |
| `colors/tokens.json` | W3C DTCG format | design tools (Figma Tokens/Tokens Studio, Style Dictionary) |
| `colors/tokens.flat.json` | computed hex for every role/mode | apps/servers (incl. GAS `UrlFetchApp`), the hub |
| `colors/tokens.mjs` + `.d.ts` | typed ES module | JS/TS apps |
| `colors/_tokens.scss` | Sass maps | Sass projects |

All variable names are documented and stable (§8.3: renaming = MAJOR).

---

## 8. Versioning, releases and jsDelivr

### 8.1 What changes from v1
| v1 | v2 |
|---|---|
| `latest` branch force-pushed by hand from `main` | **`latest` branch is CI-managed only** (alias for the newest stable tag; never hand-pushed). Consumers pin **exact tags** (`@2.3.1`); range URLs (`@2`, `@2.3`) are not part of the v2 contract and are never documented |
| generated CSS committed on `main` (185 files in history ×5 copies) | `dist/` committed **only on release tag commits**, never on `main` |
| `colors/vN/` mutable on `@main` | Removed. Tag = immutable. |
| Laptop `release.py` + `--force` | Tag created by CI after the release PR is merged |
| fonts/images referenced via `@main` | relative URLs inside released files |
| manual `purge_cdn.py` (111 requests) | one scripted purge of the only mutable endpoints (`latest`, `next` branches), fails loudly |

### 8.2 Channels (consumer-facing)
| URL form | Meaning | Recommended for |
|---|---|---|
| `…@2.3.1/dist/…` | exact tag, immutable | **everything that is documented**: the README, docs and snippets show exact tags only, with SRI hashes from `manifest.json` |
| `…@latest/dist/…` | newest stable release, **including future majors** — no stability guarantee | only for consumers that deliberately want the newest design without editing the version; mentioned once in the docs with that warning; CI-managed branch, purged on each stable release |
| `…@next/dist/…` | pre-release branch build | testing upcoming changes |
Pre-release tags (`v2.4.0-rc.1`) are explicit tags like any other and are never moved; `@latest` only ever points at stable tags.

### 8.3 SemVer contract (written into `docs/VERSIONING.md`)
- **MAJOR:** remove/rename a CSS variable, utility class, group slug, file path; change a variable's *meaning*; raise the minimum Bootstrap/Tailwind major.
- **MINOR:** new group/variant, new utility/variable/entry point, new image/font; **hex change of an existing group** (flagged `visual-change` in the changelog and release notes); deprecation notices.
- **PATCH:** contrast fixes that move a value ≤ 1 AA step, build fixes, docs, asset optimisation without visual change.
- **Deprecation:** mark `status: deprecated` + console-friendly note in `manifest.json` for ≥ 1 minor before removal in the next major.

### 8.4 Release automation
1. **Conventional Commits** enforced (commitlint on PR title) — ends `UP: date` history (A-26).
2. **release-please** (or Changesets) maintains a **release PR** (version bump, CHANGELOG).
3. On merging the release PR, `release.yml`:
   1. `npm ci` → full build → **all gates** (§10).
   2. `git checkout --detach`; `git add -f dist`; commit `release: v2.x.y`; `git tag -a v2.x.y`; push the **tag only** (the commit isn't on `main`, which stays clean).
   3. Create the GitHub Release with `dist.zip`, `manifest.json`, release notes.
   4. Fast-forward the `latest` branch to the release tag commit (CI only, no force unless the tag is a descendant check fails → job fails). Purge jsDelivr for `@latest` and `@next` (the only mutable endpoints); verify by fetching a canary file and comparing the SRI hash with `manifest.json`.
   5. *(optional, Q3)* `npm publish --provenance` of the same `dist` for bundler users; jsDelivr's `npm/` endpoint then also works.
4. `next` branch: every merge to `develop` builds and force-updates `next` (dist committed there), purges `@next`.
5. **Rollback:** a bad release is fixed forward with a patch (tags are never moved or deleted); `manifest.json` can carry `"deprecated": "2.3.1 — use 2.3.2"`.

### 8.5 `manifest.json` (consumed by docs and the hub)
```json
{ "name": "…", "version": "2.3.1", "bootstrap": "5.3.8", "tailwind": ["3.4", "4"],
  "cdnBase": "https://cdn.jsdelivr.net/gh/<org>/<repo>@2.3.1/dist/",
  "groups": [{ "slug": "jjjei_admin-0", "hex": "#FFD700", "label": "…", "department": "Admin",
               "status": "active", "legacyId": "jjjei_admin:0" }],
  "files": [{ "path": "bootstrap/jjjei_admin-0.css", "bytes": 24310, "gzip": 5120, "sri": "sha384-…" }],
  "classes": ["bg-primary-subtle", "…"], "variables": ["--jjjei-primary", "…"] }
```
This replaces the five hand-copied lists in v1 (A-23, X-1). Docs snippets with `integrity=` attributes are generated from it.

### 8.6 Release policy (decided)
- **Release when ready, not on a calendar.** A release is cut only when there are releasable changes merged; the release PR (§8.4) is merged when the maintainers decide. No monthly or other fixed cadence, and no empty releases.
- **Plain Semantic Versioning** (rules in §8.3): MAJOR.MINOR.PATCH; release candidates as `X.Y.Z-rc.N` before a MINOR/MAJOR when a consumer test is wanted.
- **Docs advertise exact tags only.** The README and every snippet use a pinned tag (e.g. `@2.3.1`), generated from `manifest.json` so the version in the docs is always the current release, with SRI hashes. Ranges are not documented or supported.
- **`latest` is the single exception**, documented in one short section: for consumers that intentionally want the newest design without changing the version. It follows every stable release, including new majors, so it carries no stability guarantee.
- **Consequence for consumers:** upgrading means changing the version in the URL; the changelog and `manifest.json` list what changed and flag `visual-change` and deprecations.

---

## 9. v1 compatibility and migration

- **v1 stays untouched and live** (its `latest` branch and tags are frozen). This is why **v2 should not publish into the same repo's `latest`** — doing so would silently re-skin every v1 consumer on `@latest` (see Q1).
- **No compat shims (decided).** v1 URLs keep working from the v1 repo; migrating an app means switching to the v2 URL and slug name (`jjjei_admin:0` → `jjjei_admin-0`). The migration guide carries the full mapping table.
- **Migration guide (`docs/MIGRATION.md`)** with a mapping table: v1 URL → v2 URL; variable/class diffs (the v1 class set is fully preserved in the Bootstrap mode; additions are listed); Gill Sans Nova no longer served (host privately if licensed); `bg-primary-gradient` unchanged (45° + noise).
- **Parity test** (§10) is the proof that "serving the assets originally served from v1" holds.

---

## 10. Quality gates (all in CI, all blocking)

| Gate | Test |
|---|---|
| Schema | tokens valid against JSON Schema; unique slugs; every `legacyId` maps back to a v1 group |
| **v1 parity** | for all 37 v1 groups: computed role hexes == v1 compiled values; every v1 class selector exists in `bootstrap/core.css`; every v1 group id maps to exactly one v2 slug in the migration table |
| Contrast | §4.3 matrix; allow-list with expiry |
| Build | full build < 60 s in CI, exit codes propagate, zero new Sass deprecations |
| Size budgets | §2.3 (gzip) |
| Visual regression | Playwright: fixture page × 37 groups × light/dark vs v1 baseline and vs previous v2 tag |
| Tailwind integration | compile fixtures with Tailwind v3 and v4 CLIs |
| Bootstrap integration | page with Bootstrap 5.3.8 CDN CSS + JS bundle; components interactive |
| **GAS-like sandbox** | HTML fixture in a sandboxed `iframe` (`allow-scripts`, no same-origin) loading only jsDelivr-style URLs: fonts/images/CSS render (X-4) |
| URL integrity | every `url()`/`@import`/`href` in dist is relative and resolves to a file in dist; no `@main` strings |
| Link check | docs links and snippet URLs resolve (no `file:///` paths, A-22) |
| Asset checks | SVGO idempotent; every image in manifest; hashes unique (duplicate detection, e.g. `base.svg` vs `logo.svg`) |
| Unit | color-math (against Sass `mix()` reference values), contrast, token computation |

---

## 11. Fonts, images, logos, patterns

### 11.1 Fonts
- **Inter:** replace static `Inter.woff2` with a **variable** woff2 (`wght 100–900`, optionally `ital`), subsetted: `latin` and `latin-ext` files with `unicode-range`; `font-display: swap`; metric-adjusted fallback (`size-adjust`, `ascent-override`) to reduce layout shift. v1 declared only `font-weight: normal`, so bold was faux-bold (A-21).
- `fonts/inter.css`: `@font-face … src: url("files/inter-var-latin.woff2") format("woff2")` — **relative** URL (A-1). The Bootstrap/colour bundles import it optionally (`@import "../fonts/inter.css"` inside the bundle, or a `--jjjei-font-sans` variable only — flag `fonts: bundled|separate`; default **bundled for `bootstrap/<group>.css`** to keep v1 behaviour, separate for `colors/`).
- **Gill Sans Nova: dropped (Q4).** Not copied into v2. Migration guide notes that apps using it must host it privately under their own licence; the v1 repo is left untouched.
- Docs include `<link rel="preload" as="font" type="font/woff2" crossorigin>` snippets generated from `manifest.json`.

### 11.2 Images and logos
- **SVG masters only** in `assets/images/source/logos/<brand>/<layout>[-<variant>].svg`, e.g. `jjjei/stacked.svg`, `jjjei/stacked-dark.svg`, `jjjei/horizontal-50yrs.svg`, `marymart/horizontal.svg`, `mark/base.svg`.
- Build pipeline: **SVGO** (idempotent, keeps `viewBox`, removes editor metadata) → **PNG renditions generated** with `sharp` at defined widths (e.g. 128/256/512/1024) instead of committing hand-exported PNGs (v1 PNGs/SVGs drift independently, dates differ). Output: `images/logos/<brand>/<layout>[-variant].svg` and `…@<w>.png`.
- **`currentColor` variants** for mono marks so logos recolour with CSS (`fill: currentColor`), plus `-light`/`-dark` for fixed backgrounds.
- **Aliases for v1 filenames** (`jjjei_stacked.svg`, `logo.svg`, `marymart_horizontal.svg`…) under `images/legacy/` (no duplication in git: generated at build). Duplicates by hash flagged (`base.svg` = `logo.svg` same size).
- `images/index.json`: name, brand, layout, variant, dimensions, bytes, SRI, `usage` notes (min size, clear space) → hub pulls from this, not from hard-coded lists.
- **Brand-usage metadata** (e.g. `"restricted": true`) so docs can warn about logo use outside the company.

### 11.3 Patterns
- v1 has both file-based SVGs (`images/misc/background-pattern/*.svg`) and data-URI patterns in `backgroundPatterns.json` (grid, dots). v2 unifies: pattern SVGs in `images/patterns/*.svg`, plus `images/patterns.css` with `.bg-pattern-<name>` classes using relative `url()`s (no data URIs → better caching, smaller core).
- Patterns accept colour via `mask-image` + `background-color: currentColor` so they follow theme colours (the v1 hex-baked SVGs can't). Fallback to plain `background-image` where `mask` is unsupported.

### 11.4 Loaders
`loaders.json` is currently *read but unused* by v1 (loader CSS is hard-coded in the generator). v2 generates `.loader*` from the JSON (ring/pulse/dots), honouring `prefers-reduced-motion`.

---

## 12. Decisions (resolved)

| # | Question | Decision | Effect on plan |
|---|---|---|---|
| Q1 | Where does v2 live? | **New repo** | v1 repo and its `latest` branch stay frozen; v2 gets its own tags. No compat shims (§9). |
| Q2 | Build language | **Node-only** (default, not challenged) | Python dropped. |
| Q3 | npm publishing | **Not at first** | jsDelivr-on-GitHub only. §8.4 step 5 stays deferred; the `package.json` stays `private`. |
| Q4 | Gill Sans Nova | **Drop it** | Not shipped in v2. Removed from fonts pipeline, docs, manifest and the hub list. Inter is the only served typeface. |
| Q5 | `.bg-primary-gradient` | **Keep 45° + noise** | No behaviour change. The documented 180°/90° fixed variant is *not* added unless later requested; the v1 docs error is corrected instead. |
| Q6 | Colour-change policy | minor + `visual-change` label (default) | §8.3 as written. |
| Q7 | "Web components" | **Not custom elements.** The goal is **custom CSS classes applied via jsDelivr CDN, overriding Bootstrap and Tailwind** | Phase 8 (`<jjjei-theme>`) removed. Class-based API becomes a first-class deliverable (§5.6 and §6.5). |
| Q8 | Group ids | slug without colon (default) | §2.2 as written. |
| Q9 | Dark mode from OS | opt-in (default) | §2.2 as written. |
| Q10 | Hosting | **jsDelivr only** (no GitHub Pages mirror) | `dist.zip` on each GitHub Release remains for self-hosting. |
| Q11 | Compat shims | **Skip** | `dist/compat/` not built; migration by URL change. |
| Q12 | Bundles | **Both** bundled and split files | As in §2.1/§5.3. |
| Q13 | Channels | **Exact tags are the only documented channel (README first).** CI-managed `latest` branch for consumers who want the newest design without editing the version; `@next` for release candidates. **`@2.3`-style range channels dropped.** | §8.2 table, §8.6. |
| Q14 | Release cadence | **No calendar cadence.** A release is cut only when a new version is ready (there are releasable changes); plain **Semantic Versioning**. | §8.6. |
| Q15 | Next step | **Test the release candidate first**, then Phase 7 | Phase 7 (consumer docs from `manifest.json`, migration guide) waits for a verified RC so the docs quote real URLs. |
| Q16 | 15 inherited contrast exceptions | **Fix before 2.0.0** | Adjust group-colour emphasis (on subtle) and dark-mode emphasis (on the dark surface) until AA passes; list the shifted values in the release notes; empty `tokens/contrast-allow.json`. |
| Q17 | Facilities `1a` and `5a` | **Drop both from v2** | Remove from `groups.json`; breaking for anyone using them, so the migration guide must say so (v1 ids `jjjei_facilities:1a` / `:5a` have no v2 equivalent; `5a` was identical to `6`). Golden/parity fixtures drop them. |
| Q18 | Repository access and licence | **Public + proprietary notice** | Public repo (jsDelivr requires it); add `LICENSE` stating code terms and that logos/brand assets are company property; Inter stays OFL (licence ships with the font). |
| Q19 | npm publishing | **Not now** | Unchanged: Tailwind build users vendor `theme.css`/preset. |
| Q20 | designHub | **Separate project** | Not part of this project; `manifest.json` is the contract it can consume later. |
| Q21 | v1 parity in CI | **Keep local** | `npm run parity` stays a pre-release manual step; documented in `docs/RELEASING.md`. |
| Q22 | Bootstrap support | **5.3.x** | Document 5.3.x as supported (built and tested against 5.3.8); extend the parity fixture to `.navbar`, `.carousel`, `.offcanvas`. 5.2 is out of scope. |

---

## 13. Phased implementation plan

Estimates are focused-engineer days; they assume one developer and the defaults above.

### Phase 0 — Decisions & spikes (3 d)
- Confirm the new repo name/org and jsDelivr access (Q1 resolved: new repo).
- **Spike A – jsDelivr behaviour:** in a throwaway repo, push tags `v0.1.0`, `v0.1.1`, `v0.2.0`, `v1.0.0-rc.1`; confirm that files committed **only on a tag commit** (not on any branch) are served at exact tags, and the `latest`/`next` branch behaviour and purge. (Range resolution is no longer needed.) *This validates the whole §8 design; do it first.*
- **Spike B – variable-driven Bootstrap override** (§5.5) with `.btn`, `.alert`, `.nav-pills`, `.form-check-input`, `.page-link`, `.accordion` for 3 groups. Go/no-go on the §5.1 approach vs §5.2 fallback.
- **Spike C – Tailwind v4 `@theme inline` over CSS variables** with opacity modifiers and dark variant; check browser-script import limitation (§6.3).
- **Exit:** written spike results appended to this plan; go/no-go.

### Phase 1 — Foundation: tokens, math, CI skeleton (5 d)
- Scaffold `assets_v2` (layout §3), Node toolchain, lint/format, vitest, commitlint.
- Copy v1 configs → `tokens/`, migrate to extended format (§4.1), write schemas, write conversion script `v1-config → v2-tokens` with a test proving lossless round-trip.
- `color-math.mjs` + unit tests vs Sass `mix()` reference values.
- `compute-tokens.mjs`; contrast matrix; **golden parity test against v1's compiled CSS** (extract custom properties from `assets_v1/colors/latest/*.css`).
- CI: `ci.yml` (install, schema, unit, parity, contrast).
- **Exit:** `npm run tokens` produces `computed.json`; parity test green for all 37 groups (or intentional deltas documented).

**Phase 1 status: DONE (2026-10-14)** — in `assets_v2/` (empty git repo, nothing committed yet). Delivered: Node scaffold, `tokens/` migrated from v1 config + hub labels (37 groups, 10 system, 10 status) with JSON Schemas, `color-math`, `compute-tokens`, contrast gate with expiring allow-list, v1 parity test against a committed golden snapshot, CI workflow. 20 tests pass. Findings: parity within ±1 for all 592 group values and all shared colours (78.9 % exact; remainder is v1's truncation); **27 inherited contrast failures** v1 never checked (allow-listed to 2026-12-31); v1 emits no dark-mode subtle colours for `jjjei-primary/secondary` and `status-0…9`; `facilities-1a/5a` unlabeled. Details in `assets_v2/README.md`.

### Phase 2 — Colours-only output (3 d)
- `emit-colors.mjs`: `base.css`, `groups/*.css`, `<slug>.css`, `all.css`, DTCG/flat JSON, ESM + d.ts, SCSS maps.
- Selector support for dark (§2.2); size budgets; unit tests of generated CSS (parse with a CSS parser, assert variable sets).
- **Exit:** a plain HTML page using only `colors/<slug>.css` themes custom elements via variables; budgets met.

**Phase 2 status: DONE (2026-10-14).** `src/build/emit-colors.mjs` writes `dist/colors/` (base, 37 group files, 37 bundles, `all.css`, DTCG + flat JSON, `tokens.mjs`/`.d.ts`, `_tokens.scss`); 30 tests pass, including a Sass compile of the map file and size budgets (base 3.8 KB gz < 6 KB, group 0.44 KB gz < 1.5 KB). Browser check: group switching and light/dark via attribute and `.dark` class work. The all-groups file is 6.6 KB gz. Not yet done: `dist/` is not committed or tagged (Phase 6).

### Phase 3 — Bootstrap 5 override (8–10 d)
- Implement `src/scss/bootstrap-core.scss` per §5.1 (Spike B approach) across all v1 component coverage; utilities/gradients/faint/shaded/body/pills/loaders/patterns.
- In-process Sass compile, parallel emit of 37 bundles, minify (lightningcss), `@use` migration, deprecation gate.
- Visual regression harness + baseline from v1 (render v1 CSS for all groups once; store baselines in CI artifact cache, not git).
- **Exit:** visual diff ≤ 0.1 % all groups/modes; size budgets met; v1 class coverage test green.

**Phase 3 status: DONE (2026-10-14).** `src/scss/core.scss` + `src/build/emit-bootstrap.mjs` write `dist/bootstrap/core.css` (9.4 KB gz, budget 18) and 37 one-link bundles (15.8 KB gz, budget 26); Sass `@use` only, zero deprecation warnings (tested). Verification: 39 unit tests, including coverage of all 235 classes v1 adds on top of stock Bootstrap, and `npm run parity`, which compares **computed styles** of 20 colours × ~25 components × hover/focus/active/focus-visible × light/dark in Chromium against real v1 CSS (a more exact measure than the pixel diff the plan named). Result over all 37 groups × 2 modes = 667,036 values: 610,985 exact, 6,027 within ±1 (rounding), **50,024 differences, every one matched to a documented intentional change, 0 unexpected**. Intentional changes (listed in `README.md`): button focus ring restored, themed `.link-*`/`.text-bg-*`/`.btn-close`, contrast-colour text on active pagination/dropdown/list-group/progress, real emphasis + dark subtle for custom colours, new `link-/text-bg-/table-<colour>` classes. Fixes the harness found in my own first draft: Bootstrap derives button text from the hover/active background, special-cases `light`/`dark` (button shades, table colours, fixed emphasis grays), and `:root` alone overrides dark-mode values on `<html data-bs-theme=dark>`. Side effect: 12 of the 27 inherited contrast exceptions disappeared (they were an artefact of my first hover-text computation); 15 remain allow-listed. Known gaps: Inter is not bundled until Phase 5 (font stack falls back to `sans-serif`); `loaders.json` is still not the source of the loader CSS (v1-equivalent classes are emitted; `.loader-dots` has no size, as in v1); `npm run parity` needs the v1 repo and Chromium, so it is not in CI yet (a committed v1 computed-style snapshot would fix that); `.navbar`, `.carousel` and `.offcanvas` were not in the fixture.

### Phase 4 — Tailwind (4 d)
- `emit-tailwind.mjs`: v4 `theme.css` (+ prefixed), v3 preset (`rgb(var(--…-rgb) / <alpha-value>)`).
- Integration tests with Tailwind v3 and v4 CLIs; docs snippets; resolve §6.3 CDN-script question.
- **Exit:** fixture builds; utilities resolve to variables; dark variant and group switching verified in Playwright.

**Phase 4 status: DONE (2026-10-14).** `src/build/emit-tailwind.mjs` writes `dist/tailwind/`: `v4/theme.css` (`@theme inline`, 1.5 KB gz, budget 4), `v4/theme.prefixed.css` (`jj-*` names), `v4/dark-variant.css`, `v3/preset.cjs|mjs` and one shared `extras.css` (gradients with noise, patterns, loaders; compiled from the same Sass mixins as the Bootstrap core, which now lives partly in `_shared.scss` with byte-identical output). 46 tests pass. Integration tests drive the **real CLIs**: Tailwind 4.3.3 (all 56 colours × 11 roles resolve to their live variable; opacity modifier, `hover:`, `dark:` incl. children of `[data-bs-theme=dark]`) and Tailwind 3.4.19 (preset: alpha-capable base colour, role variables, dark variant; ESM preset equals CJS). Browser check in Chromium: group switching by `data-jjjei-group`, light/dark by attribute and by `.dark`, gradient and `bg-primary-base`, and the no-build path (`@tailwindcss/browser` with the theme pasted inline). Decisions: one `extras.css` instead of per-version copies (identical content); prefix is `jj-` because `jjjei-` would collide with the brand colour `jjjei-primary`; role keys are `subtle, border-subtle, emphasis, contrast, hover, active, faint, shaded, body, body-border` (+ `base` for the group colour), so borders use `border-<c>-border-subtle`. Known limits: v3 role colours (not the base) have no opacity modifier, as the variables hold hex; a remote CDN `@import` is not processed, so build users vendor `theme.css`/`preset` from the release (docs written in the README).

### Phase 5 — Fonts, images, logos, patterns, loaders (5 d)
- Font pipeline (variable Inter subsets, relative `@font-face`, preload snippets). Gill Sans Nova excluded (Q4).
- Image pipeline: SVGO, PNG renditions, naming migration with `images/legacy/` aliases, `images/index.json`, duplicate detection.
- Pattern unification + mask-based recolourable patterns; loaders generated from `loaders.json`.
- **Exit:** URL-integrity gate green (no absolute/`@main` URLs); GAS-sandbox fixture renders fonts and images.

**Phase 5 status: DONE (2026-10-14).** Fonts: variable Inter 5.3.0 fetched from the OFL-licensed `@fontsource-variable/inter` npm package (pinned by the lockfile; licence copied into `dist/fonts/files/`), latin + latin-ext with `unicode-range`, `font-display: swap`, Arial-based metric fallback (values from `@capsizecss/metrics`), relative `@font-face` URLs in `fonts/inter.css` and inside `bootstrap/core.css`; Gill Sans Nova dropped. Images: masters in `assets/images/source/` (7 logos, 10 patterns), SVGO, PNG renditions via sharp (`name@<width>.png`), generated `-light`/`-dark`/`-currentcolor` variants for brand-green logos (the light variant reproduces v1's artwork with 0.000 % pixel difference; v1's dark variants used `#191C1F` except `base-dark` = `#000`, v2 standardises on the system dark), `images/index.json` with SRI, `base.svg`/`logo.svg` duplicate removed, v1 → v2 file mapping saved. Patterns are now files (v1 grid/dots data-URIs extracted) referenced relatively as `../images/patterns/` from core/extras and `patterns/` from `images/patterns.css`; loaders are generated from `loaders.json` (v1's dots loader was invisible; v2 draws three bouncing dots). Deviations from the plan text: no `images/legacy` aliases (consistent with decision Q11: no compat shims, `v1-mapping.json` documents the moves); no `mask`-based recolourable patterns (YAGNI; artwork keeps its own colours). Verification: 60 tests (new: woff2 validity, licence, unicode-range subsets, every relative `url()` in every dist stylesheet resolves, SVGO idempotence, no active content in SVGs, optimisation changes <0.1 % of pixels, PNG widths, SRI/bytes in the index, no duplicate files, loader sizes from tokens); Chromium check (fonts load by relative URL and the latin-ext subset only when a page uses it, all logo variants, patterns and loaders render, no 404s); Bootstrap computed-style parity re-run: 0 unexpected differences (the font stack is now an explicit expected change). Sizes (gzip): `core.css` 9.9 KB (budget 18), bundle 16.1 KB (budget 26), `extras.css` 1.4 KB, `colors/base.css` 5.7 KB (budget 6, little headroom left); `dist/` is 9.2 MB on disk, of which the 37 Bootstrap bundles are 5.4 MB (not served together).

### Phase 6 — Versioning & release automation (4 d)
- `emit-manifest.mjs` (SRI, sizes, groups, classes, variables).
- `release.yml`: release-please → build → tag-commit with `dist` → GitHub Release → purge + canary verification; `next` channel workflow; optional npm publish.
- `docs/VERSIONING.md` (the §8.3 contract), CHANGELOG generation.
- **Dry run:** release `v2.0.0-rc.1` to the real repo; consume it through jsDelivr from a test GAS web app.
- **Exit:** canary hash from jsDelivr at the exact tag equals `manifest.json`; `@latest` moves to `2.0.0` after the release and is unaffected by `rc` tags.

**Phase 6 status: DONE locally, not yet exercised on GitHub (2026-10-14).** Delivered: `dist/manifest.json` (version, prerelease flag, pinned `cdnBase` from the origin remote or `GITHUB_REPOSITORY`, Bootstrap/Tailwind versions, 37 groups, 452 classes, 705 variables, 189 files with bytes, gzip and SHA-384 SRI) plus `dist/contrast-report.json`; `src/release/release-commit.mjs` (release commit = main's tree + `dist/` built in a temporary index, parents = main tip + previous `latest`, so `latest` only fast-forwards and nothing is force-pushed; prereleases are tagged but stay out of `latest`'s history; refuses `0.0.0`, stale builds, existing tags and non-fast-forward `latest`; `next` branch for release candidates); `src/release/cdn.mjs` (jsDelivr purge and verification: tag served, SRI of every file, `@latest` moved, ranges reported as INFO only); workflows `release.yml` (release-please PR with `skip-github-release` so it never tags, then build/gates/tag/GitHub Release/promote/purge/verify, re-runnable, skips the `0.0.0` placeholder), `next.yml`, `pr-title.yml` (Conventional Commits), `ci.yml`; `release-please-config.json` (`release-as: 2.0.0-rc.1` for the first release), `docs/VERSIONING.md`, `docs/RELEASING.md` with a first-time checklist and a release-candidate test procedure. Verification: 83 tests (release logic against temporary bare git remotes: dist only on tags, never on main, fast-forward `latest`, rc handling, refusals; CDN logic against a fake jsDelivr: pass, tampered file, tag not served, stale `latest`, retries, purge failures; workflows reference only existing scripts/subcommands). **Full rehearsal with the real project** against a temporary bare remote: `2.0.0-rc.1` → `2.0.0` → `2.1.0`, 190 dist files per tag, 0 on `main`, working tree untouched, `latest` fast-forwarded across both stable releases and excluded the rc, and `verify()` fed from the committed blobs passed all 189 SRI checks. The rehearsal found a real bug, now fixed and tested: `.gitignore` had `build/`, which also ignored `src/build/` (the build scripts would not have been committed); the patterns are now anchored (`/build/`, `/dist/`). **Still unverified (needs the real GitHub repo):** that the Actions workflows run as written (release-please configuration, permissions, bot pushes), and Spike A's questions about jsDelivr (tag-only commits served, `@latest` purge timing). `docs/RELEASING.md` has the steps that settle both with a release candidate; the release workflow's verify step fails loudly if jsDelivr does not serve what the manifest says.

**Pre-release decisions applied (2026-10-14), before the first release candidate:** Q16 contrast: the emphasis colour is now fitted (stepped darker/lighter) until it passes AA on its subtle background and, in dark mode, on the page surface (`dark-surface` token); `tokens/contrast-allow.json` is empty (was 27, then 15); 12 group colours plus the dark emphasis of `jjjei-primary` and `status-9` shift slightly (listed in `README.md`); the body-text `link` colour is decoupled and unchanged; the parity tests accept an emphasis change only where v1's value really failed AA, and the style-parity harness accepts it only where v2's value equals the computed emphasis token. Q17: `facilities:1a`/`5a` removed (35 groups); migration scripts and the golden snapshot skip them. Q18: `LICENSE` added (proprietary, public for CDN only, Inter OFL and Bootstrap-derived icon notices; draft pending the owner's and counsel's confirmation), `package.json` is `private` with `license: SEE LICENSE IN LICENSE`, and `LICENSE` is copied into `dist/`. Q22: Bootstrap 5.3.x documented as supported (`manifest.bootstrapSupported`), parity fixture extended to navbar (incl. dark/primary), carousel and offcanvas: 693 new computed values, all identical to v1 except the `.btn-close` focus ring that was already an accepted change. Q19–Q21: no change. Final parity run over all 35 groups × light/dark (70 runs, 679,490 computed values, now including navbar/carousel/offcanvas): 564,490 exact, 5,644 within ±1, 109,356 accepted and explained, **0 unexpected**.

**Pre-push checks (2026-10-14), all on a clean copy containing only the 89 files that would be committed:** `npm ci` from the lockfile (27 s); `validate`, 85 tests, build and the release rehearsal all pass on **Node 22 (the CI version)** and Node 24, and `dist/` is **byte-identical** between them and to the working copy (the manifest differs only in `cdnBase`, which needs an `origin`); browser smoke test of all 35 one-link bundles (colour equals the group hex, Inter in the stack, no 404s); a release candidate tagged in a temporary bare remote holds 185 dist files (including `LICENSE`), `main` holds none, and every file's SRI verifies against the committed blobs; workflow YAML parses; no broken Markdown links; no secrets, personal emails or local paths in the tree (one `/home/<user>` path in the v1 analysis was redacted). Problems found and fixed: (1) the blocking `npm audit --audit-level=high` would have failed the first CI run on a high `braces` advisory with no patched release in the Tailwind CLIs (test tooling, not shipped); CI now blocks on production dependencies (none) and runs the full audit as non-blocking; (2) stale counts in the README (37 groups, 78.9 %) corrected; (3) `package.json` gained `repository`. Remaining risks are the ones only GitHub can answer: that the Actions workflows run as written, and Spike A (jsDelivr behaviour).

### Phase 7 — Docs and migration (3 d)
- Generate reference from `manifest.json`; short hand-written guides: Quick start (Bootstrap), Tailwind, Colours-only, Fonts/Images, Versioning, Migration.
- Migration table (v1 id → v2 slug/URL), v1 README deprecation banner pointing to v2 (v1 repo gets only a docs commit).
- Update `designHub` to read `manifest.json` (replaces `colorMapping.ts`, raw-GitHub fetches, hard-coded version) — separate small PR in the hub repo.
- **Exit:** a v1 sample GAS app migrated by changing its stylesheet URL and diffed visually.

**Total:** ≈ 37–41 developer days (≈ 8 calendar weeks for one developer; ≈ 5 with two, parallelising Phases 3/4/5 after Phase 2). The class API (§5.6/§6.5) adds ~2 days to Phases 3–4.

---

## 13b. Phase 0 results (Spikes B and C executed locally; Spike A not run)

Environment: Chromium (Playwright, local), Bootstrap 5.3.8, Tailwind 4.3.3, 3 groups chosen to cover the contrast cases (`admin:0` light gold, `hr:0` dark purple, `gmo:1` auto-fixed green). Throwaway code lives in the session scratchpad, not in any repo.

### Spike A — jsDelivr tag/range behaviour: **NOT RUN (declined)**
The §8 design (tag-only `dist/` commits served at exact tags, CI-managed `latest`, purge behaviour; range resolution is no longer relied on) is therefore **still unverified assumption**. It must be verified before Phase 6 (a 1-day task needing a public throwaway repo, or a manual checklist run by a maintainer). Fallbacks if it fails: commit `dist/` on a real `release` branch; advertise exact tags only.

### Spike B — variable-driven Bootstrap override: **GO**
- **Fixture:** 25+ components (btn, outline, link, badges, alert, list-group, nav pills/tabs, pagination, progress, table, dropdown, accordion, checkbox/radio/switch/range/select/input focus, btn-close), 3 groups × light/dark, layered on stock `bootstrap.min.css`, compared with real v1 CSS.
- **Result:** **0 differing pixels in all 6 renders** (target was ≤ 0.1 %) after adding group-independent design tokens.
- **Surface area:** stock Bootstrap hard-codes the primary blue in **25 rule groups** (e.g. `.btn-primary`, `.btn-outline-primary`, `.form-check-input:checked/:focus`, `.form-range` thumbs, `.pagination`, `.progress`, `.list-group`, `.dropdown-menu`, `.nav-pills`, `.nav-link:focus-visible`, `.accordion`, `.table-primary`, `.btn-close`, `:root`/dark roots). Each is overridden by re-pointing `--bs-*` component variables at `--jjjei-*`; the same templated rules apply to every colour name.
- **Things the override layer needs that I had not planned for:**
  1. **Design tokens in core, not per group:** `--bs-font-sans-serif`, `--bs-border-radius`, and `enable-shadows` effects (`.dropdown-menu{box-shadow:var(--bs-box-shadow)}`) — without them the first run differed 0.7 %.
  2. **Colours inside data-URIs cannot use `var()`** (switch focus thumb, accordion chevrons, light + dark). Solution proven: precompute them in Node and put `--jjjei-primary-switch-focus` / `--jjjei-primary-accordion-icon` (a `url("data:…")` value) in the group token file. Dark mode needs its own value, and **both** collapsed and active accordion icon variables must be overridden (v1 recolours both).
  3. **Roles to precompute** (all derived with Bootstrap's own formulas, tint/shade chosen by `color-contrast`): `contrast, hover-bg, hover-border, active-bg, active-border, focus-rgb, focus-border, range-active, table-{color,bg,border,striped,active,hover}`. No `color-mix()` needed for component states.
- **Size (measured/estimated):** group token file **1.9 KB raw / 0.68 KB gzip**; v1 file was 24.95 KB gzip. Full core (templated for all 20 colours: 10 system + 10 status) estimated **≈ 61 KB raw / ≈ 4.9 KB gzip**; group-independent `base.css` estimated **≈ 28 KB raw / ≈ 5.7 KB gzip** (pessimistic: random hex). Estimated single-link bundle ≈ 11–12 KB gzip — inside the §2.3 budgets. The saving comes mostly from not re-shipping Bootstrap's component CSS that apps already load.
- **v1 defect found (accessibility):** v1 uses a literal `#fff` for the *active* text colour of **pagination, dropdown, list-group, progress bar** (Bootstrap's `$component-active-color`), e.g. white on `#FFD700` = **1.40:1**; `gmo:1` is 4.25:1 (fails AA); `hr:0` passes (9.42:1). v2 can fix this with one variable (`--jjjei-primary-contrast`). Measured effect of the fix vs v1: 443 / 489 px (≈ 0.05 %) differ for admin:0 and gmo:1, 0 for hr:0 — i.e. the fix only changes the broken cases. Add to the migration notes as an intentional change (§9).
- **Other v1 oddity noted:** `--bs-jjjei-primary-text-emphasis` is `#F8F9FA` (near-white) in v1 — it is `color-contrast()` output, not an emphasis colour. v2 should define a real emphasis for system/status colours (A-15).
- **Decision:** adopt §5.1 (variable-driven override layer); §5.2 per-group compile fallback is **not needed** for the components tested. Not tested: system/status colours (same mechanism, group-independent), `.navbar`, `.carousel`, gradients/noise utilities, patterns, loaders; they are templated rules with no new mechanism but belong in the Phase 3 visual-regression fixture.

### Spike C — Tailwind v4 over CSS variables: **GO, with documentation changes**
- `@theme inline { --color-primary: var(--jjjei-primary) … }` compiles to utilities that reference the **live variable** (`.bg-primary{background-color:var(--jjjei-primary)}`), so **no rebuild is needed to switch groups**: swapping the token `<link>` changed `bg-primary` from `rgb(255,215,0)` to `rgb(128,0,128)` and `bg-primary-subtle` accordingly.
- **Opacity modifier works** (`bg-primary/50` → `color-mix(in oklab, var(--jjjei-primary) 50%, transparent)`).
- **Dark variant bug in my first draft (fixed in §6.1):** `:where([data-bs-theme=dark], .dark, .dark *)` does not match *descendants* of `[data-bs-theme=dark]`; the working variant is `(&:where([data-bs-theme=dark], [data-bs-theme=dark] *, [data-theme=dark], [data-theme=dark] *, .dark, .dark *))`. With it, `dark:bg-primary` and the dark `*-subtle` tokens switch correctly.
- **CDN limits (important):** the browser script cannot `@import` a theme (see §6.3), and Tailwind CLI/Vite builds do not inline a remote `@import`. Consequences: no-build users get an inline `@theme` snippet; build users must vendor `theme.css`; npm publishing becomes the cleaner path for them (re-open Q3 if Tailwind build users matter).
- Tailwind **v3 preset was not tested** (no runtime risk expected; verify in Phase 4).

### Plan changes triggered by Phase 0
1. §6.1 dark-variant snippet corrected; §6.3 rewritten with verified behaviour; add a "vendor `theme.css`" doc page (Phase 4).
2. §5: core must include design tokens (font, radius, shadows) and group files must carry data-URI role tokens (light + dark) — added to Phase 3 scope.
3. Contrast: fix the `#fff` active-colour defect and record it as an intentional v1→v2 visual change.
4. Spike A remains open and blocks Phase 6 sign-off.

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Variable-driven Bootstrap override can't reproduce some compile-time Sass colour behaviours (`color-contrast()`, derived hover/active) | Visual drift vs v1 | Precompute roles in Node (§4.2); Spike B; fallback §5.2; visual-regression gate |
| jsDelivr range/purge behaviour differs from assumption | Wrong consumer guidance | Spike A first; keep exact-tag URLs as the always-correct option; docs state verified behaviour only |
| Committing `dist` on tag-only commits confuses contributors/tools | Release friction | Fully automated in CI; documented; `main` stays source-only |
| A 37-group build explodes CSS size again | Slow pages | Budgets in CI; group files contain only primary roles |
| Tailwind cannot import the theme from a CDN (browser script or CLI/Vite builds) — **confirmed in Spike C** | Build users must vendor `theme.css`; no-build users paste an inline `@theme` | Generate the snippet from `manifest.json`; ship `dist.zip`; revisit npm (Q3) if Tailwind build usage is significant |
| jsDelivr range/tag-commit behaviour unverified (Spike A not run) | Release design may need rework | Run Spike A (or maintainer checklist) before Phase 6; fallbacks in §13b |
| Apps relying on Gill Sans Nova from v1 | Font missing after migration | Migration guide + explicit note; v1 URLs keep working |
| v1 → v2 visual differences upset a department | Support load | Parity + visual gates; intentional deltas listed; exact-tag pinning; v1 stays available |
| Scope creep (web component, npm, docs site) | Delay | Phases 8 and npm are optional; Q-defaults keep MVP = Phases 0–6 |

---

## 15. Definition of done (v2.0.0)

- All 37 v1 groups available in Bootstrap, Tailwind (v3 & v4) and colours-only modes with documented, tested entry points.
- Parity, contrast, visual-regression, size, URL-integrity and sandbox gates green on the release commit.
- Fonts and images served from relative, immutable URLs with manifest + SRI; no `@main` references in `dist`.
- Releases created only by CI from tags; the exact tag and `@latest` are verified on jsDelivr with a canary check.
- Migration guide published; v1 left intact; hub reads `manifest.json`.
