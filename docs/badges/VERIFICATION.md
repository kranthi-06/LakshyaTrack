# Badge artwork verification

**Result: PASS** — 14/14 badges have dedicated registered artwork, all integrated
surfaces render it, and the full TypeScript, test, build and browser checks pass.

**Verified:** 2026-10-24
**Scope:** badge registry, all 14 SVG assets, five badge surfaces, locked state,
fallback state, light/dark themes, and the standalone 14-badge detail page.

## Environment

| Item | Value |
|---|---|
| OS | Windows (`win32`) |
| Node.js | v24.18.1 |
| npm | 11.16.0 |
| Vite | 7.3.1 |
| Browser QA | Playwright Chromium |
| Viewport used for integration screenshots | 1152 px wide |

## Automated checks

Run from `frontend/`:

```powershell
npx tsc -b --pretty false
npx vitest run --reporter=basic
npm run build
```

| Check | Command | Result |
|---|---|---|
| TypeScript project build | `npx tsc -b --pretty false` | **PASS**, no diagnostics |
| Full test suite | `npx vitest run --reporter=basic` | **PASS**, 19 files / 98 tests |
| Badge-focused tests | same suite | **PASS**, 10 tests (5 registry + 5 component) |
| Production build | `npm run build` | **PASS**, 3,575 modules transformed in 41.39 s |
| ESLint on changed badge files | `npx eslint src/badges …` | **PASS**, 0 errors / 0 warnings |
| Manifest checksums | SHA-256 comparison against `GENERATION_MANIFEST.md` | **PASS**, 14/14 match, 0 mismatches |

The only test-run stderr comes from the existing PDF export tests
(`standardFontDataUrl` warnings). They do not fail a test and are unrelated to badges.

### Production assets emitted by Vite

All 14 SVGs are emitted with content hashes and lazy-loaded through the registry.

| Badge | Emitted asset | Raw | Gzip |
|---|---|---:|---:|
| Quiz Starter | `quiz-starter-ItEU8kqz.svg` | 21.43 kB | 3.79 kB |
| Week Warrior | `week-warrior-DASUVLAN.svg` | 21.43 kB | 3.72 kB |
| Resume Builder | `resume-builder-CAK22j8I.svg` | 21.56 kB | 3.86 kB |
| First Flame | `first-flame-BhMRJnJf.svg` | 21.79 kB | 3.83 kB |
| Roadmap Explorer | `roadmap-explorer-B7u_gnuH.svg` | 22.36 kB | 3.91 kB |
| Interview Pro | `interview-pro-DqiN1RuM.svg` | 22.56 kB | 3.97 kB |
| Quiz Apprentice | `quiz-apprentice-DTXZiBFl.svg` | 22.64 kB | 3.84 kB |
| Career Strategist | `career-strategist-Cahycf5p.svg` | 22.74 kB | 3.94 kB |
| Fortnight Fighter | `fortnight-fighter-COrtBWoC.svg` | 22.91 kB | 4.12 kB |
| Interview Ready | `first-interview-l6ImhNh8.svg` | 22.93 kB | 3.92 kB |
| Monthly Master | `monthly-master-Do4dZekk.svg` | 24.51 kB | 4.02 kB |
| Interview Expert | `interview-expert-CkMZ3nP3.svg` | 24.89 kB | 4.27 kB |
| Quiz Master | `quiz-master-Bw84V1Xo.svg` | 26.39 kB | 4.33 kB |
| Century Legend | `century-legend-CNIuWOiz.svg` | 30.96 kB | 4.68 kB |

Collection total: **329,085 bytes** (14 files). Raw range **21.43–30.96 kB**;
gzip range **3.72–4.68 kB**.

The build also warns about stale Browserslist data, an empty `vendor-ocr` chunk and the
pre-existing large `docxExport` chunk. None are badge-related and none fail the build.

## Registry validation

`validateBadgeArtRegistry()` compares the 14 registry entries with the Vite-resolved
asset map. It is exercised by the test suite and by the browser harness.

