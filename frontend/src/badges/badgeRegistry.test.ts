import { describe, expect, it } from 'vitest';
import {
  BADGE_ART,
  BADGE_IDS,
  getBadgeArt,
  getBadgeArtUrl,
  getBadgeCategoryMeta,
  getBadgeInitials,
  getBadgeRarityTheme,
  validateBadgeArtRegistry,
} from './badgeRegistry';

// This mirrors `BADGE_RULES` in backend/app/progress_engine/workers.py.
// If a backend badge changes, this inventory must change with it.
const BACKEND_CONTRACT = [
  ['first_flame', 'First Flame', 'streak', 'common'],
  ['week_warrior', 'Week Warrior', 'streak', 'common'],
  ['fortnight_fighter', 'Fortnight Fighter', 'streak', 'rare'],
  ['monthly_master', 'Monthly Master', 'streak', 'epic'],
  ['century_legend', 'Century Legend', 'streak', 'legendary'],
  ['quiz_starter', 'Quiz Starter', 'quizzes', 'common'],
  ['quiz_apprentice', 'Quiz Apprentice', 'quizzes', 'common'],
  ['quiz_master', 'Quiz Master', 'quizzes', 'rare'],
  ['first_interview', 'Interview Ready', 'interviews', 'common'],
  ['interview_pro', 'Interview Pro', 'interviews', 'rare'],
  ['interview_expert', 'Interview Expert', 'interviews', 'epic'],
  ['resume_builder', 'Resume Builder', 'career', 'common'],
  ['roadmap_explorer', 'Roadmap Explorer', 'career', 'common'],
  ['career_strategist', 'Career Strategist', 'career', 'rare'],
] as const;

describe('badge art registry', () => {
  it('covers every backend badge exactly once with matching metadata', () => {
    expect(BADGE_IDS).toHaveLength(BACKEND_CONTRACT.length);

    for (const [id, name, category, rarity] of BACKEND_CONTRACT) {
      const badge = BADGE_ART[id];
      expect(badge, `missing registry entry for ${id}`).toBeDefined();
      expect(badge.name).toBe(name);
      expect(badge.category).toBe(category);
      expect(badge.rarity).toBe(rarity);
      expect(badge.file).toBe(`${id.replaceAll('_', '-')}.svg`);
    }
  });

  it('resolves a built artwork URL for all 14 badges', () => {
    const validation = validateBadgeArtRegistry();

    expect(validation.missingArt).toEqual([]);
    expect(validation.unregisteredFiles).toEqual([]);
    expect(validation.resolved).toBe(BACKEND_CONTRACT.length);

    const urls = BADGE_IDS.map((id) => getBadgeArtUrl(id));
    expect(new Set(urls).size).toBe(BACKEND_CONTRACT.length);
    for (const url of urls) {
      expect(url).toBeTruthy();
      expect(url).toMatch(/\.svg$/);
    }
  });

  it('returns a null URL for unknown badges so callers can fall back', () => {
    expect(getBadgeArt('not_a_badge')).toBeNull();
    expect(getBadgeArtUrl('not_a_badge')).toBeNull();
  });

  it('maps rarity and category fallbacks to safe defaults', () => {
    expect(getBadgeRarityTheme('legendary').color).toBe('#f59e0b');
    expect(getBadgeRarityTheme('rare').label).toBe('Rare');
    expect(getBadgeRarityTheme('unknown').label).toBe('Common');
    expect(getBadgeRarityTheme(undefined).label).toBe('Common');
    expect(getBadgeCategoryMeta('interviews').label).toBe('Interviews');
    expect(getBadgeCategoryMeta('unknown').label).toBe('Special');
  });

  it('derives compact monogram initials for the fallback', () => {
    expect(getBadgeInitials('First Flame')).toBe('FF');
    expect(getBadgeInitials('Century Legend')).toBe('CL');
    expect(getBadgeInitials('Roadmap Explorer')).toBe('RE');
    expect(getBadgeInitials('Legendary')).toBe('LE');
    expect(getBadgeInitials('')).toBe('?');
  });
});
