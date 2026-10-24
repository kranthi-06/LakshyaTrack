import { useEffect, useRef } from 'react';
import { Captions, ChevronDown } from 'lucide-react';

export interface TranscriptLine {
    id: string;
    speaker: 'interviewer' | 'candidate';
    text: string;
}

export default function LiveTranscription({ lines, interim, open, onOpenChange }: { lines: TranscriptLine[]; interim: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [lines, interim]);
    return (
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-slate-950/90">
            <button type="button" onClick={() => onOpenChange(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100" aria-expanded={open}>
                <span className="flex items-center gap-2"><Captions className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />Live captions</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && <div className="max-h-60 space-y-3 overflow-y-auto border-t border-slate-100 px-4 py-3 text-sm dark:border-white/10">
                {lines.length === 0 && !interim && <p className="text-slate-500">Captions will appear here. They are not an audio recording.</p>}
                {lines.map((line) => <p key={line.id} className={line.speaker === 'interviewer' ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white'}><span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">{line.speaker === 'interviewer' ? 'Maya' : 'You'}</span>{line.text}</p>)}
                {interim && <p className="italic text-slate-500"><span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">You</span>{interim}</p>}
                <div ref={endRef} />
            </div>}
        </aside>
    );
}
