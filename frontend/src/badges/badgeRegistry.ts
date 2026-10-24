// ══════════════════════════════════════════════════════════════
// Badge Art Registry — the single source of truth for badge art
// ══════════════════════════════════════════════════════════════
//
// Every badge surface (progress dashboard, profile carousel, recent
// badges, legacy gallery, details panel) resolves artwork through this
// module. Assets live in `src/assets/badges` and are emitted by Vite with
// content hashes, so the registry is the only place that knows filenames.
//
// Badge names, descriptions, categories, rarities, unlock rules and
// progress are owned by the backend (`backend/app/progress_engine/workers.py`).
// The display metadata below mirrors that contract for fallbacks and for
// the artwork audit; it must never be used to decide whether a badge is
// unlocked.

import type { BadgeRarity } from '../progress-system/types';

export interface BadgeArtDefinition {
  id: string;
  name: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  /** Filename inside `src/assets/badges`. */
  file: string;
  /** Primary enamel / emblem accent. */
  accent: string;
  /** Highlight accent used for rim light and metal gradients. */
  accentSecondary: string;
  /** One-line description of the sculpted emblem, used in audits. */
  motif: string;
}

export type BadgeCategory =
  | 'streak'
  | 'problems'
  | 'quizzes'
  | 'interviews'
  | 'career'
  | 'consistency'
  | 'mastery'
  | 'special';

export interface BadgeRarityTheme {
  label: string;
  /** Solid rarity color. Matches the existing dashboard palette. */
  color: string;
  /** Translucent fill for cards and panels. */
  soft: string;
  /** Translucent border. */
  border: string;
  /** Translucent drop shadow. */
  glow: string;
  /** Tailwind gradient classes for dark surfaces. */
  gradient: string;
  /** Tailwind gradient classes for light surfaces. */
  gradientLight: string;
}

export interface BadgeCategoryMeta {
  label: string;
  description: string;
}

export const BADGE_RARITY_THEME: Record<BadgeRarity, BadgeRarityTheme> = {
  common: {
    label: 'Common',
    color: '#94a3b8',
    soft: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.24)',
    glow: 'rgba(148,163,184,0.16)',
    gradient: 'from-slate-600 to-slate-700',
    gradientLight: 'from-slate-300 to-slate-400',
  },
  rare: {
    label: 'Rare',
    color: '#3b82f6',
    soft: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.24)',
    glow: 'rgba(59,130,246,0.18)',
    gradient: 'from-blue-600 to-cyan-600',
    gradientLight: 'from-blue-300 to-cyan-300',
  },
  epic: {
    label: 'Epic',
    color: '#8b5cf6',
    soft: 'rgba(139,92,246,0.09)',
    border: 'rgba(139,92,246,0.26)',
    glow: 'rgba(139,92,246,0.2)',
    gradient: 'from-violet-600 to-purple-600',
    gradientLight: 'from-violet-300 to-purple-300',
  },
  legendary: {
    label: 'Legendary',
    color: '#f59e0b',
    soft: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.28)',
    glow: 'rgba(245,158,11,0.22)',
    gradient: 'from-amber-500 to-orange-500',
    gradientLight: 'from-amber-300 to-orange-300',
  },
};

export const BADGE_CATEGORY_META: Record<BadgeCategory, BadgeCategoryMeta> = {
  streak: { label: 'Streak', description: 'Daily consistency and momentum' },
  problems: { label: 'Problems', description: 'Problem-solving practice' },
  quizzes: { label: 'Quizzes', description: 'Knowledge checks and quiz accuracy' },
  interviews: { label: 'Interviews', description: 'Mock interview practice' },
  career: { label: 'Career', description: 'Resumes and learning roadmaps' },
  consistency: { label: 'Consistency', description: 'Showing up over time' },
  mastery: { label: 'Mastery', description: 'Depth and command of a skill' },
  special: { label: 'Special', description: 'Unique platform achievements' },
};

/**
 * The 14 badges returned by the progress engine. Keep IDs, names, categories
 * and rarities in lockstep with `BADGE_RULES` in the backend.
 */
