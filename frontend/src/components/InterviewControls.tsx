import type { ReactNode } from 'react';
import { Captions, CirclePause, CirclePlay, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';

const Control = ({ label, active = false, danger = false, disabled = false, onClick, children }: { label: string; active?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`group flex min-w-14 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-300' : active ? 'bg-cyan-500 text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>{children}<span>{label}</span></button>
);

export default function InterviewControls({ listening, paused, captionsOpen, canListen, onMic, onPause, onCaptions, onRepeat, onEnd }: { listening: boolean; paused: boolean; captionsOpen: boolean; canListen: boolean; onMic: () => void; onPause: () => void; onCaptions: () => void; onRepeat: () => void; onEnd: () => void }) {
    return <nav aria-label="Interview controls" className="flex w-full items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl shadow-slate-950/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
        <Control label={listening ? 'Stop listening' : 'Answer aloud'} active={listening} disabled={!canListen || paused} onClick={onMic}>{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</Control>
        <Control label={captionsOpen ? 'Hide captions' : 'Show captions'} active={captionsOpen} onClick={onCaptions}><Captions className="h-5 w-5" /></Control>
        <Control label="Repeat question" disabled={paused} onClick={onRepeat}><Volume2 className="h-5 w-5" /></Control>
        <Control label={paused ? 'Resume interview' : 'Pause interview'} active={paused} onClick={onPause}>{paused ? <CirclePlay className="h-5 w-5" /> : <CirclePause className="h-5 w-5" />}</Control>
        <Control label="End interview" danger onClick={onEnd}><PhoneOff className="h-5 w-5" /></Control>
    </nav>;
}