| Metric | Result |
|---|---|
| Registry entries | 14 |
| Resolved artwork | 14/14 |
| Missing artwork | 0 |
| Unregistered SVG files | 0 |
| Duplicate IDs / filenames | 0 |
| URLs returned | unique, all ending in `.svg` |
| Unknown badge ID | returns `null`, renders monogram fallback |

The registry is checked against a hard-coded mirror of `BADGE_RULES` in
`backend/app/progress_engine/workers.py`, including ID, display name, category and
rarity. No backend file was modified.

## Browser integration QA

Temporary harness: `frontend/badge-qa.html` rendered all five production surfaces with
a 14-badge mock. It was removed after verification; screenshots are retained.

| Check | Result |
|---|---|
| Registry status text | `registry 14/14 · missing 0 · unregistered 0` |
| Badge wrappers | 71 (70 artwork images + 1 monogram fallback) |
| Unique artwork URLs | 14 |
| Natural dimensions | all `1024×1024` |
| Images decoded | 70/70 |
| HTTP status for unique assets | 14/14 `200` |
| Non-square wrappers or images | 0 |
| Wrapper/image box mismatches | 0 |
| Missing `alt` attributes | 0 |
| Decorative images hidden | 66 |
| Informative images with descriptive `alt` | 4 |
| Locked decorative instances with sr-only progress text | 18 |
| Console warnings / errors | 0 / 0 |
| Carousel navigation | **PASS** — next, previous and previous-wrap update the selected card |

The 71st wrapper is the intentional unknown-ID fallback:

- `data-badge-art="fallback"`
- `role="img"`
- accessible label `Mystery Achievement badge artwork unavailable`
- rarity-tinted hex monogram, no broken image

Locked-state checks confirmed:

- Artwork remains visible with `grayscale(0.86) saturate(0.34) brightness(0.74)`.
- Non-decorative `alt` includes lock state and progress, for example
  `Monthly Master epic achievement badge, locked, 60% complete`.
- Decorative instances keep an sr-only `Locked, 40% complete` (or equivalent)
  description while the lock chip itself is `aria-hidden`.
- Lock chip `title` reports `Locked — 67% complete`.
- Existing progress values are displayed unchanged.

Native lazy loading leaves below-the-fold images pending until they scroll into view.
The full-count check explicitly promoted images to eager and decoded every instance, so
70/70 is not an artifact of offscreen images being skipped.

## Standalone detail page

`docs/badges/detail.html` renders every registered source at 336 CSS px in dark and
light themes, directly from `frontend/src/assets/badges/`.

| Check | Result |
|---|---|
| Instances | 28/28 (14 dark + 14 light) |
| Unique medals | 14 |
| Natural dimensions | all `1024×1024` |
| Failed images | 0 |
| Missing `alt` | 0 |
| Page status text | `28/28 rendered · 14 unique medals · 28 instances` |
| Console warnings / errors | 0 / 0 |

## Accessibility checks

- Artwork is rendered inside a fixed-size square wrapper; wrapper and image boxes match
  at every tested size, so there is no layout shift while loading.
- Informative images use descriptive alt text that names the badge, rarity and lock
  state. Decorative images use `alt=""` and `aria-hidden="true"`.
- Decorative locked instances retain an sr-only lock/progress description, so hiding the
  image does not hide the state.
- The unknown-ID fallback exposes `role="img"` with an accessible name.
- Lazy loading is the default; only a single hero/priority instance opts into
  `loading="eager"` and `fetchPriority="high"`.
- Badge names, requirements and progress remain present as adjacent text in every
  surface, so the artwork is never the only carrier of meaning.
- Both dark and light themes were inspected visually; the artwork sits on a dark plaque
  and keeps its silhouette and rarity accent against either page background.

## Visual checks

Every badge was inspected at appreciation size (336 px) in dark and light themes, and
in its real UI sizes (32–148 px) across:

- Progress dashboard grid and next-to-unlock card
- Premium achievement carousel, selected badge, recent badges and next badge
- Legacy achievements tab grid and detail panel
- Premium and legacy profile overviews
- Locked treatment and unknown-ID fallback

