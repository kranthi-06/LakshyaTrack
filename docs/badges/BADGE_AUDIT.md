# Badge inventory and compatibility audit

**Scope:** all 14 achievement badges defined by LakshyaTrack.
**Source of truth:** [`backend/app/progress_engine/workers.py`](../../backend/app/progress_engine/workers.py), `BADGE_RULES`.
**Audit date:** 2026-10-24.

No badge IDs, names, descriptions, categories, rarities, unlock rules, progress keys,
thresholds, persistence fields or database records were changed. The artwork work is
presentation-only.

## Inventory

| # | Badge ID | Display name | Category | Rarity | Unlock rule | Progress key | Threshold | Former emoji | Artwork |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `first_flame` | First Flame | streak | common | Maintain a 3-day login streak | `current_streak` | 3 | 🔥 | `first-flame.svg` |
| 2 | `week_warrior` | Week Warrior | streak | common | Maintain a 7-day login streak | `current_streak` | 7 | ⚡ | `week-warrior.svg` |
| 3 | `fortnight_fighter` | Fortnight Fighter | streak | rare | Maintain a 14-day streak | `current_streak` | 14 | 💫 | `fortnight-fighter.svg` |
| 4 | `monthly_master` | Monthly Master | streak | epic | 30 consecutive days on LakshyaTrack | `current_streak` | 30 | 🌟 | `monthly-master.svg` |
| 5 | `century_legend` | Century Legend | streak | legendary | 100-day streak — true dedication | `longest_streak` | 100 | 👑 | `century-legend.svg` |
| 6 | `quiz_starter` | Quiz Starter | quizzes | common | Pass your first quiz | `quizzes_passed` | 1 | 📝 | `quiz-starter.svg` |
| 7 | `quiz_apprentice` | Quiz Apprentice | quizzes | common | Pass 10 quizzes | `quizzes_passed` | 10 | 🎯 | `quiz-apprentice.svg` |
| 8 | `quiz_master` | Quiz Master | quizzes | rare | Pass 50 quizzes | `quizzes_passed` | 50 | 💎 | `quiz-master.svg` |
| 9 | `first_interview` | Interview Ready | interviews | common | Complete your first mock interview | `interviews_done` | 1 | 🎤 | `first-interview.svg` |
| 10 | `interview_pro` | Interview Pro | interviews | rare | Complete 10 mock interviews | `interviews_done` | 10 | 🏆 | `interview-pro.svg` |
| 11 | `interview_expert` | Interview Expert | interviews | epic | Complete 25 mock interviews | `interviews_done` | 25 | ⚔️ | `interview-expert.svg` |
| 12 | `resume_builder` | Resume Builder | career | common | Create your first resume | `resumes_built` | 1 | 📄 | `resume-builder.svg` |
| 13 | `roadmap_explorer` | Roadmap Explorer | career | common | Generate your first learning roadmap | `roadmaps_created` | 1 | 🗺️ | `roadmap-explorer.svg` |
| 14 | `career_strategist` | Career Strategist | career | rare | Generate 5 learning roadmaps | `roadmaps_created` | 5 | 🏅 | `career-strategist.svg` |

The display name for `first_interview` is **Interview Ready**; the ID is unchanged.

## Unlock and progress behavior

`run_badge_evaluation` evaluates each rule against aggregated user stats:

```python
is_unlocked = rule["check"](user_stats)
current_val = user_stats.get(rule["current_value_key"], 0)
progress = min(100, round((current_val / max(1, rule["requirement_value"])) * 100))
```

- Unlock state comes only from the backend rule, never from artwork metadata or the frontend.
- Progress remains clamped to 0–100 and is calculated by the existing backend formula.
- `century_legend` is the only badge that uses `longest_streak`; every other streak badge uses `current_streak`.
- `career_strategist` shares `roadmaps_created` with `roadmap_explorer`, at thresholds 5 and 1 respectively.
- Unlock timestamps and `pe_badges` records are preserved. The frontend registry contains display metadata only and has no authority over persistence.

## Persistence contract

Records in `pe_badges` continue to use:

`user_id`, `badge_id`, `name`, `icon`, `description`, `category`, `rarity`,
`is_unlocked`, `progress`, `current_value`, `requirement_value`, `unlocked_at`,
`updated_at`.

The legacy `icon` field is still written by the backend for compatibility, but badge
surfaces no longer render emoji. All visual rendering resolves through the art registry
and `BadgeArtwork`. No migration or backfill is required.

## Surface audit

| Surface | File | Artwork usage |
|---|---|---|
| Progress dashboard badge grid | `frontend/src/progress-system/components/BadgeSystem.tsx` | 92 px cards, 56 px next-to-unlock |
| Premium profile gallery | `frontend/src/components/profile/AchievementGalleryPremium.tsx` | 48 / 64 / 104 px carousel, 148 px selected badge, 42 px recent, 40 px next |
| Legacy achievements tab | `frontend/src/components/profile/AchievementsTab.tsx` | 64 px grid, 112 px selected, 32 px recent/next |
| Premium profile overview | `frontend/src/components/profile/OverviewTabPremium.tsx` | 44 px recent badges |
| Legacy profile overview | `frontend/src/components/profile/OverviewTab.tsx` | 40 px recent badges |
| Share interface | — | No share UI exists; the “Share Badge” button remains unwired and is unchanged |

The former per-component `RARITY_COLOR` / `RARITY_CONFIG` maps were removed. Rarity
labels, colors, borders, glows and gradients now come from `BADGE_RARITY_THEME` in the
registry so every surface uses the same palette.

## Compatibility result

- **14/14** backend badges have a registry entry and a generated SVG.
- **0** missing artworks, **0** unregistered files, **0** duplicate badge IDs or filenames.
- All unlock criteria and progress values are untouched.
- The registry is validated by `frontend/src/badges/badgeRegistry.test.ts`, which compares it against a hard-coded mirror of the backend contract.
