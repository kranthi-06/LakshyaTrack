import { useState, type CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import type { BadgeRarity } from '../progress-system/types';
import {
  getBadgeArt,
  getBadgeArtUrl,
  getBadgeInitials,
  getBadgeRarityTheme,
} from './badgeRegistry';

export interface BadgeArtworkProps {
  /** Backend badge ID, for example `first_flame`. */
  badgeId: string;
  /** Display name; falls back to the registry name, then "Achievement". */
  name?: string;
  rarity?: BadgeRarity;
  isUnlocked?: boolean;
  /** Rendered square size in CSS pixels. */
  size?: number;
  /** Extra classes for the fixed-size wrapper (margins, shadows, etc.). */
  className?: string;
  /** Load immediately instead of lazily. Use for a single hero badge only. */
  priority?: boolean;
  /** Set when adjacent text already names the badge. */
  decorative?: boolean;
  /** Hide the built-in lock chip if a surface provides its own. */
  showLock?: boolean;
  /** Existing progress value (0-100); only used for the lock description. */
  progress?: number | null;
  style?: CSSProperties;
}

const HEX_CLIP = 'polygon(50% 2%, 94% 26%, 94% 74%, 50% 98%, 6% 74%, 6% 26%)';

/**
 * Renders the registered collectible artwork for a badge at a fixed size.
 *
 * - Shared across every badge surface so the same art appears everywhere.
 * - Lazy-loaded by default to keep large galleries cheap.
 * - Locked badges keep their recognizable silhouette, desaturated and muted,
 *   with a lock chip.
 * - Unknown or unbuilt badges fall back to a rarity-tinted hex monogram
 *   instead of a broken image.
 */
export function BadgeArtwork({
  badgeId,
  name,
  rarity,
  isUnlocked = true,
  size = 96,
  className = '',
  priority = false,
  decorative = false,
  showLock = true,
  progress = null,
  style,
}: BadgeArtworkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const definition = getBadgeArt(badgeId);
  const resolvedName = name ?? definition?.name ?? 'Achievement';
  const resolvedRarity = rarity ?? definition?.rarity ?? 'common';
  const theme = getBadgeRarityTheme(resolvedRarity);
  const artUrl = getBadgeArtUrl(badgeId);
  const artFailed = Boolean(artUrl) && failedUrl === artUrl;
  const showArtwork = Boolean(artUrl) && !artFailed;
  const progressLabel = typeof progress === 'number' ? `, ${Math.round(progress)}% complete` : '';
  const alt = decorative
    ? ''
    : `${resolvedName} ${resolvedRarity} achievement badge${isUnlocked ? '' : `, locked${progressLabel}`}`;

  const lockSize = Math.max(18, Math.round(size * 0.27));
  const lockIconSize = Math.max(9, Math.round(size * 0.14));

  return (
    <span
      className={`relative inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size, ...style }}
      data-badge-id={badgeId}
      data-badge-art={showArtwork ? 'registered' : artFailed ? 'error-fallback' : 'fallback'}
    >
      {showArtwork && artUrl ? (
        <img
          src={artUrl}
          alt={alt}
          aria-hidden={decorative || undefined}
          width={1024}
          height={1024}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          draggable={false}
          onError={() => setFailedUrl(artUrl)}
          className="h-full w-full object-contain transition-[filter,opacity] duration-300"
          style={{
            filter: isUnlocked
              ? undefined
              : 'grayscale(0.86) saturate(0.34) brightness(0.74)',
          }}
        />
      ) : (
        <span
          aria-hidden={decorative || undefined}
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : `${resolvedName} badge artwork unavailable`}
          className="absolute flex items-center justify-center"
          style={{
            inset: '8%',
            clipPath: HEX_CLIP,
            background: `radial-gradient(circle at 32% 22%, ${theme.color}66, #0b1220 62%, #05070f 100%)`,
            boxShadow: `inset 0 0 0 2px ${theme.color}66, inset 0 10px 24px rgba(255,255,255,0.07)`,
            filter: `${isUnlocked ? '' : 'grayscale(0.8) saturate(0.4) brightness(0.8) '}drop-shadow(0 8px 12px rgba(2,6,23,0.45))`,
          }}
        >
          <span
            className="font-black tracking-tight text-white/90"
            style={{ fontSize: Math.max(12, Math.round(size * 0.26)) }}
          >
            {getBadgeInitials(resolvedName)}
          </span>
        </span>
      )}

      {!isUnlocked && showLock && (
        <>
          {decorative && (
            <span className="sr-only">
              Locked{progressLabel}
            </span>
          )}
          <span
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border border-white/15 bg-slate-950/80 text-white shadow-lg backdrop-blur-sm dark:border-white/20 dark:bg-slate-950/85"
            style={{ width: lockSize, height: lockSize }}
            aria-hidden="true"
            title={progress === null ? 'Locked' : `Locked — ${Math.round(progress)}% complete`}
          >
            <Lock style={{ width: lockIconSize, height: lockIconSize }} strokeWidth={2.6} />
          </span>
        </>
      )}
    </span>
  );
}

export default BadgeArtwork;
