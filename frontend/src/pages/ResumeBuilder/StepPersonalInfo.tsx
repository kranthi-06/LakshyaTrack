import { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';
import { SectionCard, FieldInput, FieldTextarea, AIButton, RegenerateBar } from './components';
import { enhancePersonalInfo, regenerateSection } from '../../services/resumeBuilder';
import type { ResumeData, PersonalInfo } from './types';

export function StepPersonalInfo({ data, onChange }: { data: ResumeData; onChange: (d: Partial<ResumeData>) => void }) {
    const [aiLoading, setAiLoading] = useState(false);
    const [enhanced, setEnhanced] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const p = data.personal;
    const set = (field: keyof PersonalInfo, val: string) => onChange({ personal: { ...p, [field]: val } });

    // Count professional links for guidance
    const linkCount = [
        p.linkedin_url, p.github_url, p.portfolio_url, p.website_url,
        p.leetcode_url, p.hackerrank_url, p.kaggle_url
    ].filter(url => url?.trim()).length;
    const RECOMMENDED_MAX_LINKS = 5;

    const handleEnhance = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const result = await enhancePersonalInfo({ ...p, target_role: data.target_role });
            if (!result.error) {
                onChange({ personal: { ...p, full_name: result.full_name || p.full_name, email: result.email || p.email, phone: result.phone || p.phone, location: result.location || p.location, professional_summary: result.professional_summary || p.professional_summary } });
                setEnhanced(true);
            } else {
                setAiError(result.error || 'AI enhancement failed');
            }
        } catch (e: any) {
            console.error(e);
            const message = e.response?.data?.detail || e.message || 'AI enhancement failed. Please try again.';
            setAiError(message);
        }
        setAiLoading(false);
    };

    const handleRegen = async (mode: string) => {
        setAiLoading(true);
        setAiError(null);
        try {
            const result = await regenerateSection({ section_data: { section: 'personal_info', ...p }, mode, target_role: data.target_role });
            if (result.professional_summary) set('professional_summary', result.professional_summary);
        } catch (e: any) {
            console.error(e);
            const message = e.response?.data?.detail || e.message || 'Regeneration failed. Please try again.';
            setAiError(message);
        }
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
                <FieldInput label="LeetCode URL" value={p.leetcode_url || ''} onChange={v => set('leetcode_url', v)} placeholder="leetcode.com/username" />
                <FieldInput label="HackerRank URL" value={p.hackerrank_url || ''} onChange={v => set('hackerrank_url', v)} placeholder="hackerrank.com/username" />
                <FieldInput label="Kaggle URL" value={p.kaggle_url || ''} onChange={v => set('kaggle_url', v)} placeholder="kaggle.com/username" />
            </div>
            {linkCount > RECOMMENDED_MAX_LINKS && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Link Count Guidance</p>
                        <p className="text-amber-700">
                            You've added {linkCount} professional links. We recommend keeping your resume header concise (up to {RECOMMENDED_MAX_LINKS} links). Consider including only the links most relevant to this application.
                        </p>
                    </div>
                </div>
            )}
            <FieldTextarea label="Professional Summary (raw text - AI will improve it)" value={p.professional_summary} onChange={v => set('professional_summary', v)} placeholder="Write a rough summary of your background... AI will transform it into a professional statement." rows={4} />
            {aiError && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">AI Enhancement Error</p>
                        <p className="text-amber-700">{aiError}</p>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <AIButton onClick={handleEnhance} loading={aiLoading} label={enhanced ? 'Re-enhance with AI' : 'Enhance with AI'} />
                {enhanced && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">✅ AI Enhanced</span>}
            </div>
            {enhanced && <RegenerateBar onRegenerate={handleRegen} loading={aiLoading} />}
        </SectionCard>
    );
}
