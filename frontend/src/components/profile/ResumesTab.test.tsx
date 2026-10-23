import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { SavedResumeRecord } from '../../services/resumeStorage';
import { ResumesTab } from './ResumesTab';

vi.mock('../FeatureLockButton', () => ({
    UsageBadge: () => null,
}));

const resume = (overrides: Partial<SavedResumeRecord>): SavedResumeRecord => ({
    id: 'resume-1',
    resume_name: 'Frontend Resume',
    resume_data: { projects: [{ name: 'Campus Portal' }] },
    template_id: 'ats-clean',
    theme: '#334155',
    target_role: 'Frontend Engineer',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
});

function renderTab(ui: ReactElement) {
    return renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);
}

const baseProps = {
    loading: false,
    error: null,
    planLabel: 'Free',
    downloadLocked: false,
    storageLimitReached: false,
    downloadLimitReached: false,
    previewResume: null,
    onRetry: vi.fn(),
    onEdit: vi.fn(),
    onPreview: vi.fn(),
    onDownloadPdf: vi.fn(),
    onDownloadDocx: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDuplicate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
};

describe('ResumesTab', () => {
    it('shows an honest empty state with a path into Resume Studio', () => {
        const html = renderTab(<ResumesTab {...baseProps} resumes={[]} />);

        expect(html).toContain('No saved resumes');
        expect(html).toContain('it does not create a second library');
        expect(html).toContain('href="/resume-builder"');
        expect(html).toContain('Open Resume Studio');
    });

    it('renders owned resumes with template metadata and every action', () => {
        const html = renderTab(
            <ResumesTab
                {...baseProps}
                resumes={[
                    resume({ id: 'a', resume_name: 'Frontend Resume' }),
                    resume({
                        id: 'b',
                        resume_name: 'Data Resume',
                        template_id: 'creative-portfolio',
                        updated_at: '2026-03-01T00:00:00.000Z',
                    }),
                ]}
            />,
        );

        expect(html).toContain('Frontend Resume');
        expect(html).toContain('Data Resume');
        expect(html).toContain('ATS Clean');
        expect(html).toContain('Creative Portfolio');
        expect(html.match(/Download Frontend Resume as PDF/g)).toHaveLength(1);
        expect(html.match(/Download Frontend Resume as DOCX/g)).toHaveLength(1);
        expect(html.match(/>\s*Preview\s*</g)).toHaveLength(2);
        expect(html.match(/>\s*Edit\s*</g)).toHaveLength(2);
        expect(html.match(/>\s*Rename\s*</g)).toHaveLength(2);
        expect(html.match(/>\s*Duplicate\s*</g)).toHaveLength(2);
        expect(html.match(/>\s*Delete\s*</g)).toHaveLength(2);
    });

    it('keeps download buttons interactive when the monthly limit is reached', () => {
        const html = renderTab(
            <ResumesTab
                {...baseProps}
                downloadLocked
                downloadLimitReached
                resumes={[resume({})]}
            />,
        );

        expect(html).toContain('Download limit reached');
        expect(html).toContain('title="Monthly download limit reached"');
        expect(html).not.toMatch(/aria-label="Download Frontend Resume as PDF"[^>]*disabled/);
    });

    it('surfaces a load failure with retry and does not claim the library is empty', () => {
        const html = renderTab(
            <ResumesTab {...baseProps} resumes={[]} error="We could not load your saved resumes." />,
        );

        expect(html).toContain('We could not load your saved resumes.');
        expect(html).toContain('Retry');
        expect(html).not.toContain('No saved resumes');
    });
});
