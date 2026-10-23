import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProfileTabBar } from './ProfileTabBar';

describe('ProfileTabBar', () => {
    it('renders all six tabs with a single selected tab and a roving tabindex', () => {
        const html = renderToStaticMarkup(
            <ProfileTabBar active="resumes" resumeCount={3} onChange={vi.fn()} />,
        );

        expect(html.match(/role="tab"/g)).toHaveLength(6);
        expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
        expect(html).toContain('id="profile-tab-resumes"');
        expect(html).toContain('aria-controls="profile-panel-resumes"');
        expect(html).toContain('tabindex="0"');
        expect(html.match(/tabindex="-1"/g)).toHaveLength(5);
        expect(html).toContain('>3</span>');
    });

    it('omits the resume count until the list has loaded', () => {
        const html = renderToStaticMarkup(
            <ProfileTabBar active="overview" onChange={vi.fn()} />,
        );

        expect(html).toContain('id="profile-tab-overview"');
        expect(html).not.toContain('rounded-full px-1.5');
    });
});
