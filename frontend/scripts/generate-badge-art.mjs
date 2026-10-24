/**
 * LakshyaTrack badge art generator.
 *
 * Produces the 14 original 1024x1024 SVG collectible medals that live in
 * `src/assets/badges`. The generator exists so the collection can be revised
 * without hand-editing fourteen near-identical frame files. It uses only Node
 * built-ins and is not part of the production build.
 *
 * Design language: a shared obsidian hex plaque with a rarity-metal bevel, a
 * sculpted enamel medallion, and a unique achievement emblem. Key light comes
 * from the upper-left; the accent rim light comes from the lower-right.
 *
 * Run: node scripts/generate-badge-art.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'assets', 'badges');
mkdirSync(outDir, { recursive: true });

const METALS = {
  common: {
    light: '#f8fafc', light2: '#dbe3ee', mid: '#aebccd', base: '#718096',
    dark: '#3c4a5e', deep: '#141c2b', edge: '#e2e8f0', glow: '#cbd5e1',
  },
  rare: {
    light: '#eaf6ff', light2: '#bae6fd', mid: '#7dd3fc', base: '#3b82f6',
    dark: '#1d4ed8', deep: '#101a45', edge: '#dbeafe', glow: '#60a5fa',
  },
  epic: {
    light: '#f8f5ff', light2: '#ddd6fe', mid: '#b69cff', base: '#8b5cf6',
    dark: '#6d28d9', deep: '#231046', edge: '#ede9fe', glow: '#a78bfa',
  },
  legendary: {
    light: '#fffbe8', light2: '#fde68a', mid: '#fbbf24', base: '#d97706',
    dark: '#92400e', deep: '#3b1a05', edge: '#fef3c7', glow: '#fbbf24',
  },
};

const BADGES = [
  {
    id: 'first_flame', name: 'First Flame', category: 'streak', rarity: 'common',
    accent: '#ff7a1a', accent2: '#ffd166', ticks: 3, emblem: firstFlame,
  },
  {
    id: 'week_warrior', name: 'Week Warrior', category: 'streak', rarity: 'common',
    accent: '#38bdf8', accent2: '#e0f2fe', ticks: 7, emblem: weekWarrior,
  },
  {
    id: 'fortnight_fighter', name: 'Fortnight Fighter', category: 'streak', rarity: 'rare',
    accent: '#22d3ee', accent2: '#a5f3fc', ticks: 14, emblem: fortnightFighter,
  },
  {
    id: 'monthly_master', name: 'Monthly Master', category: 'streak', rarity: 'epic',
    accent: '#a78bfa', accent2: '#f5f3ff', ticks: 30, emblem: monthlyMaster,
  },
  {
    id: 'century_legend', name: 'Century Legend', category: 'streak', rarity: 'legendary',
    accent: '#fbbf24', accent2: '#fff7d6', ticks: 100, emblem: centuryLegend,
  },
  {
    id: 'quiz_starter', name: 'Quiz Starter', category: 'quizzes', rarity: 'common',
    accent: '#2dd4bf', accent2: '#ccfbf1', ticks: 1, emblem: quizStarter,
  },
  {
    id: 'quiz_apprentice', name: 'Quiz Apprentice', category: 'quizzes', rarity: 'common',
    accent: '#3b82f6', accent2: '#dbeafe', ticks: 10, emblem: quizApprentice,
  },
  {
    id: 'quiz_master', name: 'Quiz Master', category: 'quizzes', rarity: 'rare',
    accent: '#67e8f9', accent2: '#ecfeff', ticks: 50, emblem: quizMaster,
  },
  {
    id: 'first_interview', name: 'Interview Ready', category: 'interviews', rarity: 'common',
    accent: '#fb923c', accent2: '#ffedd5', ticks: 1, emblem: interviewReady,
  },
  {
    id: 'interview_pro', name: 'Interview Pro', category: 'interviews', rarity: 'rare',
    accent: '#60a5fa', accent2: '#dbeafe', ticks: 10, emblem: interviewPro,
  },
  {
    id: 'interview_expert', name: 'Interview Expert', category: 'interviews', rarity: 'epic',
    accent: '#c084fc', accent2: '#f3e8ff', ticks: 25, emblem: interviewExpert,
  },
  {
    id: 'resume_builder', name: 'Resume Builder', category: 'career', rarity: 'common',
    accent: '#fbbf24', accent2: '#fef3c7', ticks: 1, emblem: resumeBuilder,
  },
  {
    id: 'roadmap_explorer', name: 'Roadmap Explorer', category: 'career', rarity: 'common',
    accent: '#2dd4bf', accent2: '#ccfbf1', ticks: 1, emblem: roadmapExplorer,
  },
  {
    id: 'career_strategist', name: 'Career Strategist', category: 'career', rarity: 'rare',
    accent: '#a78bfa', accent2: '#ede9fe', ticks: 5, emblem: careerStrategist,
  },
];

// ── Geometry helpers ─────────────────────────────────────────

const HEX = [[512, 52], [902, 277], [902, 747], [512, 972], [122, 747], [122, 277]];
const CX = 512;
const CY = 512;
const MED_CY = 502;

function hexPoints(scale = 1, cx = CX, cy = CY) {
  return HEX.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}
function hexPath(scale = 1) {
  return `M${hexPoints(scale).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;
}
function poly(points) {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}
function starPoints(cx, cy, outer, inner, points = 4, rotation = -90) {
  const out = [];
  const total = points * 2;
  for (let i = 0; i < total; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((rotation + (i * 180) / points) * Math.PI) / 180;
    out.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return out;
}
function star(cx, cy, outer, inner, points, rotation, attrs) {
  return `<polygon points="${poly(starPoints(cx, cy, outer, inner, points, rotation))}" ${attrs}/>`;
}
function sparkle(x, y, s, color, opacity = 0.85) {
  return `<path d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="${color}" opacity="${opacity}"/>`;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ── Shared frame ─────────────────────────────────────────────

function rarityGemGradient(metal) {
  return `<linearGradient id="rarityGem" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.22" stop-color="${metal.light2}"/>
    <stop offset="0.55" stop-color="${metal.mid}"/>
    <stop offset="0.82" stop-color="${metal.dark}"/>
    <stop offset="1" stop-color="${metal.deep}"/>
  </linearGradient>`;
}

function defs(metal, accent, accent2) {
  return `<defs>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${metal.light}"/>
    <stop offset="0.14" stop-color="${metal.mid}"/>
    <stop offset="0.3" stop-color="${metal.dark}"/>
    <stop offset="0.44" stop-color="${metal.light2}"/>
    <stop offset="0.57" stop-color="${metal.base}"/>
    <stop offset="0.72" stop-color="${metal.deep}"/>
    <stop offset="0.86" stop-color="${metal.dark}"/>
    <stop offset="1" stop-color="${metal.edge}"/>
  </linearGradient>
  <linearGradient id="rimDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${metal.dark}"/>
    <stop offset="0.42" stop-color="${metal.deep}"/>
    <stop offset="0.72" stop-color="${metal.base}"/>
    <stop offset="1" stop-color="${metal.deep}"/>
  </linearGradient>
  <linearGradient id="rimLight" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
    <stop offset="0.32" stop-color="${metal.light2}" stop-opacity="0.55"/>
    <stop offset="0.62" stop-color="${metal.dark}" stop-opacity="0.15"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0.38"/>
  </linearGradient>
  <radialGradient id="plate" cx="0.36" cy="0.24" r="0.92">
    <stop offset="0" stop-color="#202d4c"/>
    <stop offset="0.42" stop-color="#111a30"/>
    <stop offset="0.76" stop-color="#080d1c"/>
    <stop offset="1" stop-color="#03050c"/>
  </radialGradient>
  <linearGradient id="plateSheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c7d8ff" stop-opacity="0.16"/>
    <stop offset="0.35" stop-color="#8aa6e8" stop-opacity="0.05"/>
    <stop offset="0.72" stop-color="#000000" stop-opacity="0.05"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.34"/>
  </linearGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.48" r="0.72">
    <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.5"/>
  </radialGradient>
  <radialGradient id="well" cx="0.38" cy="0.28" r="0.85">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.22"/>
    <stop offset="0.42" stop-color="#10172b"/>
    <stop offset="0.8" stop-color="#070b16"/>
    <stop offset="1" stop-color="#02040a"/>
  </radialGradient>
  <radialGradient id="wellOuter" cx="0.4" cy="0.3" r="0.8">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.16"/>
    <stop offset="0.62" stop-color="#0b1222"/>
    <stop offset="1" stop-color="#03050c"/>
  </radialGradient>
  <radialGradient id="aura" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.22"/>
    <stop offset="0.5" stop-color="${accent}" stop-opacity="0.07"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="emblemGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
    <stop offset="0.48" stop-color="${accent}" stop-opacity="0.18"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="innerBevel" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="0.22" stop-color="${metal.light2}" stop-opacity="0.32"/>
    <stop offset="0.5" stop-color="${accent}" stop-opacity="0.08"/>
    <stop offset="0.8" stop-color="#000000" stop-opacity="0.2"/>
    <stop offset="1" stop-color="${metal.edge}" stop-opacity="0.22"/>
  </linearGradient>
  <linearGradient id="accentGem" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.24" stop-color="${accent2}"/>
    <stop offset="0.56" stop-color="${accent}"/>
    <stop offset="0.82" stop-color="${metal.dark}"/>
    <stop offset="1" stop-color="${metal.deep}"/>
  </linearGradient>
  ${rarityGemGradient(metal)}
  <linearGradient id="gold" x1="0" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#fff9dc"/>
    <stop offset="0.22" stop-color="#ffe28a"/>
    <stop offset="0.46" stop-color="#f4b63c"/>
    <stop offset="0.68" stop-color="#c67a13"/>
    <stop offset="0.86" stop-color="#7a3d06"/>
    <stop offset="1" stop-color="#3b1a03"/>
  </linearGradient>
  <linearGradient id="copper" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#ffe9d2"/>
    <stop offset="0.24" stop-color="#ffb477"/>
    <stop offset="0.5" stop-color="#e8762f"/>
    <stop offset="0.72" stop-color="#a44313"/>
    <stop offset="0.9" stop-color="#5a2208"/>
    <stop offset="1" stop-color="#2b0d02"/>
  </linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.2" stop-color="#e2e8f0"/>
    <stop offset="0.45" stop-color="#a7b4c6"/>
    <stop offset="0.68" stop-color="#64748b"/>
    <stop offset="0.86" stop-color="#2c3a4e"/>
    <stop offset="1" stop-color="#0d1523"/>
  </linearGradient>
  <linearGradient id="blueMetal" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#f0f9ff"/>
    <stop offset="0.2" stop-color="#bae6fd"/>
    <stop offset="0.46" stop-color="#60a5fa"/>
    <stop offset="0.7" stop-color="#2563eb"/>
    <stop offset="0.88" stop-color="#172554"/>
    <stop offset="1" stop-color="#070d22"/>
  </linearGradient>
  <linearGradient id="violetMetal" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#fbf8ff"/>
    <stop offset="0.2" stop-color="#e9d5ff"/>
    <stop offset="0.46" stop-color="#c084fc"/>
    <stop offset="0.7" stop-color="#7c3aed"/>
    <stop offset="0.88" stop-color="#2e1065"/>
    <stop offset="1" stop-color="#12051f"/>
  </linearGradient>
  <linearGradient id="tealMetal" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#f0fdfa"/>
    <stop offset="0.2" stop-color="#99f6e4"/>
    <stop offset="0.46" stop-color="#2dd4bf"/>
    <stop offset="0.7" stop-color="#0f766e"/>
    <stop offset="0.88" stop-color="#042f2e"/>
    <stop offset="1" stop-color="#010f0e"/>
  </linearGradient>
  <linearGradient id="paper" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#fffdf4"/>
    <stop offset="0.46" stop-color="#f7edd2"/>
    <stop offset="0.78" stop-color="#d8c49b"/>
    <stop offset="1" stop-color="#8d6f45"/>
  </linearGradient>
  <linearGradient id="flameOuter" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffce6b"/>
    <stop offset="0.28" stop-color="#ff8a1f"/>
    <stop offset="0.58" stop-color="#f04b00"/>
    <stop offset="0.82" stop-color="#9f1d00"/>
    <stop offset="1" stop-color="#3d0900"/>
  </linearGradient>
  <linearGradient id="flameCore" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.28" stop-color="#fff7c2"/>
    <stop offset="0.58" stop-color="#ffd166"/>
    <stop offset="0.84" stop-color="#ff9d00"/>
    <stop offset="1" stop-color="#d35400"/>
  </linearGradient>
  <linearGradient id="ice" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.3" stop-color="#dff6ff"/>
    <stop offset="0.6" stop-color="#7dd3fc"/>
    <stop offset="0.84" stop-color="#2563eb"/>
    <stop offset="1" stop-color="#0b1e4d"/>
  </linearGradient>
  <linearGradient id="violetCrystal" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.22" stop-color="#f5e9ff"/>
    <stop offset="0.5" stop-color="#d8b4fe"/>
    <stop offset="0.72" stop-color="#a855f7"/>
    <stop offset="0.9" stop-color="#581c87"/>
    <stop offset="1" stop-color="#1e0838"/>
  </linearGradient>
  <linearGradient id="cyanCrystal" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.22" stop-color="#e0ffff"/>
    <stop offset="0.5" stop-color="#67e8f9"/>
    <stop offset="0.72" stop-color="#0891b2"/>
    <stop offset="0.9" stop-color="#083344"/>
    <stop offset="1" stop-color="#020d12"/>
  </linearGradient>
  <linearGradient id="moon" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.3" stop-color="#f3e8ff"/>
    <stop offset="0.62" stop-color="#c4b5fd"/>
    <stop offset="0.84" stop-color="#7c3aed"/>
    <stop offset="1" stop-color="#2e1065"/>
  </linearGradient>
  <pattern id="brushed" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
    <path d="M0 0V16" stroke="#ffffff" stroke-opacity="0.026" stroke-width="1"/>
    <path d="M8 0V16" stroke="#000000" stroke-opacity="0.05" stroke-width="1"/>
  </pattern>
  <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="0.7"/>
  </filter>
  <filter id="blur40" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="40"/>
  </filter>
  <filter id="blur18" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="18"/>
  </filter>
  <filter id="blur8" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="8"/>
  </filter>
  <clipPath id="plateClip"><path d="${hexPath(0.905)}"/></clipPath>
  <clipPath id="medallionClip"><circle cx="0" cy="0" r="266"/></clipPath>
</defs>`;
}

function stars(seed, accent, metal) {
  const rand = mulberry32(hashString(seed));
  const out = [];
  for (let i = 0; i < 20; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = 120 + rand() * 300;
    const x = CX + Math.cos(angle) * radius;
    const y = CY + Math.sin(angle) * radius * 0.92;
    if (Math.hypot(x - CX, y - MED_CY) < 330) continue;
    const size = 1.4 + rand() * 2.4;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${rand() > 0.55 ? metal.edge : accent}" opacity="${(0.16 + rand() * 0.38).toFixed(2)}"/>`);
  }
  return out.join('');
}

function ticks(count, metal, accent) {
  // Rendered inside the group already translated to the medallion centre, so
  // every coordinate here is local to (0, 0). Using CX/MED_CY would translate
  // the ring a second time and scatter ticks across (and off) the canvas.
  if (count === 1) {
    return `<g transform="translate(0 -284)">
      <circle cx="0" cy="0" r="14" fill="${metal.deep}" opacity="0.9"/>
      <circle cx="0" cy="0" r="9" fill="url(#rarityGem)" stroke="#05070f" stroke-width="2"/>
      <circle cx="0" cy="0" r="9" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="1.5"/>
    </g>`;
  }
  const out = [];
  const step = 360 / count;
  const dotMode = count > 40;
  const majorEvery = count <= 7 ? 1 : count <= 14 ? 2 : count <= 25 ? 5 : count === 30 ? 5 : 10;
  for (let i = 0; i < count; i += 1) {
    const angle = (-90 + i * step) * (Math.PI / 180);
    const major = i % majorEvery === 0;
    if (dotMode) {
      const r = 283;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      out.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${major ? 2.6 : 1.4}" fill="${major ? metal.light2 : accent}" opacity="${major ? 0.95 : 0.55}"/>`);
    } else {
      const r1 = 276;
      const r2 = major ? 294 : 288;
      const x1 = Math.cos(angle) * r1;
      const y1 = Math.sin(angle) * r1;
      const x2 = Math.cos(angle) * r2;
      const y2 = Math.sin(angle) * r2;
      out.push(`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${major ? metal.light2 : accent}" stroke-width="${major ? 4 : 2.2}" stroke-linecap="round" opacity="${major ? 0.98 : 0.55}"/>`);
    }
  }
  return out.join('');
}

function categoryRune(category, metal, accent) {
  let rune = '';
  if (category === 'streak') {
    rune = `<path d="M-16 9L0 -7L16 9" fill="none" stroke="${metal.light2}" stroke-width="3" stroke-linejoin="round"/>
            <path d="M-16 20L0 4L16 20" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"/>`;
  } else if (category === 'quizzes') {
    rune = `<path d="M0 -12V13M0 0C-9 -5 -18 -6 -23 -3V15C-17 12 -8 13 0 18C8 13 17 12 23 15V-3C18 -6 9 -5 0 0Z" fill="none" stroke="${metal.light2}" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M-15 2V11M15 2V11" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`;
  } else if (category === 'interviews') {
    rune = `<path d="M-20 8V-6M-12 13V-12M-4 6V-2M4 15V-15M12 8V-6M20 12V-10" stroke="${metal.light2}" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M-24 0H24" stroke="${accent}" stroke-width="1.6" opacity="0.7"/>`;
  } else {
    rune = `<path d="M0 -18L6 -4L20 0L6 4L0 18L-6 4L-20 0L-6 -4Z" fill="none" stroke="${metal.light2}" stroke-width="2.2"/>
            <circle cx="0" cy="0" r="3" fill="${accent}"/>`;
  }
  return `<g transform="translate(${CX} 862)">
    <path d="M0 -30L30 0L0 30L-30 0Z" fill="#060a14" stroke="url(#rimDark)" stroke-width="4"/>
    <path d="M0 -24L24 0L0 24L-24 0Z" fill="none" stroke="${metal.base}" stroke-opacity="0.45" stroke-width="1.5"/>
    ${rune}
  </g>`;
}

function frame(badge, emblemMarkup) {
  const metal = METALS[badge.rarity];
  const seed = hashString(badge.id);
  const rand = mulberry32(seed);
  const gem = `<g transform="translate(${CX} 150)">
    <ellipse cx="0" cy="0" rx="34" ry="24" fill="${badge.accent}" opacity="0.3" filter="url(#blur18)"/>
    <path d="M0 -26L20 0L0 26L-20 0Z" fill="url(#rarityGem)" stroke="#05070f" stroke-width="3"/>
    <path d="M0 -26L0 26M-20 0L20 0" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5"/>
    <path d="M-20 0L0 -26L0 0Z" fill="#ffffff" opacity="0.18"/>
    <path d="M0 0L20 0L0 26Z" fill="#000000" opacity="0.22"/>
  </g>`;
  const rivets = hexPoints(0.955).map(([x, y]) => `
    <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
      <circle r="15" fill="${metal.deep}" stroke="#02040a" stroke-width="3"/>
      <circle r="10.5" fill="url(#rim)" stroke="${metal.edge}" stroke-opacity="0.35" stroke-width="1.5"/>
      <circle cx="-3" cy="-3" r="3.2" fill="#ffffff" opacity="0.5"/>
    </g>`).join('');
  const starfield = stars(badge.id, badge.accent, metal);
  const constellation = (() => {
    const rand2 = mulberry32(seed ^ 0x9e3779b9);
    const pts = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = rand2() * Math.PI * 2;
      const radius = 190 + rand2() * 220;
      pts.push([CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius * 0.9]);
    }
    return `<path d="M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}" fill="none" stroke="${metal.edge}" stroke-opacity="0.09" stroke-width="1.2"/>`;
  })();
  const sideFlourish = `
    <path d="M186 358C134 430 124 568 196 666" fill="none" stroke="url(#rimDark)" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
    <path d="M838 358C890 430 900 568 828 666" fill="none" stroke="url(#rimDark)" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
    <path d="M190 372C150 436 146 556 202 636" fill="none" stroke="${metal.light2}" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/>
    <path d="M834 372C874 436 878 556 822 636" fill="none" stroke="${metal.light2}" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/>
    <path d="M304 236Q512 186 720 236" fill="none" stroke="url(#rimDark)" stroke-width="4" stroke-linecap="round" opacity="0.62"/>
    <path d="M322 244Q512 204 702 244" fill="none" stroke="${metal.light2}" stroke-width="1.4" stroke-linecap="round" opacity="0.3"/>`;
  const cornerOrnaments = [[190, 300], [834, 300], [190, 724], [834, 724]].map(([x, y], i) => {
    const angle = i % 2 === 0 ? -18 : 18;
    return `<g transform="translate(${x} ${y}) rotate(${angle})" opacity="0.8">
      <path d="M0 0L34 -8L24 0L34 8Z" fill="url(#rimDark)" stroke="${metal.edge}" stroke-opacity="0.25" stroke-width="1"/>
      <circle cx="16" cy="0" r="2.6" fill="${badge.accent}" opacity="0.8"/>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-labelledby="title desc">
  <title id="title">${badge.name} achievement badge</title>
  <desc id="desc">A ${badge.rarity} collectible medal for ${badge.category}. Original LakshyaTrack badge artwork.</desc>
  ${defs(metal, badge.accent, badge.accent2)}
  <g>
    <ellipse cx="${CX}" cy="${MED_CY}" rx="430" ry="450" fill="url(#aura)" opacity="0.75"/>
    <path d="${hexPath(1)}" transform="translate(0 18)" fill="#000000" opacity="0.55" filter="url(#softShadow)"/>
    <path d="${hexPath(1)}" fill="${metal.deep}" stroke="#02040a" stroke-width="10" stroke-linejoin="round"/>
    <path d="${hexPath(0.982)}" fill="url(#rim)" stroke="#02040a" stroke-width="3" stroke-linejoin="round"/>
    <path d="${hexPath(0.94)}" fill="url(#rimDark)" stroke="#04060d" stroke-width="5" stroke-linejoin="round"/>
    <path d="${hexPath(0.94)}" fill="none" stroke="url(#rimLight)" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>
    <path d="${hexPath(0.921)}" fill="none" stroke="${badge.accent}" stroke-width="1.6" stroke-linejoin="round" opacity="0.4"/>
    <path d="${hexPath(0.905)}" fill="url(#plate)" stroke="#02040a" stroke-width="5" stroke-linejoin="round"/>
    <g clip-path="url(#plateClip)">
      <path d="${hexPath(0.905)}" fill="url(#brushed)"/>
      ${starfield}
      ${constellation}
      <path d="${hexPath(0.905)}" fill="url(#plateSheen)"/>
      <path d="${hexPath(0.905)}" fill="url(#vignette)"/>
      <path d="${hexPath(0.88)}" fill="none" stroke="${metal.edge}" stroke-opacity="0.1" stroke-width="1.5"/>
      <circle cx="${CX}" cy="${MED_CY}" r="336" fill="none" stroke="${metal.edge}" stroke-opacity="0.1" stroke-width="1.4" stroke-dasharray="2 12"/>
      <circle cx="${CX}" cy="${MED_CY}" r="356" fill="none" stroke="${badge.accent}" stroke-opacity="0.08" stroke-width="10"/>
    </g>
    <path d="${hexPath(0.905)}" fill="none" stroke="url(#innerBevel)" stroke-width="3.4" stroke-linejoin="round"/>
    ${sideFlourish}
    ${cornerOrnaments}
    ${rivets}
    ${gem}
    <g transform="translate(${CX} ${MED_CY})">
      <circle r="330" fill="none" stroke="${metal.edge}" stroke-opacity="0.12" stroke-width="1.5"/>
      <circle r="330" fill="none" stroke="${badge.accent}" stroke-opacity="0.16" stroke-width="10" stroke-dasharray="3 18"/>
      <circle r="302" fill="#02040a" opacity="0.72" filter="url(#blur18)"/>
      <circle r="296" fill="none" stroke="#02040a" stroke-width="30"/>
      <circle r="288" fill="none" stroke="url(#rim)" stroke-width="15"/>
      <circle r="277" fill="none" stroke="url(#rimDark)" stroke-width="5"/>
      <circle r="270" fill="url(#wellOuter)" stroke="#03050b" stroke-width="6"/>
      <circle r="264" fill="url(#well)" stroke="url(#rimLight)" stroke-width="2.6"/>
      <circle r="258" fill="none" stroke="${badge.accent}" stroke-opacity="0.28" stroke-width="1.6"/>
      ${ticks(badge.ticks, metal, badge.accent)}
      <g clip-path="url(#medallionClip)">
        <ellipse cx="0" cy="194" rx="190" ry="34" fill="#000000" opacity="0.4" filter="url(#blur18)"/>
        <circle cx="0" cy="0" r="210" fill="url(#emblemGlow)" opacity="0.45" filter="url(#blur18)"/>
        ${emblemMarkup}
      </g>
      <g transform="translate(0 246)" opacity="0.9">
        <path d="M-62 0H-22L-12 8L0 0L12 8L22 0H62" fill="none" stroke="${metal.light2}" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
        <path d="M-38 12H-12L0 4L12 12H38" fill="none" stroke="${badge.accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
      </g>
    </g>
    ${categoryRune(badge.category, metal, badge.accent)}
  </g>
</svg>`;
}

// ── Emblems ──────────────────────────────────────────────────
// All emblems are authored in a local coordinate system centered on the
// medallion. Up is negative Y. Keep the silhouette inside a 250px radius.

function firstFlame() {
  return `<g>
    <g opacity="0.5" stroke="#ffb15c" stroke-width="2">
      ${Array.from({ length: 18 }, (_, i) => {
        const a = (-90 + i * 20) * (Math.PI / 180);
        const x1 = Math.cos(a) * 156;
        const y1 = Math.sin(a) * 156;
        const x2 = Math.cos(a) * 202;
        const y2 = Math.sin(a) * 202;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-opacity="${i % 3 === 0 ? 0.5 : 0.2}"/>`;
      }).join('')}
    </g>
    <path d="M-4 -216C32 -152 92 -132 104 -64C114 -6 76 48 38 80C58 22 38 -22 6 -52C10 10 30 58 72 100C18 132 -58 124 -96 74C-132 26 -124 -46 -82 -96C-56 -126 -28 -166 -4 -216Z" fill="url(#flameOuter)" stroke="#2b0700" stroke-width="8" stroke-linejoin="round"/>
    <path d="M-4 -216C32 -152 92 -132 104 -64C114 -6 76 48 38 80C58 22 38 -22 6 -52C10 10 30 58 72 100C18 132 -58 124 -96 74C-132 26 -124 -46 -82 -96C-56 -126 -28 -166 -4 -216Z" fill="none" stroke="#ffd9a0" stroke-opacity="0.28" stroke-width="3" transform="translate(-4 -5)"/>
    <path d="M-30 -142C-6 -96 22 -86 26 -48C30 -12 8 18 -12 40C0 2 -12 -24 -32 -42C-26 -8 -12 24 14 52C-22 68 -66 48 -78 16C-90 -18 -70 -56 -30 -142Z" fill="url(#flameCore)" opacity="0.94"/>
    <path d="M-4 -90C-22 -54 -18 -18 0 10C18 -14 24 -46 12 -76C8 -86 2 -86 -4 -90Z" fill="#fffdf0" opacity="0.85"/>
    <ellipse cx="0" cy="134" rx="128" ry="34" fill="#240800" opacity="0.85"/>
    <ellipse cx="0" cy="128" rx="122" ry="28" fill="url(#copper)" stroke="#2b0d02" stroke-width="4"/>
    <ellipse cx="0" cy="121" rx="104" ry="19" fill="#3a1002" stroke="#ffb15c" stroke-opacity="0.4" stroke-width="2"/>
    <path d="M-92 128C-62 152 62 152 92 128" fill="none" stroke="#ffe0bb" stroke-opacity="0.4" stroke-width="2.5" stroke-linecap="round"/>
    ${sparkle(-118, -92, 12, '#ffd166', 0.8)}
    ${sparkle(104, -118, 10, '#ffb15c', 0.7)}
    ${sparkle(116, 34, 7, '#fff3c4', 0.6)}
    <g transform="translate(0 170)">
      <path d="M-52 0L-26 -10L0 0L26 -10L52 0" fill="none" stroke="#ffb15c" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    </g>
  </g>`;
}

function weekWarrior() {
  return `<g>
    <g opacity="0.42" fill="none" stroke="#7dd3fc" stroke-width="2.4" stroke-linecap="round">
      <path d="M-214 -70C-182 -158 -110 -208 -20 -214"/>
      <path d="M214 -70C182 -158 110 -208 20 -214"/>
      <path d="M-234 42C-222 -30 -190 -94 -138 -140"/>
      <path d="M234 42C222 -30 190 -94 138 -140"/>
    </g>
    <g opacity="0.9">
      <path d="M-10 -224L14 -186L38 -190L18 -154" fill="none" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round"/>
      <path d="M-44 -206L-24 -172L-2 -178" fill="none" stroke="#7dd3fc" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M48 -202L30 -170L10 -176" fill="none" stroke="#7dd3fc" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <path d="M48 -222L-112 8L-30 8L-70 222L112 -18L26 -18L82 -222Z" fill="url(#blueMetal)" stroke="#06122e" stroke-width="9" stroke-linejoin="round"/>
    <path d="M48 -222L-112 8L-30 8L-70 222L112 -18L26 -18L82 -222Z" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" transform="translate(-3 -4)"/>
    <path d="M34 -164L-64 -2L-18 -2L-46 132L62 -44L4 -44L44 -164Z" fill="url(#ice)" opacity="0.86"/>
    <path d="M24 -134L-24 -18L2 -18L-14 70L34 -34L6 -34L24 -134Z" fill="#ffffff" opacity="0.52"/>
    <circle cx="-4" cy="4" r="148" fill="none" stroke="#7dd3fc" stroke-opacity="0.2" stroke-width="2" stroke-dasharray="3 14"/>
    <g transform="translate(0 192)">
      <path d="M-106 0C-64 12 -20 12 0 4C20 12 64 12 106 0" fill="none" stroke="#7dd3fc" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
    </g>
    ${sparkle(-148, 84, 11, '#e0f2fe', 0.8)}
    ${sparkle(142, -94, 9, '#7dd3fc', 0.7)}
    ${sparkle(122, 132, 6, '#ffffff', 0.5)}
  </g>`;
}

function fortnightFighter() {
  return `<g>
    <g opacity="0.5">
      <path d="M-188 -132C-92 -214 76 -202 152 -86C196 -18 186 58 136 118" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/>
      <path d="M-152 150C-72 210 66 208 142 126C190 74 206 6 184 -54" fill="none" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    </g>
    <path d="M-230 -142C-120 -222 68 -206 160 -78C224 14 200 116 118 168C154 96 142 20 88 -40C40 -94 -44 -110 -118 -72C-164 -48 -202 -2 -214 58C-236 4 -244 -74 -230 -142Z" fill="url(#blueMetal)" stroke="#05142e" stroke-width="7" stroke-linejoin="round" opacity="0.95"/>
    <path d="M-214 -126C-112 -190 56 -176 138 -66C190 6 178 88 116 138C132 76 108 16 62 -28C16 -72 -58 -86 -124 -54C-166 -34 -196 -2 -206 42C-220 0 -224 -66 -214 -126Z" fill="url(#cyanCrystal)" opacity="0.5"/>
    <path d="M-232 128C-154 202 -26 214 72 162C152 120 202 38 196 -50C214 26 182 118 106 166C10 226 -136 206 -232 128Z" fill="url(#blueMetal)" stroke="#05142e" stroke-width="6" stroke-linejoin="round" opacity="0.9"/>
    <g transform="rotate(45)">
      ${star(0, 0, 150, 42, 4, -90, 'fill="url(#ice)" stroke="#e0ffff" stroke-opacity="0.5" stroke-width="2"')}
      ${star(0, 0, 92, 26, 4, -90, 'fill="url(#cyanCrystal)" opacity="0.9"')}
    </g>
    ${star(0, 0, 232, 30, 4, -90, 'fill="url(#ice)" opacity="0.92" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"')}
    ${star(0, 0, 158, 20, 4, -90, 'fill="url(#cyanCrystal)" opacity="0.85"')}
    <circle cx="0" cy="0" r="36" fill="#ffffff" opacity="0.9" filter="url(#blur8)"/>
    <circle cx="0" cy="0" r="17" fill="#ffffff"/>
    <path d="M-176 -60L-120 -78M168 -96L120 -112M-160 76L-112 92M154 84L108 104" stroke="#a5f3fc" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    ${sparkle(-132, -154, 12, '#e0ffff', 0.85)}
    ${sparkle(146, -146, 9, '#22d3ee', 0.75)}
    ${sparkle(150, 130, 11, '#a5f3fc', 0.65)}
    ${sparkle(-158, 118, 7, '#ffffff', 0.5)}
  </g>`;
}

function monthlyMaster() {
  return `<g>
    <defs>
      <mask id="mmMoonCut">
        <rect x="-280" y="-280" width="560" height="560" fill="#ffffff"/>
        <circle cx="86" cy="-34" r="134" fill="#000000"/>
      </mask>
      <radialGradient id="mmMoonGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#c4b5fd" stop-opacity="0.35"/>
        <stop offset="0.62" stop-color="#a78bfa" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="-26" cy="6" r="206" fill="url(#mmMoonGlow)"/>
    <g opacity="0.55">
      <circle cx="0" cy="0" r="212" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="3 16"/>
      <ellipse cx="0" cy="0" rx="224" ry="82" transform="rotate(-26)" fill="none" stroke="#c4b5fd" stroke-opacity="0.4" stroke-width="2.4"/>
      <ellipse cx="0" cy="0" rx="186" ry="60" transform="rotate(34)" fill="none" stroke="#fbbf24" stroke-opacity="0.2" stroke-width="2"/>
    </g>
    <g transform="rotate(-14)">
      <circle cx="0" cy="0" r="162" fill="url(#moon)" mask="url(#mmMoonCut)"/>
      <circle cx="0" cy="0" r="162" fill="none" stroke="#f5f3ff" stroke-opacity="0.35" stroke-width="3" mask="url(#mmMoonCut)"/>
      <circle cx="-58" cy="-68" r="17" fill="#6d28d9" opacity="0.18"/>
      <circle cx="-86" cy="6" r="11" fill="#6d28d9" opacity="0.16"/>
      <circle cx="-42" cy="78" r="14" fill="#6d28d9" opacity="0.14"/>
      <circle cx="-116" cy="-52" r="7" fill="#6d28d9" opacity="0.14"/>
      <path d="M-150 -52C-166 -16 -168 24 -152 58" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>
    </g>
    <g transform="translate(142 -126)">
      ${star(0, 0, 26, 7, 4, -90, 'fill="url(#gold)" stroke="#3b1a03" stroke-width="2"')}
    </g>
    <g transform="translate(-168 122)">
      ${star(0, 0, 30, 8, 4, -90, 'fill="url(#violetCrystal)" stroke="#ede9fe" stroke-opacity="0.4" stroke-width="1.5"')}
    </g>
    <circle cx="150" cy="86" r="9" fill="#fde68a" opacity="0.9"/>
    <circle cx="120" cy="140" r="5" fill="#c4b5fd" opacity="0.8"/>
    ${sparkle(-140, -158, 10, '#ede9fe', 0.8)}
    ${sparkle(166, 152, 7, '#c4b5fd', 0.65)}
    ${sparkle(60, -190, 6, '#ffffff', 0.6)}
  </g>`;
}

function centuryLegend() {
  return `<g>
    <g opacity="0.45" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round">
      ${Array.from({ length: 40 }, (_, i) => {
        const a = (-90 + i * 9) * (Math.PI / 180);
        const r1 = i % 2 === 0 ? 196 : 184;
        const r2 = i % 2 === 0 ? 236 : 214;
        return `<path d="M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2).toFixed(1)}" stroke-opacity="${i % 5 === 0 ? 0.8 : 0.34}"/>`;
      }).join('')}
    </g>
    <g opacity="0.8">
      <path d="M-188 72C-152 146 -80 192 0 198C80 192 152 146 188 72" fill="none" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>
      <path d="M-188 72C-152 146 -80 192 0 198C80 192 152 146 188 72" fill="none" stroke="#fff7d6" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g>
      <path d="M-158 116C-186 66 -190 0 -160 -54C-140 -24 -138 18 -148 58Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="5"/>
      <path d="M158 116C186 66 190 0 160 -54C140 -24 138 18 148 58Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="5"/>
      <path d="M-158 116C-178 84 -180 40 -168 8" fill="none" stroke="#fff7d6" stroke-opacity="0.4" stroke-width="2"/>
      <path d="M158 116C178 84 180 40 168 8" fill="none" stroke="#fff7d6" stroke-opacity="0.4" stroke-width="2"/>
    </g>
    <path d="M-132 104L-112 -56L-48 6L0 -154L48 6L112 -56L132 104Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="8" stroke-linejoin="round"/>
    <path d="M-132 104L-112 -56L-48 6L0 -154L48 6L112 -56L132 104Z" fill="none" stroke="#fffbe8" stroke-opacity="0.35" stroke-width="3" transform="translate(-3 -4)"/>
    <rect x="-140" y="82" width="280" height="52" rx="18" fill="url(#gold)" stroke="#3b1a03" stroke-width="6"/>
    <rect x="-122" y="94" width="244" height="16" rx="8" fill="#7c3aed" opacity="0.8"/>
    <circle cx="-104" cy="108" r="7" fill="#fef3c7"/><circle cx="-72" cy="108" r="7" fill="#fef3c7"/><circle cx="-40" cy="108" r="7" fill="#fef3c7"/><circle cx="-8" cy="108" r="7" fill="#fef3c7"/><circle cx="24" cy="108" r="7" fill="#fef3c7"/><circle cx="56" cy="108" r="7" fill="#fef3c7"/><circle cx="88" cy="108" r="7" fill="#fef3c7"/>
    <g>
      <path d="M0 -174L18 -138L0 -100L-18 -138Z" fill="url(#violetCrystal)" stroke="#fef3c7" stroke-width="3"/>
      <path d="M0 -174L0 -100L-18 -138Z" fill="#ffffff" opacity="0.25"/>
      <path d="M-112 -70L-90 -46L-104 -18L-126 -42Z" fill="url(#violetCrystal)" stroke="#fef3c7" stroke-width="2"/>
      <path d="M112 -70L90 -46L104 -18L126 -42Z" fill="url(#violetCrystal)" stroke="#fef3c7" stroke-width="2"/>
    </g>
    <path d="M-68 150L-44 130L-20 150L0 130L20 150L44 130L68 150" fill="none" stroke="#7c3aed" stroke-width="5" stroke-linecap="round"/>
    ${sparkle(-170, -128, 12, '#fff7d6', 0.9)}
    ${sparkle(166, -132, 10, '#fbbf24', 0.8)}
    ${sparkle(178, 126, 7, '#fef3c7', 0.7)}
    ${star(0, 176, 26, 7, 4, -90, 'fill="url(#gold)"')}
  </g>`;
}

function quizStarter() {
  return `<g>
    <g opacity="0.45">
      <circle cx="0" cy="0" r="210" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="2 14"/>
      <path d="M-206 -54H-166M166 -54H206M-206 54H-166M166 54H206" stroke="#99f6e4" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <path d="M-204 48L-12 -12L-12 112L-204 178Z" fill="#0b3b39" stroke="#042f2e" stroke-width="8" stroke-linejoin="round"/>
    <path d="M204 48L12 -12L12 112L204 178Z" fill="#0b3b39" stroke="#042f2e" stroke-width="8" stroke-linejoin="round"/>
    <path d="M-190 44L-18 0L-18 96L-190 152Z" fill="url(#paper)" stroke="#7d6a45" stroke-width="3"/>
    <path d="M190 44L18 0L18 96L190 152Z" fill="url(#paper)" stroke="#7d6a45" stroke-width="3"/>
    <path d="M-18 0L0 8L18 0L18 96L0 106L-18 96Z" fill="#d8c49b" stroke="#7d6a45" stroke-width="3"/>
    <g stroke="#8c7854" stroke-width="3" stroke-linecap="round" opacity="0.65">
      <path d="M-166 54L-42 20M-166 76L-42 42M-166 98L-92 76M-166 120L-106 102"/>
      <path d="M166 54L42 20M166 76L42 42M166 98L92 76M166 120L106 102"/>
    </g>
    <path d="M-152 172C-104 160 -64 158 -18 168" fill="none" stroke="#2dd4bf" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
    <g transform="rotate(-34)">
      <path d="M-26 210L-10 34L16 30L22 208Z" fill="url(#steel)" stroke="#0d1523" stroke-width="4"/>
      <path d="M-10 34L3 30L10 148L-18 154Z" fill="#ffffff" opacity="0.2"/>
      <path d="M-28 40C-74 10 -104 -40 -96 -108C-56 -74 -28 -24 -10 26Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="4"/>
      <path d="M16 32C58 0 82 -46 74 -112C38 -76 20 -30 8 24Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="4"/>
      <path d="M-22 34C-62 0 -82 -42 -78 -92" fill="none" stroke="#ccfbf1" stroke-opacity="0.4" stroke-width="2.5"/>
      <path d="M12 30C44 2 62 -36 60 -84" fill="none" stroke="#ccfbf1" stroke-opacity="0.35" stroke-width="2"/>
      <path d="M-26 210L-2 252L22 208Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="4"/>
      <path d="M-4 202L-2 252" stroke="#fff7d6" stroke-opacity="0.5" stroke-width="2"/>
    </g>
    ${sparkle(-132, -112, 12, '#ccfbf1', 0.85)}
    ${sparkle(118, -132, 9, '#2dd4bf', 0.75)}
    ${sparkle(144, 104, 7, '#ffffff', 0.5)}
  </g>`;
}

function quizApprentice() {
  return `<g>
    <circle cx="0" cy="0" r="214" fill="none" stroke="#60a5fa" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="2 14"/>
    <g opacity="0.5" stroke="#93c5fd" stroke-width="2.4" stroke-linecap="round">
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (-90 + i * 30) * (Math.PI / 180);
        return `<path d="M${(Math.cos(a) * 222).toFixed(1)} ${(Math.sin(a) * 222).toFixed(1)}L${(Math.cos(a) * 238).toFixed(1)} ${(Math.sin(a) * 238).toFixed(1)}" stroke-opacity="${i % 3 === 0 ? 0.9 : 0.35}"/>`;
      }).join('')}
    </g>
    <g>
      <circle cx="0" cy="0" r="170" fill="#071226" stroke="url(#blueMetal)" stroke-width="12"/>
      <circle cx="0" cy="0" r="170" fill="none" stroke="#dbeafe" stroke-opacity="0.22" stroke-width="2"/>
      <circle cx="0" cy="0" r="146" fill="#0b1b36" stroke="#1e3a8a" stroke-width="3"/>
      <circle cx="0" cy="0" r="118" fill="#dbeafe" stroke="#06122e" stroke-width="3"/>
      <circle cx="0" cy="0" r="88" fill="#1d4ed8" stroke="#06122e" stroke-width="3"/>
      <circle cx="0" cy="0" r="58" fill="#dbeafe" stroke="#06122e" stroke-width="3"/>
      <circle cx="0" cy="0" r="30" fill="#1d4ed8" stroke="#06122e" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="14" fill="url(#gold)" stroke="#3b1a03" stroke-width="3"/>
      <path d="M-146 0H146M0 -146V146" stroke="#06122e" stroke-opacity="0.16" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="132" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.5"/>
    </g>
    <g>
      <ellipse cx="152" cy="152" rx="46" ry="9" fill="#02040a" opacity="0.45" filter="url(#blur8)"/>
      <path d="M-8 -8L150 150" stroke="url(#steel)" stroke-width="11" stroke-linecap="round"/>
      <path d="M-8 -8L150 150" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M118 118L162 106L174 118L162 174L118 162Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="3"/>
      <path d="M118 118L162 106L146 146Z" fill="#ccfbf1" opacity="0.6"/>
      <path d="M118 118L106 162L146 146Z" fill="url(#gold)" opacity="0.9"/>
      <path d="M-8 -8L12 -2L-2 12Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="2"/>
    </g>
    <g transform="translate(-118 -128)">
      ${star(0, 0, 20, 6, 4, -90, 'fill="#bfdbfe" opacity="0.9"')}
    </g>
    <g opacity="0.8">
      ${sparkle(-96, 126, 10, '#dbeafe', 0.8)}
      ${sparkle(122, -116, 8, '#60a5fa', 0.7)}
    </g>
    <circle cx="0" cy="0" r="4" fill="#ffffff"/>
  </g>`;
}

function quizMaster() {
  return `<g>
    <g opacity="0.55">
      <circle cx="0" cy="0" r="218" fill="none" stroke="#67e8f9" stroke-width="2" stroke-dasharray="2 14"/>
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45) * (Math.PI / 180);
        return `<circle cx="${(Math.cos(a) * 214).toFixed(1)}" cy="${(Math.sin(a) * 214).toFixed(1)}" r="4" fill="#a5f3fc"/>`;
      }).join('')}
    </g>
    <g opacity="0.32" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round">
      ${Array.from({ length: 16 }, (_, i) => {
        const a = (-90 + i * 22.5) * (Math.PI / 180);
        const r2 = i % 2 === 0 ? 226 : 212;
        return `<path d="M${(Math.cos(a) * 196).toFixed(1)} ${(Math.sin(a) * 196).toFixed(1)}L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2).toFixed(1)}"/>`;
      }).join('')}
    </g>
    <ellipse cx="0" cy="168" rx="128" ry="22" fill="#020d12" opacity="0.55" filter="url(#blur8)"/>
    <g>
      <path d="M-132 -142C-132 -48 -96 20 -34 44H34C96 20 132 -48 132 -142Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="7" stroke-linejoin="round"/>
      <path d="M-116 -128C-114 -52 -84 6 -30 30" fill="none" stroke="#fff9dc" stroke-opacity="0.45" stroke-width="3"/>
      <ellipse cx="0" cy="-142" rx="132" ry="27" fill="url(#gold)" stroke="#3b1a03" stroke-width="6"/>
      <ellipse cx="0" cy="-142" rx="110" ry="18" fill="#1c0a02" stroke="#fde68a" stroke-opacity="0.35" stroke-width="2"/>
      <path d="M-132 -118C-188 -112 -194 -34 -144 -4" fill="none" stroke="url(#gold)" stroke-width="15" stroke-linecap="round"/>
      <path d="M132 -118C188 -112 194 -34 144 -4" fill="none" stroke="url(#gold)" stroke-width="15" stroke-linecap="round"/>
      <path d="M-132 -118C-174 -112 -180 -46 -142 -14" fill="none" stroke="#fff7d6" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
      <path d="M132 -118C174 -112 180 -46 142 -14" fill="none" stroke="#fff7d6" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
      <g>
        <path d="M0 -150L42 -96L0 -34L-42 -96Z" fill="url(#cyanCrystal)" stroke="#e0ffff" stroke-opacity="0.55" stroke-width="3"/>
        <path d="M0 -150L0 -34L-42 -96Z" fill="#ecfeff" opacity="0.4"/>
        <path d="M0 -150L42 -96L0 -96Z" fill="#ffffff" opacity="0.5"/>
        <path d="M0 -34L42 -96L0 -96Z" fill="#0891b2" opacity="0.6"/>
        <path d="M-42 -96L0 -34L0 -96Z" fill="#155e75" opacity="0.55"/>
        <path d="M0 -150L0 -34M-42 -96H42" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.5"/>
      </g>
      <path d="M-26 44H26V92H-26Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="5"/>
      <ellipse cx="0" cy="50" rx="36" ry="10" fill="#fff7d6" opacity="0.35"/>
      <rect x="-104" y="92" width="208" height="34" rx="10" fill="url(#gold)" stroke="#3b1a03" stroke-width="5"/>
      <rect x="-124" y="124" width="248" height="36" rx="12" fill="#0a1520" stroke="url(#gold)" stroke-width="6"/>
      <rect x="-108" y="134" width="216" height="16" rx="7" fill="#67e8f9" opacity="0.22"/>
      <path d="M-84 142H84" stroke="#a5f3fc" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g transform="translate(-176 -74)">
      ${star(0, 0, 22, 6, 4, -90, 'fill="url(#cyanCrystal)" opacity="0.9"')}
    </g>
    <g transform="translate(178 -64)">
      ${star(0, 0, 16, 5, 4, -90, 'fill="url(#gold)" opacity="0.9"')}
    </g>
    ${sparkle(-176, 96, 13, '#ecfeff', 0.9)}
    ${sparkle(172, 104, 10, '#67e8f9', 0.75)}
    ${sparkle(156, -142, 7, '#a5f3fc', 0.6)}
  </g>`;
}

function interviewReady() {
  return `<g>
    <defs>
      <clipPath id="micGrille"><rect x="-54" y="-164" width="108" height="182" rx="54"/></clipPath>
    </defs>
    <g opacity="0.5" fill="none" stroke="#fb923c" stroke-width="3" stroke-linecap="round">
      <path d="M-232 -66C-252 -22 -252 22 -232 66"/>
      <path d="M-206 -40C-218 -12 -218 12 -206 40"/>
      <path d="M232 -66C252 -22 252 22 232 66"/>
      <path d="M206 -40C218 -12 218 12 206 40"/>
    </g>
    <ellipse cx="0" cy="176" rx="118" ry="22" fill="#02040a" opacity="0.6" filter="url(#blur8)"/>
    <g>
      <circle cx="0" cy="-8" r="150" fill="none" stroke="url(#steel)" stroke-width="9" opacity="0.9"/>
      <circle cx="0" cy="-8" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>
      ${[45, 135, 225, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = Math.cos(rad) * 150;
        const y = -8 + Math.sin(rad) * 150;
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
          <circle r="13" fill="url(#steel)" stroke="#0d1523" stroke-width="3"/>
          <circle cx="-3" cy="-3" r="4" fill="#ffffff" opacity="0.5"/>
        </g>`;
      }).join('')}
      <path d="M-104 -120L-70 -98M104 -120L70 -98M-104 104L-70 82M104 104L70 82" stroke="url(#steel)" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
      <rect x="-70" y="-178" width="140" height="216" rx="70" fill="url(#copper)" stroke="#2b0d02" stroke-width="7"/>
      <rect x="-54" y="-164" width="108" height="182" rx="54" fill="#1c0a03" stroke="#ffb477" stroke-opacity="0.4" stroke-width="2.5"/>
      <g clip-path="url(#micGrille)" stroke="#ffb477" stroke-opacity="0.33" stroke-width="1.6">
        ${Array.from({ length: 13 }, (_, i) => `<path d="M-60 ${-152 + i * 15}H60"/>`).join('')}
        ${Array.from({ length: 7 }, (_, i) => `<path d="M${-48 + i * 16} -168V22"/>`).join('')}
      </g>
      <path d="M-70 -112C-70 -154 -40 -178 0 -178C40 -178 70 -154 70 -112" fill="none" stroke="#ffe9d2" stroke-opacity="0.4" stroke-width="3"/>
      <rect x="-62" y="2" width="124" height="24" rx="12" fill="url(#gold)" stroke="#3b1a03" stroke-width="4"/>
      <rect x="-40" y="24" width="80" height="80" rx="30" fill="url(#steel)" stroke="#0d1523" stroke-width="5"/>
      <path d="M-28 34V94" stroke="#ffffff" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
      <path d="M0 104V150" stroke="url(#steel)" stroke-width="12" stroke-linecap="round"/>
      <path d="M0 104V150" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="0" cy="160" rx="96" ry="19" fill="url(#steel)" stroke="#0d1523" stroke-width="4"/>
      <ellipse cx="0" cy="154" rx="72" ry="10" fill="#0d1523" opacity="0.7"/>
      <g transform="translate(0 160)">
        <path d="M-54 0H-18L-9 7L0 0L9 7L18 0H54" fill="none" stroke="#ffb477" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
      </g>
    </g>
    <g transform="translate(150 -124)">
      ${star(0, 0, 20, 6, 4, -90, 'fill="url(#gold)" opacity="0.9"')}
    </g>
    ${sparkle(-196, -110, 10, '#ffedd5', 0.8)}
    ${sparkle(196, 58, 8, '#fb923c', 0.7)}
    ${sparkle(126, 132, 6, '#ffffff', 0.5)}
  </g>`;
}

function interviewPro() {
  return `<g>
    <path d="M-206 -110C-124 -186 124 -186 206 -110C236 -28 214 84 154 148L88 124L56 176L12 132C-100 158 -192 112 -216 28C-224 -22 -220 -72 -206 -110Z" fill="url(#blueMetal)" stroke="#05142e" stroke-width="8" stroke-linejoin="round" opacity="0.95"/>
    <path d="M-188 -96C-114 -158 114 -158 188 -96C214 -26 196 68 144 126L84 104L54 148L18 112C-82 134 -170 98 -194 26C-202 -16 -198 -62 -188 -96Z" fill="#07162b" stroke="#93c5fd" stroke-opacity="0.25" stroke-width="2"/>
    <g transform="translate(0 -8)">
      <rect x="-54" y="-128" width="108" height="190" rx="54" fill="url(#blueMetal)" stroke="#06122e" stroke-width="7"/>
      <rect x="-44" y="-118" width="88" height="168" rx="44" fill="#0a1b38" stroke="#dbeafe" stroke-opacity="0.3" stroke-width="2"/>
      <g stroke="#dbeafe" stroke-opacity="0.4" stroke-width="2.2">
        ${Array.from({ length: 8 }, (_, i) => `<path d="M-36 ${-100 + i * 18}H36"/>`).join('')}
      </g>
      <g stroke="#3b82f6" stroke-opacity="0.45" stroke-width="1.6">
        ${Array.from({ length: 3 }, (_, i) => `<path d="M${-24 + i * 24} -114V54"/>`).join('')}
      </g>
      <path d="M-80 -18V-62C-80 -98 -46 -126 -4 -126" fill="none" stroke="url(#steel)" stroke-width="8" stroke-linecap="round"/>
      <path d="M80 -18V-62C80 -98 46 -126 4 -126" fill="none" stroke="url(#steel)" stroke-width="8" stroke-linecap="round"/>
      <path d="M0 62V124" stroke="url(#steel)" stroke-width="11" stroke-linecap="round"/>
      <path d="M-68 138C-40 120 40 120 68 138" fill="none" stroke="url(#steel)" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="0" cy="144" rx="86" ry="19" fill="url(#steel)" stroke="#0d1523" stroke-width="4"/>
    </g>
    <g fill="none" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" opacity="0.8">
      <path d="M-160 -64V56M-184 -34V26"/>
      <path d="M160 -64V56M184 -34V26"/>
    </g>
    <g opacity="0.5" stroke="#93c5fd" stroke-width="2">
      <circle cx="0" cy="0" r="202" fill="none" stroke-dasharray="3 16"/>
      <circle cx="0" cy="0" r="184" fill="none" stroke-dasharray="1 10"/>
    </g>
    ${star(0, -186, 22, 6, 4, -90, 'fill="url(#ice)" opacity="0.9"')}
    ${sparkle(-156, -130, 10, '#dbeafe', 0.8)}
    ${sparkle(158, -124, 8, '#60a5fa', 0.7)}
    ${sparkle(146, 126, 6, '#ffffff', 0.5)}
  </g>`;
}

function interviewExpert() {
  return `<g>
    <g opacity="0.55" fill="none" stroke="#c084fc" stroke-width="2.6" stroke-linecap="round">
      <path d="M-212 -40C-188 -124 -118 -184 -32 -204"/>
      <path d="M212 -40C188 -124 118 -184 32 -204"/>
      <circle cx="0" cy="0" r="224" stroke-dasharray="2 14" stroke-width="2"/>
    </g>
    <g>
      <path d="M-78 -52C-144 -126 -206 -160 -238 -148C-214 -94 -166 -44 -96 -12Z" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="5"/>
      <path d="M78 -52C144 -126 206 -160 238 -148C214 -94 166 -44 96 -12Z" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="5"/>
      <path d="M-94 18C-166 -26 -220 -30 -246 -8C-210 40 -150 78 -76 90Z" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="5" opacity="0.9"/>
      <path d="M94 18C166 -26 220 -30 246 -8C210 40 150 78 76 90Z" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="5" opacity="0.9"/>
      <path d="M-204 -132C-166 -128 -128 -100 -100 -58M-196 -24C-158 -18 -120 6 -92 42" fill="none" stroke="#f3e8ff" stroke-opacity="0.38" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M204 -132C166 -128 128 -100 100 -58M196 -24C158 -18 120 6 92 42" fill="none" stroke="#f3e8ff" stroke-opacity="0.38" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <path d="M0 -166L22 -104L84 -84L132 -128L118 -50L162 0L96 30L74 104L24 54L-24 54L-74 104L-96 30L-162 0L-118 -50L-132 -128L-84 -84L-22 -104Z" fill="url(#violetCrystal)" stroke="#f3e8ff" stroke-opacity="0.35" stroke-width="3" opacity="0.35"/>
    <g transform="translate(0 8)">
      <rect x="-60" y="-136" width="120" height="194" rx="60" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="7"/>
      <rect x="-48" y="-124" width="96" height="170" rx="48" fill="#170a36" stroke="#f3e8ff" stroke-opacity="0.3" stroke-width="2"/>
      <g stroke="#e9d5ff" stroke-opacity="0.4" stroke-width="2.2">
        ${Array.from({ length: 9 }, (_, i) => `<path d="M-38 ${-106 + i * 17}H38"/>`).join('')}
      </g>
      <path d="M-88 -30V-74C-88 -112 -50 -142 -4 -142" fill="none" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>
      <path d="M88 -30V-74C88 -112 50 -142 4 -142" fill="none" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>
      <path d="M0 66V132" stroke="url(#gold)" stroke-width="11" stroke-linecap="round"/>
      <path d="M-76 146C-46 126 46 126 76 146" fill="none" stroke="url(#gold)" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="0" cy="152" rx="94" ry="20" fill="url(#gold)" stroke="#3b1a03" stroke-width="4"/>
    </g>
    ${star(0, -200, 44, 12, 5, -90, 'fill="url(#gold)" stroke="#3b1a03" stroke-width="4"')}
    <g transform="translate(0 194)">
      <path d="M-84 0C-52 20 -20 24 0 16C20 24 52 20 84 0" fill="none" stroke="#c084fc" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    </g>
    ${sparkle(-176, -114, 12, '#f3e8ff', 0.85)}
    ${sparkle(172, -120, 9, '#c084fc', 0.75)}
    ${sparkle(160, 112, 7, '#ffffff', 0.5)}
  </g>`;
}

function resumeBuilder() {
  return `<g>
    <g opacity="0.4">
      <circle cx="0" cy="0" r="210" fill="none" stroke="#fbbf24" stroke-width="2.4" stroke-dasharray="2 14"/>
      <path d="M-190 -78H-160M160 -78H190M-190 78H-160M160 78H190" stroke="#fef3c7" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <path d="M-158 -148C-90 -168 74 -168 150 -144C166 -80 166 62 150 144C76 168 -88 168 -158 148C-172 82 -172 -82 -158 -148Z" fill="url(#paper)" stroke="#7d6a45" stroke-width="6"/>
    <path d="M-158 -148C-90 -168 74 -168 150 -144C166 -80 166 62 150 144C76 168 -88 168 -158 148C-172 82 -172 -82 -158 -148Z" fill="none" stroke="#fffdf4" stroke-opacity="0.65" stroke-width="2"/>
    <path d="M-158 -148C-130 -184 -86 -184 -66 -158C-44 -130 -70 -104 -102 -112C-132 -120 -152 -130 -158 -148Z" fill="url(#steel)" stroke="#0d1523" stroke-width="4"/>
    <path d="M150 144C122 180 78 180 58 154C36 126 62 100 94 108C124 116 144 126 150 144Z" fill="url(#steel)" stroke="#0d1523" stroke-width="4"/>
    <g stroke="#9a825a" stroke-width="4" stroke-linecap="round" opacity="0.6">
      <path d="M-112 -92H92M-112 -62H72M-112 -32H100M-112 -2H50M-112 28H86M-112 58H64M-112 88H94"/>
    </g>
    <g opacity="0.85">
      <circle cx="86" cy="112" r="42" fill="url(#gold)" stroke="#3b1a03" stroke-width="4"/>
      <circle cx="86" cy="112" r="31" fill="none" stroke="#fff7d6" stroke-opacity="0.4" stroke-width="2"/>
      <path d="M86 84L94 106L118 108L100 122L106 146L86 132L66 146L72 122L54 108L78 106Z" fill="#7c3aed" stroke="#fef3c7" stroke-width="2"/>
    </g>
    <g transform="rotate(38 -74 8)">
      <path d="M-74 -188L-42 -116L-58 -104L-90 -176Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="4"/>
      <path d="M-58 -104L-44 -76L-78 -84Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="3"/>
      <path d="M-66 -150C-110 -168 -138 -206 -132 -238C-96 -218 -70 -184 -58 -148Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="4"/>
      <path d="M-58 -148C-24 -178 2 -212 4 -244C-28 -230 -52 -200 -64 -166Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="4"/>
      <path d="M-60 -144C-100 -158 -122 -188 -122 -218M-58 -144C-30 -166 -10 -194 -8 -222" fill="none" stroke="#ccfbf1" stroke-opacity="0.35" stroke-width="2.2"/>
    </g>
    <g transform="translate(-122 118)">
      <path d="M0 -20L12 0L0 20L-12 0Z" fill="url(#gold)" opacity="0.85"/>
    </g>
    ${sparkle(-158, -128, 11, '#fef3c7', 0.85)}
    ${sparkle(134, -142, 9, '#fbbf24', 0.7)}
    ${sparkle(154, 42, 6, '#ffffff', 0.5)}
  </g>`;
}

function roadmapExplorer() {
  return `<g>
    <g opacity="0.55">
      <path d="M-206 -96L-66 -156L62 -108L196 -160L176 116L54 166L-70 122L-206 172Z" fill="#042f2e" stroke="#2dd4bf" stroke-opacity="0.3" stroke-width="3"/>
      <path d="M-206 -96L-66 -156L62 -108L196 -160L176 116L54 166L-70 122L-206 172Z" fill="none" stroke="#99f6e4" stroke-opacity="0.22" stroke-width="2"/>
      <path d="M-66 -156L-70 122M62 -108L54 166" stroke="#99f6e4" stroke-opacity="0.18" stroke-width="2"/>
      <path d="M-176 76C-120 34 -84 52 -34 10C16 -32 46 -8 86 -46C116 -74 140 -58 166 -90" fill="none" stroke="#2dd4bf" stroke-width="4" stroke-dasharray="6 12" stroke-linecap="round"/>
      <g fill="#99f6e4">
        <circle cx="-138" cy="54" r="7"/><circle cx="-32" cy="8" r="7"/><circle cx="84" cy="-48" r="7"/><circle cx="158" cy="-92" r="7"/>
      </g>
    </g>
    <circle cx="0" cy="0" r="170" fill="#041c1d" stroke="url(#tealMetal)" stroke-width="13"/>
    <circle cx="0" cy="0" r="170" fill="none" stroke="#ccfbf1" stroke-opacity="0.25" stroke-width="2"/>
    <circle cx="0" cy="0" r="150" fill="none" stroke="#2dd4bf" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="2 12"/>
    <g opacity="0.7" stroke="#99f6e4" stroke-width="2">
      ${Array.from({ length: 24 }, (_, i) => {
        const a = (i * 15) * (Math.PI / 180);
        return `<path d="M${(Math.cos(a) * 152).toFixed(1)} ${(Math.sin(a) * 152).toFixed(1)}L${(Math.cos(a) * 162).toFixed(1)} ${(Math.sin(a) * 162).toFixed(1)}"/>`;
      }).join('')}
    </g>
    <g transform="rotate(34)">
      <path d="M0 -148L30 -30L148 0L30 30L0 148L-30 30L-148 0L-30 -30Z" fill="url(#tealMetal)" stroke="#042f2e" stroke-width="6" stroke-linejoin="round"/>
      <path d="M0 -148L30 -30L0 0L-30 -30Z" fill="#ccfbf1" opacity="0.55"/>
      <path d="M148 0L30 30L0 0L30 -30Z" fill="#2dd4bf" opacity="0.75"/>
      <path d="M0 148L-30 30L0 0L30 30Z" fill="#0f766e" opacity="0.8"/>
      <path d="M-148 0L-30 -30L0 0L-30 30Z" fill="#5eead4" opacity="0.45"/>
      <path d="M0 -148L0 0M148 0L0 0M0 148L0 0M-148 0L0 0" stroke="#f0fdfa" stroke-opacity="0.4" stroke-width="2"/>
      <path d="M0 -104L18 -18L0 0L-18 -18Z" fill="#ffffff" opacity="0.85"/>
      <path d="M0 104L-18 18L0 0L18 18Z" fill="#115e59" opacity="0.9"/>
    </g>
    <circle cx="0" cy="0" r="26" fill="url(#gold)" stroke="#3b1a03" stroke-width="3"/>
    <circle cx="0" cy="0" r="10" fill="#042f2e"/>
    <g transform="translate(118 -112)">
      <path d="M0 -22L16 0L0 22L-16 0Z" fill="#99f6e4" opacity="0.9"/>
    </g>
    ${sparkle(-152, -140, 10, '#ccfbf1', 0.8)}
    ${sparkle(156, 132, 8, '#2dd4bf', 0.65)}
  </g>`;
}

function careerStrategist() {
  return `<g>
    <g opacity="0.5" fill="none" stroke="#a78bfa" stroke-width="2.4" stroke-linecap="round">
      <circle cx="0" cy="0" r="226" stroke-dasharray="2 14"/>
      <ellipse cx="0" cy="0" rx="236" ry="112" transform="rotate(-26)" stroke="#c4b5fd" stroke-opacity="0.35"/>
      <ellipse cx="0" cy="0" rx="210" ry="90" transform="rotate(36)" stroke="#fbbf24" stroke-opacity="0.22"/>
    </g>
    <g transform="translate(0 -198)">
      ${star(0, 0, 52, 13, 4, -90, 'fill="url(#gold)" stroke="#3b1a03" stroke-width="3"')}
    </g>
    <circle cx="0" cy="0" r="178" fill="#100525" stroke="url(#violetMetal)" stroke-width="13"/>
    <circle cx="0" cy="0" r="178" fill="none" stroke="#e9d5ff" stroke-opacity="0.28" stroke-width="2"/>
    <circle cx="0" cy="0" r="152" fill="none" stroke="#c4b5fd" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="2 12"/>
    <g opacity="0.75" stroke="#e9d5ff" stroke-width="2">
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30) * (Math.PI / 180);
        return `<path d="M${(Math.cos(a) * 154).toFixed(1)} ${(Math.sin(a) * 154).toFixed(1)}L${(Math.cos(a) * 166).toFixed(1)} ${(Math.sin(a) * 166).toFixed(1)}" stroke-opacity="${i % 3 === 0 ? 0.9 : 0.4}"/>`;
      }).join('')}
    </g>
    <g transform="rotate(18)">
      <path d="M0 -152L42 -34L152 0L42 34L0 152L-42 34L-152 0L-42 -34Z" fill="url(#violetMetal)" stroke="#1e0838" stroke-width="6" stroke-linejoin="round"/>
      <path d="M0 -152L42 -34L0 0L-42 -34Z" fill="#f3e8ff" opacity="0.55"/>
      <path d="M152 0L42 34L0 0L42 -34Z" fill="#c084fc" opacity="0.7"/>
      <path d="M0 152L-42 34L0 0L42 34Z" fill="#581c87" opacity="0.85"/>
      <path d="M-152 0L-42 -34L0 0L-42 34Z" fill="#a855f7" opacity="0.5"/>
      <path d="M0 -152L0 0M152 0L0 0M0 152L0 0M-152 0L0 0" stroke="#f8f5ff" stroke-opacity="0.38" stroke-width="2"/>
      <path d="M0 -116L24 -20L0 0L-24 -20Z" fill="url(#gold)" stroke="#3b1a03" stroke-width="2"/>
      <path d="M0 116L-24 20L0 0L24 20Z" fill="#2e1065" opacity="0.9"/>
    </g>
    <circle cx="0" cy="0" r="30" fill="url(#gold)" stroke="#3b1a03" stroke-width="4"/>
    <circle cx="0" cy="0" r="13" fill="#2e1065" stroke="#fde68a" stroke-width="2"/>
    <g opacity="0.85">
      <path d="M-170 104C-134 144 -70 170 0 174C70 170 134 144 170 104" fill="none" stroke="url(#gold)" stroke-width="6" stroke-linecap="round"/>
      <path d="M-144 120C-110 150 -60 164 0 168C60 164 110 150 144 120" fill="none" stroke="#fde68a" stroke-opacity="0.28" stroke-width="2"/>
    </g>
    <path d="M-206 18C-188 -10 -176 -36 -172 -68M206 18C188 -10 176 -36 172 -68" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
    ${sparkle(-158, -142, 12, '#f5f3ff', 0.85)}
    ${sparkle(160, -130, 9, '#fbbf24', 0.75)}
    ${sparkle(152, 138, 7, '#ffffff', 0.5)}
  </g>`;
}

// ── Emit ─────────────────────────────────────────────────────

for (const badge of BADGES) {
  const svg = frame(badge, badge.emblem());
  writeFileSync(join(outDir, `${badge.id.replaceAll('_', '-')}.svg`), svg, 'utf8');
}

mkdirSync(join(here, '..', '..', 'docs', 'badges'), { recursive: true });
writeFileSync(
  join(here, '..', '..', 'docs', 'badges', '.generated.json'),
  JSON.stringify({ generated: BADGES.map((b) => b.id), count: BADGES.length }, null, 2),
  'utf8',
);

console.log(`Generated ${BADGES.length} badge illustrations in ${outDir}`);
