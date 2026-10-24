# Badge artwork generation manifest

## Status — read this first

**No AI image generator was used for the delivered artwork.**

The environment available for this task had no image-generation tool or API. Rather than
pretend otherwise, the 14 production assets were authored as **original procedural SVG
medals** by `frontend/scripts/generate-badge-art.mjs`. They are real, dedicated artwork
for each badge — not emoji, not stock icons, not a shared image recolored 14 times — but
they are vector illustrations built from code, not AI-generated raster paintings.

This manifest is the complete specification for a future AI-raster upgrade. It can be
used as-is with any 1024×1024 image model and then mapped back through the registry.
Until that upgrade happens, the delivered SVGs are the production artwork.

## Reproducing the delivered collection

```powershell
cd frontend
node scripts/generate-badge-art.mjs
```

The script is deterministic: the starfield and constellation seeds are derived from each
badge ID, so regenerating produces the same collection. It writes 14 SVG files into
`frontend/src/assets/badges/`.

### Delivered files and checksums

| Badge ID | File | Rarity | SHA-256 |
|---|---|---|---|
| `first_flame` | `first-flame.svg` | common | `31471789B1BC5A83E479D4092276EB16FC056631D91F7C22E399ABBCF7223CD0` |
| `week_warrior` | `week-warrior.svg` | common | `FB846CE57DE8454623A2F6ECA6B48C0E3C8405DF54C66A67E271EFF742BECE20` |
| `fortnight_fighter` | `fortnight-fighter.svg` | rare | `A8A93DAAFC2C54EB2D82EBBBFA7E52841D85CD9CC9A9779770096E129E5589D7` |
| `monthly_master` | `monthly-master.svg` | epic | `E155D08EB8AB0576CDB1123A201526E99BDF08A366D964818761A22571F24237` |
| `century_legend` | `century-legend.svg` | legendary | `8C593D7576159E512B9389492F0AB73C27EDD9CF2217ED6BBEFB8B9F3291F803` |
| `quiz_starter` | `quiz-starter.svg` | common | `4714F0E65A0423FAC36F75A565ACAE5B0F8315E4A28AD58D86B683FD76FA57B9` |
| `quiz_apprentice` | `quiz-apprentice.svg` | common | `4C6EA0ECBBE6B4F2508A2341BEEF0D80C14D4E54111FC9015E382DD54B24B1DD` |
| `quiz_master` | `quiz-master.svg` | rare | `B1A5FB8DCEA4AE67795E203A0E90A9D0183A58114C5A1A964642E267F2A04892` |
| `first_interview` | `first-interview.svg` | common | `14FBF51E1F012057F4D6EC99D2991093E4F9521D9AB1E7D05987F46E8FF6A880` |
| `interview_pro` | `interview-pro.svg` | rare | `DDFA807E971308E26438754264C0BD9411E79FA492BEE442AAA7AA3868216777` |
| `interview_expert` | `interview-expert.svg` | epic | `5F12BCCEE9E1CA62C3CCA2F6B80D8B2040DA4308245DAE7E751A757797FA3D74` |
| `resume_builder` | `resume-builder.svg` | common | `CB3E686C01648809FF9802ACFC2DCB8678FE806933BEE11102FB8B314098624C` |
| `roadmap_explorer` | `roadmap-explorer.svg` | common | `66E14894E213FDA85CB33FFC39A41A20BC75A7B484757A69ADD3A9B3F9900EDA` |
| `career_strategist` | `career-strategist.svg` | rare | `55E5D366AE5F9ECD90E5C378791105D9E2F0039C3EF714719A87D7B00A40335A` |

## Shared AI prompt scaffold

Use this as the base for every badge, then append the per-badge fragment. Replace
`{RARITY METAL}` and `{EMBLEM}`.

```text
A premium collectible achievement medal, centered on a 1024x1024 square canvas,
one single medal only. Dark obsidian hexagonal plaque with a thick bevelled
{RARITY METAL} rim, six polished rivets at the hex corners, a faceted
{RARITY METAL} gem at the top, fine engraved tick marks around a circular
enamel medallion, and a tiny diamond category rune at the bottom.
Inside the medallion: {EMBLEM}. Sculpted 3D relief, enamel and metal,
strong silhouette, readable at 32 px, ultra-detailed game achievement icon.
Deep midnight-navy starfield on the plaque; transparent background outside the
plaque and its soft aura. Volumetric key light from the upper left, cool
{RARITY METAL} rim light from the lower right, soft drop shadow.
Square composition, object centered, generous margin, crisp edges,
high contrast, premium AAA game UI art, no text.
```

**Negative prompt (use for every badge):**

