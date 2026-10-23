import { describe, expect, it } from 'vitest';
import type { SavedResumeRecord } from '../../services/resumeStorage';
import {
    asResumeData,
    duplicateResumeName,
    extractProjectsFromResumes,
    filterAndSortResumes,
    formatJoinDate,
    formatResumeDate,
    parseProfileTab,
    resumeAccentColor,
    resumeTimestamp,
} from './profileUtils';

const resume = (overrides: Partial<SavedResumeRecord>): SavedResumeRecord => ({
    id: '1',
    resume_name: 'Frontend Resume',
    resume_data: {
        projects: [{ name: 'Campus Portal', technologies: 'React', description: 'Student portal' }],
    },
    template_id: 'ats-clean',
    theme: '#334155',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
});

describe('parseProfileTab', () => {
    it('accepts known tabs and falls back to overview', () => {
        expect(parseProfileTab('resumes')).toBe('resumes');
        expect(parseProfileTab('unknown')).toBe('overview');
        expect(parseProfileTab(null)).toBe('overview');
    });
});

describe('extractProjectsFromResumes', () => {
    it('dedupes named projects and ignores blanks', () => {
        const projects = extractProjectsFromResumes([
            resume({ id: 'a' }),
            resume({
                id: 'b',
                resume_name: 'Other',
                resume_data: {
                    projects: [
                        { name: 'Campus Portal', technologies: 'Vue', description: 'Duplicate' },
                        { name: '', technologies: 'Go', description: 'skip' },
                        { name: 'Quiz Engine', technologies: 'Python', description: 'Adaptive quizzes' },
                    ],
                },
            }),
        ]);
        expect(projects.map(item => item.name)).toEqual(['Campus Portal', 'Quiz Engine']);
        expect(projects[0].sourceResumeName).toBe('Frontend Resume');
    });
});

describe('filterAndSortResumes', () => {
    it('filters by name or template and sorts by last update', () => {
        const resumes = [
            resume({ id: 'old', resume_name: 'Backend', updated_at: '2026-01-02T00:00:00.000Z' }),
            resume({ id: 'new', resume_name: 'Design', template_id: 'creative-portfolio', updated_at: '2026-03-01T00:00:00.000Z' }),
        ];
        expect(filterAndSortResumes(resumes, 'design', 'updated').map(item => item.id)).toEqual(['new']);
        expect(filterAndSortResumes(resumes, '', 'updated').map(item => item.id)).toEqual(['new', 'old']);
        expect(filterAndSortResumes(resumes, '', 'name').map(item => item.resume_name)).toEqual(['Backend', 'Design']);
    });

    it('searches target roles and created dates', () => {
        const resumes = [
            resume({ id: 'a', resume_name: 'General', target_role: 'Data Analyst' }),
            resume({ id: 'b', resume_name: 'Other', target_role: 'Designer' }),
        ];
        expect(filterAndSortResumes(resumes, 'data analyst', 'updated').map(item => item.id)).toEqual(['a']);
    });
});

describe('date helpers', () => {
    it('renders honest fallbacks for missing or invalid dates', () => {
        expect(formatJoinDate(null)).toBe('Recently joined');
        expect(formatJoinDate('not-a-date')).toBe('Recently joined');
        expect(formatResumeDate(null)).toBe('Unknown date');
        expect(formatResumeDate('not-a-date')).toBe('Unknown date');
        expect(resumeTimestamp(resume({ updated_at: null, created_at: null }))).toBe(0);
    });
});

describe('resume helpers', () => {
    it('uses stored hex accents and duplicates names incrementally', () => {
        expect(resumeAccentColor(resume({ theme: '#abc123' }))).toBe('#abc123');
        expect(duplicateResumeName('SWE Resume')).toBe('SWE Resume (copy)');
        expect(duplicateResumeName('SWE Resume (copy)')).toBe('SWE Resume (copy 2)');
        expect(asResumeData(null).personal.full_name).toBe('');
    });

    it('preserves saved personal data while defaulting missing sections', () => {
        const data = asResumeData({ personal: { full_name: 'Kasa', email: 'kasa@example.com' } });
        expect(data.personal.full_name).toBe('Kasa');
        expect(data.personal.email).toBe('kasa@example.com');
        expect(data.skills.technical_skills).toEqual([]);
    });

    it('normalizes legacy array fields on saved projects', () => {
        const legacy = {
            projects: [{
                name: 'Campus Portal',
                technologies: ['React', 'Node.js'],
                description: ['Built the portal', 'Handled auth'],
            }],
        };

        const data = asResumeData(legacy);
        expect(data.projects[0]).toMatchObject({
            name: 'Campus Portal',
            technologies: 'React, Node.js',
            description: 'Built the portal, Handled auth',
        });

        const projects = extractProjectsFromResumes([resume({ resume_data: legacy })]);
        expect(projects[0].technologies).toBe('React, Node.js');
        expect(projects[0].description).toBe('Built the portal, Handled auth');
    });
});
