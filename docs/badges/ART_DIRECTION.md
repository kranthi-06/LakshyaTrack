# Badge art direction

**Collection:** LakshyaTrack Collectible Medals
**Deliverable:** 14 original 1024×1024 SVG sources
**Palette owner:** `frontend/src/badges/badgeRegistry.ts`
**Generator:** `frontend/scripts/generate-badge-art.mjs`

## Reference translation

The supplied references establish four ideas that the collection carries into production:

1. **A dark hexagonal plaque** with a heavy bevelled edge, so each achievement reads as a physical object rather than an icon.
2. **A sculpted emblem** with real depth, bevels, highlights and an enamel well, not a flat glyph.
3. **Rarity expressed through metal** — neutral silver, blue steel, violet alloy and gold — while the central enamel color stays tied to the badge's own identity.
4. **Neon rim light and a quiet starfield**, giving the plaque a premium, collectible-night-sky mood without turning every badge into the same picture.

The result is a shared frame with a unique silhouette inside it. All 14 medals are
recognizable at 32 px, but designed to be inspected at 300 px and above.

## Shared anatomy

Every medal uses the same construction, drawn in a 1024×1024 viewBox:

| Layer | Construction |
|---|---|
| Aura | Soft accent ellipse behind the plaque; the only intentional paint outside the plaque silhouette |
| Plaque | Hexagon `[512,52] [902,277] [902,747] [512,972] [122,747] [122,277]` |
| Bevel | Four nested hex paths: dark seat, polished rim, dark inner rim, thin accent inlay |
| Surface | Obsidian radial plate, brushed-metal pattern, deterministic starfield, faint constellation, vignette |
| Medallion | Circular well with a 15 px polished ring, dark gasket, inner bevel, accent pinstripe and clipped emblem |
| Emblem | Badge-specific sculpted artwork, authored inside a 250 px radius |
| Tick ring | Requirement-count marks around the medallion (see below) |
| Top gem | Faceted rarity-metal diamond at 12 o'clock with a blurred accent halo |
| Rivets | Six polished rivets at the hex vertices |
| Flourishes | Side rails, upper arc and four corner ornaments in rarity metal |
| Category rune | Small diamond cartouche at the bottom: chevrons for streak, open book for quizzes, waveform for interviews, compass star for career |
| Etching | Fine accent chevrons below the medallion |

### Lighting

A single key light comes from the **upper left**. Every bevel, gem facet, rivet and
emblem highlight follows it. A cooler accent rim light comes from the **lower right**,
which keeps the dark plaque from flattening into a silhouette. Drop shadows fall down
and slightly right.

### Tick ring

The number of marks mirrors the backend threshold, so the object itself carries the
achievement scale without adding text:

- 3, 7, 14, 25 and 30 marks use individual ticks, with stronger every-nth majors.
- 50 marks use ticks.
- 100 marks switch to a dot ring so the circumference stays legible.
- Single-requirement badges use one gem-set marker at 12 o'clock.

No numbers, labels, signatures or watermarks are drawn into the art. Names and
requirements remain real UI text, translated and accessible.

## Rarity language

Rarity is applied to the plaque metal, top gem and outer glow. The enamel and emblem
accents stay badge-specific so rarity does not erase identity.

| Rarity | Hex | Treatment |
|---|---|---|
| Common | `#94a3b8` | Neutral silver / gunmetal bevel, cool white gem, restrained glow |
| Rare | `#3b82f6` | Blue steel bevel, ice-blue rim, saturated blue gem |
| Epic | `#8b5cf6` | Violet alloy bevel, orchid rim, purple gem with a brighter aura |
| Legendary | `#f59e0b` | Gold bevel, warm amber rim, larger visual authority, strongest aura |

These four hex values are the existing dashboard rarity palette and are the single
source used by every surface.

## Emblem direction