```text
text, letters, numbers, typography, words, watermark, signature, logo, UI label,
emoji, flat vector icon, clip art, stock symbol, simple glyph, human face,
human hands, photorealistic person, photograph, busy background, grid of medals,
multiple medals, duplicate plaque, extra gem, extra crown, extra emblems,
cropped plaque, cut-off edges, bright white background, pastel wash, low contrast,
blurry, noisy, jpeg artifacts, distorted geometry, asymmetrical frame, misspelled text
```

**Global acceptance criteria:**

- 1024×1024, sRGB, alpha channel; no baked background outside the aura.
- One medal, centered, plaque occupies roughly 85% of the canvas height.
- Same plaque anatomy and lighting as the delivered collection.
- Rarity metal and glow must match the registry palette.
- Emblem is unique, sculptural and recognizable as a 32 px silhouette.
- No text, numbers, signature or watermark.
- No additional badges, props or scene elements outside the medallion.

## Per-badge generation entries

### 1. `first_flame` — First Flame

- **File:** `first-flame.svg` · **Rarity:** common (silver) · **Ticks:** 3
- **Accent:** `#ff7a1a` · **Highlight:** `#ffd166`
- **Prompt fragment:** `{EMBLEM}` = “a single sculpted orange-and-gold flame rising from a polished copper brazier, layered inner flame, ember sparks and a subtle heat shimmer, flame is the dominant silhouette, brazier base contained inside the medallion”
- **Must read:** teardrop flame above a shallow bowl.
- **Avoid:** candle, torch with a long handle, campfire logs, multiple flames, text.

### 2. `week_warrior` — Week Warrior

- **File:** `week-warrior.svg` · **Rarity:** common (silver) · **Ticks:** 7
- **Accent:** `#38bdf8` · **Highlight:** `#e0f2fe`
- **Prompt fragment:** `{EMBLEM}` = “a single forked lightning bolt forged from blue steel, sharp diagonal silhouette, thin kinetic arcs and electric sparks, cool cyan glow along the edge”
- **Must read:** diagonal zigzag bolt.
- **Avoid:** cloud, weather scene, cartoon bolt, multiple bolts, text.

### 3. `fortnight_fighter` — Fortnight Fighter

- **File:** `fortnight-fighter.svg` · **Rarity:** rare (blue) · **Ticks:** 14
- **Accent:** `#22d3ee` · **Highlight:** `#a5f3fc`
- **Prompt fragment:** `{EMBLEM}` = “a four-point cyan star suspended inside two intersecting orbital crescents, elliptical orbit trails, fine sparkle highlights, sense of momentum and repetition”
- **Must read:** bright four-point star with orbital sweeps.
- **Avoid:** planet, moon, solar system diagram, generic starburst, text.

### 4. `monthly_master` — Monthly Master

- **File:** `monthly-master.svg` · **Rarity:** epic (violet) · **Ticks:** 30
- **Accent:** `#a78bfa` · **Highlight:** `#f5f3ff`
- **Prompt fragment:** `{EMBLEM}` = “a sculpted silver-violet crescent moon suspended inside a thin violet orbital ring, small companion stars and a soft lunar glow, crescent opening to the upper right”
- **Must read:** crescent moon inside a ring.
- **Avoid:** full moon, face in the moon, night landscape, text.

### 5. `century_legend` — Century Legend

- **File:** `century-legend.svg` · **Rarity:** legendary (gold) · **Ticks:** 100 (dot ring)
- **Accent:** `#fbbf24` · **Highlight:** `#fff7d6`
- **Prompt fragment:** `{EMBLEM}` = “a majestic gold crown with three points and amethyst jewel inlays, framed by a symmetrical golden laurel wreath, tiny celebratory sparks, authoritative legendary silhouette”
- **Must read:** crown + laurel.
- **Avoid:** king, throne, realistic portrait, extra crowns, text.

### 6. `quiz_starter` — Quiz Starter

- **File:** `quiz-starter.svg` · **Rarity:** common (silver) · **Ticks:** 1
- **Accent:** `#2dd4bf` · **Highlight:** `#ccfbf1`
- **Prompt fragment:** `{EMBLEM}` = “an open teal-edged book with visible page curves, a slim white quill rising diagonally from the spine, and a small dark ink well at the lower right”
- **Must read:** open book plus diagonal quill.
- **Avoid:** stack of books, graduation cap, readable writing, text.

### 7. `quiz_apprentice` — Quiz Apprentice

- **File:** `quiz-apprentice.svg` · **Rarity:** common (silver) · **Ticks:** 10
- **Accent:** `#3b82f6` · **Highlight:** `#dbeafe`
- **Prompt fragment:** `{EMBLEM}` = “a concentric blue-and-white dartboard seen straight on, with a slim gold-tipped dart striking the bullseye from the lower right, slight motion trail”
- **Must read:** target rings + dart.
- **Avoid:** archery bow, arrow only, real dartboard photo, text.