The companion `docs/badges/preview.html` also passed its visual checks: 56/56 images
(14 unlocked + 14 locked + 14 light + 14 small), 14 unique assets, 0 failures, 0 missing
alt attributes and 0 console warnings/errors.

The 14 medals have distinct sculpted emblems (flame brazier, lightning, orbital star,
crescent moon, laurel crown, book and quill, dartboard, crystal trophy, studio
microphone, shield microphone, winged tablet, resume and wax seal, compass rose, laurel
compass). Rarity is carried by silver, blue, violet and gold metal. No emoji, text,
watermarks, signatures, stock icons or shared/recolored artwork is used.

## Screenshot inventory

Retained in `docs/badges/qa/`:

| File | Surface |
|---|---|
| `dark-badge-system.png` | Progress dashboard grid and next-to-unlock, dark |
| `light-badge-system.png` | Progress dashboard grid and next-to-unlock, light |
| `dark-gallery.png` | Premium achievement carousel, dark |
| `light-gallery.png` | Premium achievement carousel, light |
| `dark-legacy.png` | Legacy achievements tab, dark |
| `light-legacy.png` | Legacy achievements tab, light |
| `dark-overview-premium.png` | Premium profile overview recent badges, dark |
| `light-overview-premium.png` | Premium profile overview recent badges, light |
| `dark-overview-legacy.png` | Legacy profile overview recent badges, dark |
| `light-overview-legacy.png` | Legacy profile overview recent badges, light |
| `dark-inventory.png` | Full 14-badge registry inventory, dark |
| `light-inventory.png` | Full 14-badge registry inventory, light |
| `dark-fallback.png` | Unknown-ID monogram and locked fallback states, dark |
| `light-fallback.png` | Unknown-ID monogram and locked fallback states, light |
| `detail-grid-dark.png` | All 14 medals at 336 px, dark (1425×3440) |
| `detail-grid-light.png` | All 14 medals at 336 px, light (1384×1622) |

## Compatibility and unchanged behavior

- No badge IDs, names, descriptions, categories, rarities, unlock criteria, progress
  calculations, persistence fields or database records were changed.
- `century_legend` still uniquely uses `longest_streak`; the other streak badges still
  use `current_streak`.
- `career_strategist` and `roadmap_explorer` still share `roadmaps_created`.
- The backend still writes the legacy `icon` field; it is simply no longer rendered.
- No backend or migration files are part of this change.
- The tour/sharing behavior is unchanged. The “Share Badge” button remains unwired,
  as it was before this work.

## Reproducing

```powershell
cd frontend
node scripts/generate-badge-art.mjs   # deterministic; rewrites the 14 SVGs
npx tsc -b --pretty false
npx vitest run --reporter=basic
npm run build
```

Serve the repository root with any static file server and open
`/docs/badges/detail.html` to inspect all 14 medals in both themes, or
`/docs/badges/preview.html` for locked and 64 px treatments. The generator also writes
`docs/badges/.generated.json` and the SHA-256 values recorded in
`GENERATION_MANIFEST.md` match the delivered assets.

## Residual caveats

1. **Artwork is procedural SVG, not AI-generated raster art.** No image-generation tool
   or API was available. This is documented honestly in `GENERATION_MANIFEST.md`, which
   includes a complete 14-prompt upgrade manifest and negative prompt. The delivered
   SVGs are original, badge-specific production artwork.
2. **Browser QA was Chromium-only.** Light/dark and responsive checks were manual and
   automated in Playwright Chromium; Firefox and Safari were not exercised.
3. **The integration harness was temporary.** It was deleted after QA; the retained
   screenshots and this document are the evidence. The standalone detail page remains
   for direct art inspection.
4. **`frontend/tsconfig.tsbuildinfo` is modified** by running the TypeScript project
   build. It is a build artifact, not a source change.
5. **Build warnings are pre-existing and unrelated:** stale Browserslist data, empty
   `vendor-ocr` chunk and the large `docxExport` chunk.