export const BADGE_ART = {
  first_flame: {
    id: 'first_flame',
    name: 'First Flame',
    category: 'streak',
    rarity: 'common',
    file: 'first-flame.svg',
    accent: '#ff7a1a',
    accentSecondary: '#ffd166',
    motif: 'Sculpted flame rising from a copper brazier',
  },
  week_warrior: {
    id: 'week_warrior',
    name: 'Week Warrior',
    category: 'streak',
    rarity: 'common',
    file: 'week-warrior.svg',
    accent: '#38bdf8',
    accentSecondary: '#e0f2fe',
    motif: 'Forked lightning bolt with kinetic arcs',
  },
  fortnight_fighter: {
    id: 'fortnight_fighter',
    name: 'Fortnight Fighter',
    category: 'streak',
    rarity: 'rare',
    file: 'fortnight-fighter.svg',
    accent: '#22d3ee',
    accentSecondary: '#a5f3fc',
    motif: 'Four-point star inside twin orbital crescents',
  },
  monthly_master: {
    id: 'monthly_master',
    name: 'Monthly Master',
    category: 'streak',
    rarity: 'epic',
    file: 'monthly-master.svg',
    accent: '#a78bfa',
    accentSecondary: '#f5f3ff',
    motif: 'Crescent moon suspended in a violet orbital ring',
  },
  century_legend: {
    id: 'century_legend',
    name: 'Century Legend',
    category: 'streak',
    rarity: 'legendary',
    file: 'century-legend.svg',
    accent: '#fbbf24',
    accentSecondary: '#fff7d6',
    motif: 'Laurel-framed crown with amethyst jewels',
  },
  quiz_starter: {
    id: 'quiz_starter',
    name: 'Quiz Starter',
    category: 'quizzes',
    rarity: 'common',
    file: 'quiz-starter.svg',
    accent: '#2dd4bf',
    accentSecondary: '#ccfbf1',
    motif: 'Open book with a quill and ink well',
  },
  quiz_apprentice: {
    id: 'quiz_apprentice',
    name: 'Quiz Apprentice',
    category: 'quizzes',
    rarity: 'common',
    file: 'quiz-apprentice.svg',
    accent: '#3b82f6',
    accentSecondary: '#dbeafe',
    motif: 'Dartboard struck by a gold-tipped dart',
  },
  quiz_master: {
    id: 'quiz_master',
    name: 'Quiz Master',
    category: 'quizzes',
    rarity: 'rare',
    file: 'quiz-master.svg',
    accent: '#67e8f9',
    accentSecondary: '#ecfeff',
    motif: 'Gold trophy crowned with a cyan crystal',
  },
  first_interview: {
    id: 'first_interview',
    name: 'Interview Ready',
    category: 'interviews',
    rarity: 'common',
    file: 'first-interview.svg',
    accent: '#fb923c',
    accentSecondary: '#ffedd5',
    motif: 'Studio microphone inside a steel shock mount',
  },
  interview_pro: {
    id: 'interview_pro',
    name: 'Interview Pro',
    category: 'interviews',
    rarity: 'rare',
    file: 'interview-pro.svg',
    accent: '#60a5fa',
    accentSecondary: '#dbeafe',
    motif: 'Microphone set into a shield with blue inlays',
  },
  interview_expert: {
    id: 'interview_expert',
    name: 'Interview Expert',
    category: 'interviews',
    rarity: 'epic',
    file: 'interview-expert.svg',
    accent: '#c084fc',
    accentSecondary: '#f3e8ff',
    motif: 'Winged tablet beneath a five-point star',
  },
  resume_builder: {
    id: 'resume_builder',
    name: 'Resume Builder',
    category: 'career',
    rarity: 'common',
    file: 'resume-builder.svg',
    accent: '#fbbf24',
    accentSecondary: '#fef3c7',
    motif: 'Resume sheet, gold wax seal and quill',
  },
  roadmap_explorer: {
    id: 'roadmap_explorer',
    name: 'Roadmap Explorer',
    category: 'career',
    rarity: 'common',
    file: 'roadmap-explorer.svg',
    accent: '#2dd4bf',
    accentSecondary: '#ccfbf1',
    motif: 'Four-point compass rose with chart lines',
  },
  career_strategist: {
    id: 'career_strategist',
    name: 'Career Strategist',
    category: 'career',
    rarity: 'rare',
    file: 'career-strategist.svg',
    accent: '#a78bfa',
    accentSecondary: '#ede9fe',
    motif: 'Violet compass rose framed by a gold laurel',
  },
} as const satisfies Record<string, BadgeArtDefinition>;

export type KnownBadgeId = keyof typeof BADGE_ART;

export const BADGE_IDS = Object.keys(BADGE_ART) as KnownBadgeId[];

// Vite resolves this literal glob at build time and returns hashed URLs
// (for example `/assets/first-flame-8f3c1a.svg`). Keeping the glob here
// means every consumer gets the same asset URL for a badge.
const badgeArtModules = import.meta.glob('../assets/badges/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const artUrlByFilename = new Map<string, string>(
  Object.entries(badgeArtModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1),
    url,
  ]),
);

export function isKnownBadgeId(id: string): id is KnownBadgeId {
  return Object.prototype.hasOwnProperty.call(BADGE_ART, id);
}

export function getBadgeArt(id: string): BadgeArtDefinition | null {
  return isKnownBadgeId(id) ? BADGE_ART[id] : null;
}

/**
 * Resolve a badge ID to its built asset URL.
 * Returns `null` deliberately when an ID has no registered artwork so
 * callers can render the monogram fallback instead of a broken image.
 */
export function getBadgeArtUrl(id: string): string | null {
  const definition = getBadgeArt(id);
  if (!definition) return null;
  return artUrlByFilename.get(definition.file) ?? null;
}

export function getBadgeRarityTheme(rarity: string | undefined | null): BadgeRarityTheme {
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
    return BADGE_RARITY_THEME[rarity];
  }
  return BADGE_RARITY_THEME.common;
}

export function getBadgeCategoryMeta(category: string | undefined | null): BadgeCategoryMeta {
  if (category && category in BADGE_CATEGORY_META) {
    return BADGE_CATEGORY_META[category as BadgeCategory];
  }
  return BADGE_CATEGORY_META.special;
}

export function getBadgeInitials(name: string | undefined | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/**
 * Build-time sanity check used by the verification script and tests.
 * Every registered badge must have a generated SVG and a resolvable URL.
 */
export function validateBadgeArtRegistry(): {
  missingArt: string[];
  unregisteredFiles: string[];
  resolved: number;
} {
  const registeredFiles = new Set<string>(Object.values(BADGE_ART).map((badge) => badge.file));
  const missingArt = Object.values(BADGE_ART)
    .filter((badge) => !artUrlByFilename.has(badge.file))
    .map((badge) => badge.id);

  return {
    missingArt,
    unregisteredFiles: [...artUrlByFilename.keys()].filter((file) => !registeredFiles.has(file)),
    resolved: Object.keys(BADGE_ART).length - missingArt.length,
  };
}