| Badge | Rarity | Emblem | Read at small size |
|---|---|---|---|
| First Flame | common | Sculpted flame rising from a copper brazier | Teardrop flame + warm bowl |
| Week Warrior | common | Forked lightning bolt with kinetic arcs | Diagonal bolt |
| Fortnight Fighter | rare | Four-point star inside twin orbital crescents | Star + orbit sweep |
| Monthly Master | epic | Crescent moon suspended in a violet orbital ring | Crescent + ring |
| Century Legend | legendary | Laurel-framed crown with amethyst jewels | Crown + laurel |
| Quiz Starter | common | Open book with a quill and ink well | Open book + diagonal quill |
| Quiz Apprentice | common | Dartboard struck by a gold-tipped dart | Concentric target + dart |
| Quiz Master | rare | Gold trophy crowned with a cyan crystal | Trophy cup + cyan gem |
| Interview Ready | common | Studio microphone in a steel shock mount | Rounded mic capsule |
| Interview Pro | rare | Microphone set into a blue shield | Shield + mic |
| Interview Expert | epic | Winged tablet beneath a five-point star | Wings + star |
| Resume Builder | common | Resume sheet, gold wax seal and quill | Paper + seal |
| Roadmap Explorer | common | Four-point compass rose with chart lines | Compass star |
| Career Strategist | rare | Violet compass rose framed by a gold laurel | Compass + laurel |

The four weakest first-pass emblems were deliberately redrawn: Monthly Master
(crescent), Quiz Apprentice (dartboard), Quiz Master (trophy) and Interview Ready
(studio microphone). They now have distinct silhouettes instead of resembling a star,
target, cup and generic mic.

## Locked treatment

Locking is a UI state, not a second asset. The same SVG is desaturated at render time:

```css
filter: grayscale(0.86) saturate(0.34) brightness(0.74);
```

This keeps the emblem and rarity metal recognizable while clearly reading as unavailable.
A compact lock chip sits at the lower right. Decorative locked instances include
screen-reader-only text such as “Locked, 70% complete”; informative instances carry the
lock state and existing progress in the image description. Progress is never recalculated
in the artwork layer.

## Surfaces and sizing

The oval plaque is intentionally not cropped into a square card. It is rendered with
`object-contain` inside a fixed square wrapper, so the plaque's silhouette, aura and
drop shadow remain intact.

| Context | CSS size |
|---|---|
| Dashboard cards | 92 px |
| Dashboard next-to-unlock | 56 px |
| Gallery carousel | 48 / 64 / 104 px |
| Gallery selected badge | 148 px |
| Gallery recent unlocks | 42 px |
| Gallery next-to-unlock | 40 px |
| Legacy gallery grid | 64 px |
| Legacy selected badge | 112 px |
| Legacy recent/next | 32 px |
| Profile overview | 40–44 px |

Every wrapper declares its width and height before the image loads. The source declares
`width="1024" height="1024"`, so there is no layout shift. Images are lazy by default;
only a single selected/hero badge opts into eager loading and high fetch priority.

## Theme behavior

The medals are self-contained dark objects and are not recolored per theme. They sit on
light cards with a soft shadow and on dark cards with a rarity glow. The plaque's baked
lighting stays consistent because the object is the same in both themes; only the
surrounding surface, border and label colors change. The light-theme QA captures in
`docs/badges/qa/` verify this contrast.

## Fallback direction

If a badge ID is unknown, or a registered SVG fails to load at runtime, the component
renders a deliberate fallback: a hex monogram inset to the plaque's visual size, filled
with a radial gradient in the badge's rarity color, with the same inset bevel and drop
shadow. Initials come from the display name (`First Flame` → `FF`). This avoids broken
image icons and keeps the collection's silhouette language.

## Accessibility and performance

- Informative artwork has a descriptive alt such as “Quiz Master rare achievement badge, locked, 67% complete”.
- Decorative artwork uses `alt=""` and `aria-hidden="true"`, because adjacent text already names the badge.
- The lock chip is `aria-hidden`; lock and progress are communicated in alt or sr-only text.
- Fixed square wrappers, width/height attributes and `object-contain` prevent layout shift.
- Lazy loading and async decoding keep the 70-image gallery cheap; hero art is prioritized.
- SVG sources are 21–31 KB (total 329 KB) and compress to roughly 3.7–4.7 KB each in the production build.
