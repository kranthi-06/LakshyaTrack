import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProfileHeader, type ProfileFormState } from './ProfileHeader';

const profile: ProfileFormState = {
    role: 'Software Engineer',
    location: 'Hyderabad',
    joined: 'January 2026',
    phone: '',
    bio: 'Building reliable student tools.',
    skills: ['React', 'Python'],
    socials: {
        linkedin: 'linkedin.com/in/kasa',
        github: '',
        portfolio: '',
    },
    image: null,
};

const noop = vi.fn();

describe('ProfileHeader', () => {
    it('renders real profile data and normalizes social links', () => {
        const html = renderToStaticMarkup(
            <ProfileHeader
                displayName="Kasa Kranthi Kiran"
                displayEmail="kasa@example.com"
                displayInitial="K"
                profile={profile}
                editName="Kasa Kranthi Kiran"
                isEditing={false}
                isSaving={false}
                stats={{ resumes: 2, badges: 5, streak: 4, skills: 2 }}
                onStartEdit={noop}
                onCancel={noop}
                onSave={noop}
                onEditName={noop}
                onProfileChange={noop}
                onImageUpload={noop}
            />,
        );

        expect(html).toContain('Kasa Kranthi Kiran');
        expect(html).toContain('kasa@example.com');
        expect(html).toContain('Software Engineer');
        expect(html).toContain('href="https://linkedin.com/in/kasa"');
        expect(html).toContain('Building reliable student tools.');
        expect(html).not.toContain('No biography yet');
    });

    it('shows an unavailable marker instead of inventing statistics', () => {
        const html = renderToStaticMarkup(
            <ProfileHeader
                displayName="Kasa Kranthi Kiran"
                displayEmail="kasa@example.com"
                displayInitial="K"
                profile={profile}
                editName="Kasa Kranthi Kiran"
                isEditing={false}
                isSaving={false}
                stats={{ resumes: null, badges: null, streak: 4, skills: 2 }}
                onStartEdit={noop}
                onCancel={noop}
                onSave={noop}
                onEditName={noop}
                onProfileChange={noop}
                onImageUpload={noop}
            />,
        );

        expect(html.match(/—/g)).toHaveLength(2);
        expect(html).toContain('Saved resumes unavailable');
        expect(html).toContain('Badges unlocked unavailable');
    });
});
