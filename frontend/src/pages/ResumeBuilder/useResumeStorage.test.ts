import { describe, expect, it } from 'vitest';
import { coerceResumeData } from './useResumeStorage';

describe('coerceResumeData', () => {
    it('preserves section metadata and professional contact links', () => {
        const data = coerceResumeData({
            target_role: 'Engineer',
            personal: {
                full_name: 'Asha',
                email: 'a@b.com',
                linkedin_url: 'https://linkedin.com/in/asha',
                headline: 'Backend engineer',
            },
            section_order: ['skills', 'experience'],
            hidden_sections: ['projects'],
            custom_sections: [{ id: 'c1', title: 'Certs', content: 'AWS', zone: 'sidebar' }],
        });

        expect(data.section_order).toEqual(['skills', 'experience']);
        expect(data.hidden_sections).toEqual(['projects']);
        expect(data.custom_sections).toEqual([{ id: 'c1', title: 'Certs', content: 'AWS', zone: 'sidebar' }]);
        expect(data.personal.linkedin_url).toBe('https://linkedin.com/in/asha');
        expect(data.personal.headline).toBe('Backend engineer');
    });
});