### 8. `quiz_master` — Quiz Master

- **File:** `quiz-master.svg` · **Rarity:** rare (blue) · **Ticks:** 50
- **Accent:** `#67e8f9` · **Highlight:** `#ecfeff`
- **Prompt fragment:** `{EMBLEM}` = “a polished gold trophy cup with two curved handles, topped by a large faceted cyan crystal, subtle light rays, a dark plinth with a thin cyan inlay”
- **Must read:** trophy cup with cyan crystal.
- **Avoid:** medal on ribbon, champagne, sports scene, multiple trophies, text.

### 9. `first_interview` — Interview Ready

- **File:** `first-interview.svg` · **Rarity:** common (silver) · **Ticks:** 1
- **Accent:** `#fb923c` · **Highlight:** `#ffedd5`
- **Prompt fragment:** `{EMBLEM}` = “a professional studio microphone with a rounded dark grille and warm orange accent ring, suspended in a circular steel shock mount, short stand, subtle sound-wave arcs”
- **Must read:** rounded microphone capsule in a ring mount.
- **Avoid:** handheld mic, podcast desk scene, headset, human mouth, text.

### 10. `interview_pro` — Interview Pro

- **File:** `interview-pro.svg` · **Rarity:** rare (blue) · **Ticks:** 10
- **Accent:** `#60a5fa` · **Highlight:** `#dbeafe`
- **Prompt fragment:** `{EMBLEM}` = “a dark studio microphone centered on a blue-steel heraldic shield, bevelled shield edge, blue enamel inlays, small sound-wave accents, confident professional silhouette”
- **Must read:** shield + microphone.
- **Avoid:** crest with animals, sword, police badge, text.

### 11. `interview_expert` — Interview Expert

- **File:** `interview-expert.svg` · **Rarity:** epic (violet) · **Ticks:** 25
- **Accent:** `#c084fc` · **Highlight:** `#f3e8ff`
- **Prompt fragment:** `{EMBLEM}` = “a violet winged tablet with a subtle microphone etched into its face, flanked by symmetrical swept wings, a five-point gold star rising above it, epic ceremonial composition”
- **Must read:** wings + tablet + star.
- **Avoid:** angel, bird, book with readable text, military badge, text.

### 12. `resume_builder` — Resume Builder

- **File:** `resume-builder.svg` · **Rarity:** common (silver) · **Ticks:** 1
- **Accent:** `#fbbf24` · **Highlight:** `#fef3c7`
- **Prompt fragment:** `{EMBLEM}` = “a cream resume sheet with subtle embossed lines and a folded corner, a gold wax seal at the lower right, a slim quill resting diagonally across the page”
- **Must read:** paper sheet + wax seal.
- **Avoid:** readable paragraphs, laptop, office desk, hand, text.

### 13. `roadmap_explorer` — Roadmap Explorer

- **File:** `roadmap-explorer.svg` · **Rarity:** common (silver) · **Ticks:** 1
- **Accent:** `#2dd4bf` · **Highlight:** `#ccfbf1`
- **Prompt fragment:** `{EMBLEM}` = “a four-point teal compass rose with a dark center gem, fine chart lines and a faint route curve behind it, clean navigational silhouette”
- **Must read:** four-point compass star.
- **Avoid:** realistic map, country outline, GPS pin, text.

### 14. `career_strategist` — Career Strategist

- **File:** `career-strategist.svg` · **Rarity:** rare (blue) · **Ticks:** 5
- **Accent:** `#a78bfa` · **Highlight:** `#ede9fe`
- **Prompt fragment:** `{EMBLEM}` = “a violet four-point compass rose with a gold center gem, framed by a symmetrical gold laurel wreath, fine route lines, strategic premium composition”
- **Must read:** compass + laurel, distinct from Roadmap Explorer.
- **Avoid:** crown, trophy, globe, text.

## Future raster upgrade path

If AI-rendered replacements are produced later:

1. Generate each badge at 1024×1024 with the shared scaffold plus its fragment.
2. Reject any output with text, extra medals, cropped plaque, or a different frame anatomy.
3. Remove the background outside the aura and export a transparent PNG or WebP.
4. Inspect at 32, 64, 148 and 336 px; confirm the silhouette still reads.
5. Save with the same filename stem, for example `first-flame.webp`.
6. Update the `file` field in `frontend/src/badges/badgeRegistry.ts` and, if the
   extension changes, the `import.meta.glob` pattern.
7. Re-run `npx tsc -b`, `npm test`, `npm run build`, and the browser QA harness.
8. Update this manifest with the new generator, seed, model version and checksums.

The delivered SVGs should not be deleted until the replacements pass the same visual,
accessibility, layout and build checks.
