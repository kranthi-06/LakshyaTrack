import type { PersonalInfo } from '../types';

/**
 * Contact-link normalization shared by every resume template.
 *
 * Resume content is user-controlled JSON that is persisted and re-rendered, so
 * href values are validated against a scheme allowlist rather than passed
 * through.  A `javascript:` or `data:` URL stored in resume_data would
 * otherwise execute in the preview and in the exported document.
 */

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:']);

export type ContactKind = 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'portfolio' | 'website' | 'leetcode' | 'hackerrank' | 'kaggle';

export interface ContactItem {
    kind: ContactKind;
    /** Resolved href, or null when the item is plain text (location) or invalid. */
    href: string | null;
    /** Text shown on the resume. */
    label: string;
    /** Accessible name; falls back to the visible label. */
    ariaLabel: string;
    /** Short prefix used by templates that render icons. */
    icon: string;
    /** Compact platform name for icon-only display (e.g., "LinkedIn", "GitHub"). Only for profile links. */
    platformName?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Normalize a profile URL to a safe absolute http(s) href.
 * Returns null when the value is empty or cannot be made safe, so callers omit
 * the item instead of rendering a broken or scriptable link.
 */
export function normalizeProfileUrl(raw: string | undefined): string | null {
    const value = (raw || '').trim();
    if (!value) return null;

    const candidate = SCHEME_PATTERN.test(value) ? value : `https://${value}`;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) return null;
    // Require a real domain: rejects bare hosts and scheme-smuggling attempts.
    if (!parsed.hostname.includes('.')) return null;

    return parsed.toString();
}

/** Strip the scheme and trailing slash for compact on-resume display. */
export function displayUrl(raw: string | undefined): string {
    const value = (raw || '').trim();
    if (!value) return '';
    return value
        .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '');
}

export function normalizeEmailHref(raw: string | undefined): string | null {
    const value = (raw || '').trim();
    if (!value || !EMAIL_PATTERN.test(value)) return null;
    return `mailto:${value}`;
}

export function normalizePhoneHref(raw: string | undefined): string | null {
    const value = (raw || '').trim();
    if (!value) return null;
    const dialable = value.replace(/[^\d+]/g, '');
    if (dialable.replace(/\D/g, '').length < 7) return null;
    return `tel:${dialable}`;
}

/**
 * Build the ordered contact items for a resume header.
 * Empty and invalid entries are omitted entirely so templates never render
 * stray separators, icons, or "undefined".
 */
export function buildContactItems(personal: PersonalInfo | undefined): ContactItem[] {
    const p = personal || ({} as PersonalInfo);
    const items: ContactItem[] = [];

    const emailHref = normalizeEmailHref(p.email);
    if (p.email?.trim()) {
        items.push({
            kind: 'email',
            href: emailHref,
            label: p.email.trim(),
            ariaLabel: `Email ${p.email.trim()}`,
            icon: '✉',
        });
    }

    const phoneHref = normalizePhoneHref(p.phone);
    if (p.phone?.trim()) {
        items.push({
            kind: 'phone',
            href: phoneHref,
            label: p.phone.trim(),
            ariaLabel: `Phone ${p.phone.trim()}`,
            icon: '📱',
        });
    }

    if (p.location?.trim()) {
        items.push({
            kind: 'location',
            href: null,
            label: p.location.trim(),
            ariaLabel: `Location ${p.location.trim()}`,
            icon: '📍',
        });
    }

    const profiles: Array<{ kind: ContactKind; value: string | undefined; ariaLabel: string; icon: string; platformName: string }> = [
        { kind: 'linkedin', value: p.linkedin_url, ariaLabel: 'LinkedIn profile', icon: '🔗', platformName: 'LinkedIn' },
        { kind: 'github', value: p.github_url, ariaLabel: 'GitHub profile', icon: '💻', platformName: 'GitHub' },
        { kind: 'portfolio', value: p.portfolio_url, ariaLabel: 'Portfolio', icon: '🌐', platformName: 'Portfolio' },
        { kind: 'website', value: p.website_url, ariaLabel: 'Website', icon: '🌐', platformName: 'Website' },
        { kind: 'leetcode', value: p.leetcode_url, ariaLabel: 'LeetCode profile', icon: '🧠', platformName: 'LeetCode' },
        { kind: 'hackerrank', value: p.hackerrank_url, ariaLabel: 'HackerRank profile', icon: '🏆', platformName: 'HackerRank' },
        { kind: 'kaggle', value: p.kaggle_url, ariaLabel: 'Kaggle profile', icon: '📊', platformName: 'Kaggle' },
    ];

    for (const profile of profiles) {
        const href = normalizeProfileUrl(profile.value);
        if (!href) continue;
        items.push({
            kind: profile.kind,
            href,
            label: displayUrl(profile.value),
            ariaLabel: `${profile.ariaLabel} ${displayUrl(profile.value)}`,
            icon: profile.icon,
            platformName: profile.platformName,
        });
    }

    return items;
}
