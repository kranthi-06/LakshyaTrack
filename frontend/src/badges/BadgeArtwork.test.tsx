import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BadgeArtwork from './BadgeArtwork';

function render(props: React.ComponentProps<typeof BadgeArtwork>): string {
  return renderToStaticMarkup(<BadgeArtwork {...props} />);
}

describe('BadgeArtwork', () => {
  it('renders the registered square artwork with a descriptive alt', () => {
    const html = render({ badgeId: 'first_flame', name: 'First Flame', rarity: 'common', size: 96 });

    expect(html).toContain('data-badge-art="registered"');
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="1024"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="First Flame common achievement badge"');
    expect(html).toContain('width:96px');
    expect(html).toContain('height:96px');
  });

  it('keeps locked artwork recognizable and describes existing progress', () => {
    const html = render({
      badgeId: 'quiz_master',
      name: 'Quiz Master',
      rarity: 'rare',
      isUnlocked: false,
      progress: 67,
    });

    expect(html).toContain('alt="Quiz Master rare achievement badge, locked, 67% complete"');
    expect(html).toContain('grayscale(0.86)');
    expect(html).toContain('title="Locked — 67% complete"');
  });

  it('hides decorative artwork from assistive tech but keeps lock state audible', () => {
    const html = render({
      badgeId: 'first_interview',
      name: 'Interview Ready',
      isUnlocked: false,
      progress: 40,
      decorative: true,
    });

    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('Locked, 40% complete');
  });

  it('falls back to a rarity-tinted monogram when art is not registered', () => {
    const html = render({ badgeId: 'mystery_badge', name: 'Mystery Badge', rarity: 'epic' });

    expect(html).toContain('data-badge-art="fallback"');
    expect(html).not.toContain('<img');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Mystery Badge badge artwork unavailable"');
    expect(html).toContain('MB');
    expect(html).toContain('radial-gradient');
  });

  it('loads priority art eagerly for a single hero badge', () => {
    const html = render({ badgeId: 'century_legend', priority: true });

    expect(html).toContain('loading="eager"');
    expect(html).toMatch(/fetch[Pp]riority="high"/);
  });
});
