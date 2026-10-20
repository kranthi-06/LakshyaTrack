import { describe, expect, it } from 'vitest';
import type { PersonalInfo } from './types';
import {
    buildContactItems,
    displayUrl,
    normalizeEmailHref,
    normalizePhoneHref,
    normalizeProfileUrl,
} from './templates/contactLinkUtils';

const personal = (overrides: Partial<PersonalInfo> = {}): PersonalInfo => ({
    full_name: 'Asha Rao',
    email: '',
    phone: '',
    location: '',
    professional_summary: '',
    ...overrides,
});

describe('normalizeProfileUrl', () => {
    it('accepts https URLs and adds a scheme when omitted', () => {
        expect(normalizeProfileUrl('https://linkedin.com/in/asha')).toBe('https://linkedin.com/in/asha');
        expect(normalizeProfileUrl('linkedin.com/in/asha')).toBe('https://linkedin.com/in/asha');
        expect(normalizeProfileUrl('github.com/asha')).toBe('https://github.com/asha');
    });

    it('normalizes casing and preserves http when explicitly requested', () => {
        expect(normalizeProfileUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
        expect(normalizeProfileUrl('http://example.com')).toBe('http://example.com/');
    });

    it('rejects scriptable and non-http schemes', () => {
        expect(normalizeProfileUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeProfileUrl('JaVaScRiPt:alert(1)')).toBeNull();
        expect(normalizeProfileUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(normalizeProfileUrl('vbscript:msgbox(1)')).toBeNull();
        expect(normalizeProfileUrl('file:///etc/passwd')).toBeNull();
    });

    it('rejects scheme smuggling and hosts without a domain', () => {
        expect(normalizeProfileUrl('https://javascript:alert(1)')).toBeNull();
        expect(normalizeProfileUrl('localhost')).toBeNull();
        expect(normalizeProfileUrl('intranet')).toBeNull();
    });

    it('rejects empty and malformed input', () => {
        expect(normalizeProfileUrl('')).toBeNull();
        expect(normalizeProfileUrl(undefined)).toBeNull();
        expect(normalizeProfileUrl('   ')).toBeNull();
        expect(normalizeProfileUrl('not a url at all')).toBeNull();
    });
});

describe('normalizeEmailHref', () => {
    it('builds a mailto href for valid addresses', () => {
        expect(normalizeEmailHref('asha@example.com')).toBe('mailto:asha@example.com');
    });

    it('rejects malformed addresses', () => {
        expect(normalizeEmailHref('asha')).toBeNull();
        expect(normalizeEmailHref('asha@')).toBeNull();
        expect(normalizeEmailHref('@example.com')).toBeNull();
        expect(normalizeEmailHref('')).toBeNull();
    });
});

describe('normalizePhoneHref', () => {
    it('keeps dialable characters only', () => {
        expect(normalizePhoneHref('+91 98765 43210')).toBe('tel:+919876543210');
        expect(normalizePhoneHref('(555) 123-4567')).toBe('tel:5551234567');
    });

    it('rejects values that are not phone numbers', () => {
        expect(normalizePhoneHref('123')).toBeNull();
        expect(normalizePhoneHref('n/a')).toBeNull();
        expect(normalizePhoneHref('')).toBeNull();
    });
});

describe('displayUrl', () => {
    it('strips scheme, www and trailing slash for compact display', () => {
        expect(displayUrl('https://www.linkedin.com/in/asha/')).toBe('linkedin.com/in/asha');
        expect(displayUrl('github.com/asha')).toBe('github.com/asha');
    });
});

describe('buildContactItems', () => {
    it('omits empty fields so no stray separators or icons render', () => {
        expect(buildContactItems(personal())).toEqual([]);
        expect(buildContactItems(personal({ email: 'a@b.com' }))).toHaveLength(1);
    });

    it('orders items consistently and tags each kind', () => {
        const items = buildContactItems(
            personal({
                email: 'asha@example.com',
                phone: '+91 98765 43210',
                location: 'Bengaluru, IN',
                linkedin_url: 'linkedin.com/in/asha',
                github_url: 'github.com/asha',
            }),
        );
        expect(items.map((i) => i.kind)).toEqual(['email', 'phone', 'location', 'linkedin', 'github']);
    });

    it('marks location as plain text and links everything else', () => {
        const items = buildContactItems(
            personal({ location: 'Bengaluru', email: 'asha@example.com' }),
        );
        expect(items.find((i) => i.kind === 'location')?.href).toBeNull();
        expect(items.find((i) => i.kind === 'email')?.href).toBe('mailto:asha@example.com');
    });

    it('drops invalid URLs entirely rather than rendering a broken link', () => {
        const items = buildContactItems(
            personal({ linkedin_url: 'javascript:alert(1)', github_url: 'github.com/asha' }),
        );
        expect(items.map((i) => i.kind)).toEqual(['github']);
    });

    it('survives legacy resumes saved before the link fields existed', () => {
        const legacy = { full_name: 'A', email: 'a@b.com', phone: '', location: '', professional_summary: '' };
        const items = buildContactItems(legacy as PersonalInfo);
        expect(items.map((i) => i.kind)).toEqual(['email']);
    });

    it('tolerates a missing personal object', () => {
        expect(buildContactItems(undefined)).toEqual([]);
    });
});
