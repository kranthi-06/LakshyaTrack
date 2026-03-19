import { useEffect, useRef } from 'react';

export function useBeforeUnload(
    isDirty: boolean,
    opts?: {
        onSyncSave?: () => void;
        onSyncSaved?: () => void;
    },
) {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;

            // Best-effort synchronous local persistence (no async allowed in beforeunload).
            try {
                optsRef.current?.onSyncSave?.();
                optsRef.current?.onSyncSaved?.();
            } catch {
                // Ignore — never block unload.
            }

            e.preventDefault();
            // Most browsers ignore the custom text, but setting this value enables the prompt.
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);
}

