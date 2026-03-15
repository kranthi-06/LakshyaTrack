import { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
    expiresAt: Date;
    onExpired?: () => void;
    className?: string;
    compact?: boolean;
}

/**
 * Live countdown timer that updates every second.
 * Shows hours:minutes:seconds until expiry.
 */
export default function CountdownTimer({ expiresAt, onExpired, className = '', compact = false }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(expiresAt));

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = calculateTimeLeft(expiresAt);
            setTimeLeft(remaining);

            if (remaining.total <= 0) {
                clearInterval(interval);
                onExpired?.();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, onExpired]);

    if (timeLeft.total <= 0) {
        return (
            <span className={`text-red-500 font-medium text-xs ${className}`}>
                Expired
            </span>
        );
    }

    const pad = (n: number) => String(n).padStart(2, '0');

    if (compact) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-mono font-semibold ${className}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="2" />
                </svg>
                {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
            </span>
        );
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 ${className}`}>
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="2" />
            </svg>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Access expires in</span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
            </span>
        </div>
    );
}

function calculateTimeLeft(expiresAt: Date) {
    const now = new Date().getTime();
    const diff = expiresAt.getTime() - now;
    const total = Math.max(0, diff);

    return {
        total,
        hours: Math.floor(total / (1000 * 60 * 60)),
        minutes: Math.floor((total / (1000 * 60)) % 60),
        seconds: Math.floor((total / 1000) % 60),
    };
}
