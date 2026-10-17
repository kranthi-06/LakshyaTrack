/**
 * useExamMode — Custom hook for exam proctoring on the Quiz page.
 * Manages fullscreen, anti-cheat detection, tab tracking, and keyboard locks.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface ExamModeState {
    isExamActive: boolean;
    isFullscreen: boolean;
    showFullscreenWarning: boolean;
    fullscreenCountdown: number;
    tabSwitchCount: number;
    showTabWarning: boolean;
    isTerminated: boolean;
    terminationReason: string;
    showFocusWarning: boolean;
    isOffline: boolean;
}

interface UseExamModeReturn extends ExamModeState {
    activateExamMode: () => Promise<void>;
    deactivateExamMode: () => void;
    dismissTabWarning: () => void;
    returnToFullscreen: () => Promise<void>;
}

type AttachedExamHandlers = {
    fullscreenchange: () => void;
    visibilitychange: () => void;
    keydown: (event: KeyboardEvent) => void;
    contextmenu: (event: MouseEvent) => void;
    copy: (event: ClipboardEvent) => void;
    paste: (event: ClipboardEvent) => void;
    selectstart: (event: Event) => void;
    beforeunload: (event: BeforeUnloadEvent) => string | void;
    blur: () => void;
    focus: () => void;
    offline: () => void;
    online: () => void;
};

export function useExamMode(
    onTerminate: (reason: string) => void,
    onObservedEvent: (eventType: string, details?: Record<string, unknown>) => void = () => {},
): UseExamModeReturn {
    const [isExamActive, setIsExamActive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
    const [fullscreenCountdown, setFullscreenCountdown] = useState(30);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [isTerminated, setIsTerminated] = useState(false);
    const [terminationReason, setTerminationReason] = useState('');
    const [showFocusWarning, setShowFocusWarning] = useState(false);
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isExamActiveRef = useRef(false);
    const tabSwitchCountRef = useRef(0);
    const terminatedRef = useRef(false);
    const fullscreenCountdownRef = useRef(30);
    const blurStartedAtRef = useRef<number | null>(null);
    const offlineRef = useRef(typeof navigator !== 'undefined' && !navigator.onLine);
    const attachedHandlersRef = useRef<AttachedExamHandlers | null>(null);
    const previousUserSelectRef = useRef<{ userSelect: string; webkitUserSelect: string } | null>(null);
    const onTerminateRef = useRef(onTerminate);
    const onObservedEventRef = useRef(onObservedEvent);
    // Keep refs in sync
    useEffect(() => {
        onTerminateRef.current = onTerminate;
        onObservedEventRef.current = onObservedEvent;
    }, [onTerminate, onObservedEvent]);
    useEffect(() => { isExamActiveRef.current = isExamActive; }, [isExamActive]);
    useEffect(() => { tabSwitchCountRef.current = tabSwitchCount; }, [tabSwitchCount]);

    const detachExamListeners = useCallback(() => {
        const handlers = attachedHandlersRef.current;
        if (handlers) {
            document.removeEventListener('fullscreenchange', handlers.fullscreenchange);
            document.removeEventListener('visibilitychange', handlers.visibilitychange);
            document.removeEventListener('keydown', handlers.keydown, true);
            document.removeEventListener('contextmenu', handlers.contextmenu);
            document.removeEventListener('copy', handlers.copy);
            document.removeEventListener('paste', handlers.paste);
            document.removeEventListener('selectstart', handlers.selectstart);
            window.removeEventListener('beforeunload', handlers.beforeunload);
            window.removeEventListener('blur', handlers.blur);
            window.removeEventListener('focus', handlers.focus);
            window.removeEventListener('offline', handlers.offline);
            window.removeEventListener('online', handlers.online);
            attachedHandlersRef.current = null;
        }
        isExamActiveRef.current = false;
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
        blurStartedAtRef.current = null;
        const previousStyle = previousUserSelectRef.current;
        if (previousStyle) {
            document.body.style.userSelect = previousStyle.userSelect;
            document.body.style.webkitUserSelect = previousStyle.webkitUserSelect;
            previousUserSelectRef.current = null;
        }
    }, []);

    const terminateExam = useCallback((reason: string) => {
        if (terminatedRef.current) return;
        terminatedRef.current = true;
        detachExamListeners();
        setIsTerminated(true);
        setTerminationReason(reason);
        setIsExamActive(false);
        setShowFullscreenWarning(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
        onTerminateRef.current(reason);
    }, [detachExamListeners]);

    // ── Fullscreen change handler ──
    const handleFullscreenChange = useCallback(() => {
        if (!isExamActiveRef.current) return;

        const inFullscreen = !!document.fullscreenElement;
        setIsFullscreen(inFullscreen);

        if (!inFullscreen) {
            // User exited fullscreen — start 30s countdown
            setShowFullscreenWarning(true);
            setFullscreenCountdown(30);
            fullscreenCountdownRef.current = 30;

            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                const next = fullscreenCountdownRef.current - 1;
                fullscreenCountdownRef.current = next;
                setFullscreenCountdown(next);
                if (next <= 0) terminateExam('Fullscreen exit timeout');
            }, 1000);
        } else {
            // User returned to fullscreen — cancel countdown
            setShowFullscreenWarning(false);
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }
    }, [terminateExam]);

    // ── Tab visibility change handler ──
    const handleVisibilityChange = useCallback(() => {
        if (!isExamActiveRef.current) return;
        if (document.hidden) {
            if (blurTimerRef.current) {
                clearTimeout(blurTimerRef.current);
                blurTimerRef.current = null;
            }
            blurStartedAtRef.current = null;
            const newCount = tabSwitchCountRef.current + 1;
            tabSwitchCountRef.current = newCount;
            setTabSwitchCount(newCount);

            if (newCount >= 2) {
                terminateExam('Multiple tab switches detected');
            } else {
                setShowTabWarning(true);
            }
        }
    }, [terminateExam]);

    // ── Keyboard shortcut blocker ──
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isExamActiveRef.current) return;
        const key = e.key.toLowerCase();
        const shortcutKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        let combo: string | null = null;
        if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) {
            combo = `Ctrl+Shift+${shortcutKey}`;
        } else if (e.ctrlKey && ['c', 'v', 'u', 'a', 's', 'p'].includes(key)) {
            combo = `Ctrl+${shortcutKey}`;
        } else if (e.key === 'F12') {
            combo = 'F12';
        } else if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
            combo = 'PrintScreen';
        } else if (e.altKey && !['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
            combo = `Alt+${shortcutKey}`;
        } else if (e.metaKey && !['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
            combo = `Meta+${shortcutKey}`;
        }
        if (combo) {
            onObservedEventRef.current('restricted_shortcut', { combo });
            e.preventDefault();
            e.stopPropagation();
        }
    }, []);

    const handleBlur = useCallback(() => {
        if (!isExamActiveRef.current || document.visibilityState !== 'visible' || blurTimerRef.current) return;
        const startedAt = Date.now();
        blurStartedAtRef.current = startedAt;
        blurTimerRef.current = setTimeout(() => {
            blurTimerRef.current = null;
            if (
                isExamActiveRef.current &&
                document.visibilityState === 'visible' &&
                blurStartedAtRef.current === startedAt
            ) {
                setShowFocusWarning(true);
                onObservedEventRef.current('focus_lost', { duration_ms: Date.now() - startedAt });
            }
            blurStartedAtRef.current = null;
        }, 2000);
    }, []);

    const handleFocus = useCallback(() => {
        if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
        blurStartedAtRef.current = null;
        setShowFocusWarning(false);
    }, []);

    const handleOffline = useCallback(() => {
        if (!offlineRef.current) {
            offlineRef.current = true;
            setIsOffline(true);
            onObservedEventRef.current('network_offline');
        }
    }, []);

    const handleOnline = useCallback(() => {
        if (offlineRef.current) {
            offlineRef.current = false;
            setIsOffline(false);
            onObservedEventRef.current('network_online');
        }
    }, []);

    // ── Context menu blocker ──
    const handleContextMenu = useCallback((e: MouseEvent) => {
        if (!isExamActiveRef.current) return;
        e.preventDefault();
    }, []);

    // ── Copy/paste blocker ──
    const handleCopy = useCallback((e: ClipboardEvent) => {
        if (!isExamActiveRef.current) return;
        e.preventDefault();
    }, []);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (!isExamActiveRef.current) return;
        e.preventDefault();
    }, []);

    // ── Prevent page refresh ──
    const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
        if (!isExamActiveRef.current) return;
        e.preventDefault();
        e.returnValue = 'You are in the middle of an exam. Leaving will terminate it.';
        return e.returnValue;
    }, []);

    // ── Selection blocker (CSS applied in component) ──
    const handleSelectStart = useCallback((e: Event) => {
        if (!isExamActiveRef.current) return;
        e.preventDefault();
    }, []);

    // ── Activate exam mode ──
    const activateExamMode = useCallback(async () => {
        detachExamListeners();
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.warn('Fullscreen request failed:', err);
        }

        setIsExamActive(true);
        isExamActiveRef.current = true;
        terminatedRef.current = false;
        setIsTerminated(false);
        setTerminationReason('');
        tabSwitchCountRef.current = 0;
        setTabSwitchCount(0);
        setShowFullscreenWarning(false);
        setShowTabWarning(false);
        setShowFocusWarning(false);
        offlineRef.current = typeof navigator !== 'undefined' && !navigator.onLine;
        setIsOffline(offlineRef.current);
        if (offlineRef.current) onObservedEventRef.current('network_offline');
        previousUserSelectRef.current = {
            userSelect: document.body.style.userSelect,
            webkitUserSelect: document.body.style.webkitUserSelect,
        };
        const handlers: AttachedExamHandlers = {
            fullscreenchange: handleFullscreenChange,
            visibilitychange: handleVisibilityChange,
            keydown: handleKeyDown,
            contextmenu: handleContextMenu,
            copy: handleCopy,
            paste: handlePaste,
            selectstart: handleSelectStart,
            beforeunload: handleBeforeUnload,
            blur: handleBlur,
            focus: handleFocus,
            offline: handleOffline,
            online: handleOnline,
        };
        attachedHandlersRef.current = handlers;
        document.addEventListener('fullscreenchange', handlers.fullscreenchange);
        document.addEventListener('visibilitychange', handlers.visibilitychange);
        document.addEventListener('keydown', handlers.keydown, true);
        document.addEventListener('contextmenu', handlers.contextmenu);
        document.addEventListener('copy', handlers.copy);
        document.addEventListener('paste', handlers.paste);
        document.addEventListener('selectstart', handlers.selectstart);
        window.addEventListener('beforeunload', handlers.beforeunload);
        window.addEventListener('blur', handlers.blur);
        window.addEventListener('focus', handlers.focus);
        window.addEventListener('offline', handlers.offline);
        window.addEventListener('online', handlers.online);

        // Apply no-select style
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
    }, [detachExamListeners, handleFullscreenChange, handleVisibilityChange, handleKeyDown, handleContextMenu, handleCopy, handlePaste, handleBeforeUnload, handleSelectStart, handleBlur, handleFocus, handleOffline, handleOnline]);

    // ── Deactivate exam mode ──
    const deactivateExamMode = useCallback(() => {
        setIsExamActive(false);
        detachExamListeners();

        // Exit fullscreen if still in it
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
    }, [detachExamListeners]);

    const dismissTabWarning = useCallback(() => {
        setShowTabWarning(false);
    }, []);

    const returnToFullscreen = useCallback(async () => {
        try {
            await document.documentElement.requestFullscreen();
        } catch (err) {
            console.warn('Failed to return to fullscreen:', err);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => detachExamListeners();
    }, [detachExamListeners]);

    return {
        isExamActive,
        isFullscreen,
        showFullscreenWarning,
        fullscreenCountdown,
        tabSwitchCount,
        showTabWarning,
        isTerminated,
        terminationReason,
        showFocusWarning,
        isOffline,
        activateExamMode,
        deactivateExamMode,
        dismissTabWarning,
        returnToFullscreen,
    };
}
