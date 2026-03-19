import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveReason = 'interval' | 'visibility' | 'manual';

export function useAutoSave(opts: {
    enabled?: boolean;
    isDirty: boolean;
    onSave: (reason: AutoSaveReason) => Promise<void> | void;
    intervalMs?: number; // default: 5000ms
    debounceMs?: number; // default: 400ms
    minSavingMs?: number; // default: 300ms (prevents "Saving..." flicker)
}) {
    const {
        enabled = true,
        isDirty,
        onSave,
        intervalMs = 5000,
        debounceMs = 400,
        minSavingMs = 300,
    } = opts;

    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    const onSaveRef = useRef(onSave);
    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const currentSavePromiseRef = useRef<Promise<void> | null>(null);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceReasonRef = useRef<AutoSaveReason>('interval');
    const debouncePromiseRef = useRef<Promise<void> | null>(null);
    const debounceResolveRef = useRef<(() => void) | null>(null);
    const debounceRejectRef = useRef<((err: unknown) => void) | null>(null);

    const executeSave = useCallback(
        async (reason: AutoSaveReason) => {
            if (!enabled) return;
            if (reason !== 'manual' && !isDirtyRef.current) return;

            if (savingRef.current && currentSavePromiseRef.current) {
                return currentSavePromiseRef.current;
            }

            // Clear any pending debounce timer.
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            debouncePromiseRef.current = null;
            debounceResolveRef.current = null;
            debounceRejectRef.current = null;

            const startedAt = Date.now();
            setSaving(true);
            savingRef.current = true;

            const p = (async () => {
                try {
                    await onSaveRef.current(reason);
                } catch {
                    // Fail silently (auto-save must never break the UI).
                } finally {
                    const elapsed = Date.now() - startedAt;
                    const remaining = Math.max(0, minSavingMs - elapsed);
                    if (remaining > 0) await new Promise(res => setTimeout(res, remaining));
                    savingRef.current = false;
                    setSaving(false);
                }
            })();

            currentSavePromiseRef.current = p;
            try {
                await p;
            } finally {
                if (currentSavePromiseRef.current === p) currentSavePromiseRef.current = null;
            }
        },
        [enabled, minSavingMs],
    );

    const triggerSave = useCallback(
        (reason: AutoSaveReason, opts?: { immediate?: boolean }) => {
            const immediate = opts?.immediate ?? false;
            if (!enabled) return Promise.resolve();

            if (immediate) {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                }
                // If a debounced promise exists, resolve it so callers don't hang.
                if (debounceResolveRef.current) debounceResolveRef.current();
                debouncePromiseRef.current = null;
                debounceResolveRef.current = null;
                debounceRejectRef.current = null;
                debounceReasonRef.current = reason;
                return executeSave(reason);
            }

            // Debounced path.
            // If we already have a debounced promise, reuse it and just update the reason.
            if (debouncePromiseRef.current) {
                debounceReasonRef.current = reason;
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = setTimeout(() => {
                    debounceTimerRef.current = null;
                    const latestReason = debounceReasonRef.current;
                    void executeSave(latestReason).then(() => {
                        debounceResolveRef.current?.();
                        debouncePromiseRef.current = null;
                        debounceResolveRef.current = null;
                        debounceRejectRef.current = null;
                    }).catch(err => {
                        debounceRejectRef.current?.(err);
                        debouncePromiseRef.current = null;
                        debounceResolveRef.current = null;
                        debounceRejectRef.current = null;
                    });
                }, debounceMs);
                return debouncePromiseRef.current;
            }

            debounceReasonRef.current = reason;
            debouncePromiseRef.current = new Promise<void>((resolve, reject) => {
                debounceResolveRef.current = resolve;
                debounceRejectRef.current = reject;

                debounceTimerRef.current = setTimeout(() => {
                    debounceTimerRef.current = null;
                    const latestReason = debounceReasonRef.current;
                    void executeSave(latestReason).then(() => {
                        debounceResolveRef.current?.();
                        debouncePromiseRef.current = null;
                        debounceResolveRef.current = null;
                        debounceRejectRef.current = null;
                    }).catch(err => {
                        debounceRejectRef.current?.(err);
                        debouncePromiseRef.current = null;
                        debounceResolveRef.current = null;
                        debounceRejectRef.current = null;
                    });
                }, debounceMs);
            });

            return debouncePromiseRef.current;
        },
        [debounceMs, executeSave, enabled],
    );

    useEffect(() => {
        if (!enabled) return;

        const intervalId = window.setInterval(() => {
            if (!isDirtyRef.current) return;
            // Interval-based saves are debounced a little to avoid redundant writes during rapid edits.
            void triggerSave('interval', { immediate: false });
        }, intervalMs);

        const onVisibilityChange = () => {
            if (document.hidden && isDirtyRef.current) {
                // When the tab is hidden, save immediately.
                void triggerSave('visibility', { immediate: true });
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [enabled, intervalMs, triggerSave]);

    return { saving, triggerSave };
}

