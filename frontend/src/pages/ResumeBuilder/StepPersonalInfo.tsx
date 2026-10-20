import { useState } from 'react';
import { User } from 'lucide-react';
import { SectionCard, FieldInput, FieldTextarea, AIButton, RegenerateBar } from './components';
import { enhancePersonalInfo, regenerateSection } from '../../services/resumeBuilder';
import type { ResumeData, PersonalInfo } from './types';

export function StepPersonalInfo({ data, onChange }: { data: ResumeData; onChange: (d: Partial<ResumeData>) => void }) {
    const [aiLoading, setAiLoading] = useState(false);
    const [enhanced, setEnhanced] = useState(false);
    const p = data.personal;
    const set = (field: keyof PersonalInfo, val: string) => onChange({ personal: { ...p, [field]: val } });

    const handleEnhance = async () => {
        setAiLoading(true);
        try {
            const result = await enhancePersonalInfo({ ...p, target_role: data.target_role });
            if (!result.error) {
                onChange({ personal: { ...p, full_name: result.full_name || p.full_name, email: result.email || p.email, phone: result.phone || p.phone, location: result.location || p.location, professional_summary: result.professional_summary || p.professional_summary } });
                setEnhanced(true);
            }
        } catch (e) { console.error(e); }
        setAiLoading(false);
    };

    const handleRegen = async (mode: string) => {
        setAiLoading(true);
        try {
            const result = await regenerateSection({ section_data: { section: 'personal_info', ...p }, mode, target_role: data.target_role });
            if (result.professional_summary) set('professional_summary', result.professional_summary);
        } catch (e) { console.error(e); }
        setAiLoading(false);
    };

    return (
        <SectionCard icon={User} title="Personal Information" subtitle="Your contact details and professional summary">
            <div className="grid md:grid-cols-2 gap-4">
                <FieldInput label="Full Name" value={p.full_name} onChange={v => set('full_name', v)} placeholder="John Doe" />
                <FieldInput label="Email" value={p.email} onChange={v => set('email', v)} placeholder="john@example.com" type="email" />
                <FieldInput label="Phone" value={p.phone} onChange={v => set('phone', v)} placeholder="+1 (555) 123-4567" />
                <FieldInput label="Location" value={p.location} onChange={v => set('location', v)} placeholder="City, State, Country" />
                <FieldInput label="Professional Headline" value={p.headline || ''} onChange={v => set('headline', v)} placeholder="Senior Full-Stack Engineer" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <FieldInput label="LinkedIn URL" value={p.linkedin_url || ''} onChange={v => set('linkedin_url', v)} placeholder="linkedin.com/in/username" />
                <FieldInput label="GitHub URL" value={p.github_url || ''} onChange={v => set('github_url', v)} placeholder="github.com/username" />
                <FieldInput label="Portfolio URL" value={p.portfolio_url || ''} onChange={v => set('portfolio_url', v)} placeholder="yourname.dev" />
                <FieldInput label="Website URL" value={p.website_url || ''} onChange={v => set('website_url', v)} placeholder="example.com" />
            </div>
            <FieldTextarea label="Professional Summary (raw text - AI will improve it)" value={p.professional_summary} onChange={v => set('professional_summary', v)} placeholder="Write a rough summary of your background... AI will transform it into a professional statement." rows={4} />
            <div className="flex items-center justify-between">
                <AIButton onClick={handleEnhance} loading={aiLoading} label={enhanced ? 'Re-enhance with AI' : 'Enhance with AI'} />
                {enhanced && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">✅ AI Enhanced</span>}
            </div>
            {enhanced && <RegenerateBar onRegenerate={handleRegen} loading={aiLoading} />}
        </SectionCard>
    );
}
