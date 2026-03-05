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
}

interface UseExamModeReturn extends ExamModeState {
    activateExamMode: () => Promise<void>;
    deactivateExamMode: () => void;
    dismissTabWarning: () => void;
    returnToFullscreen: () => Promise<void>;
}

export function useExamMode(
    onTerminate: (reason: string) => void,
): UseExamModeReturn {
    const [isExamActive, setIsExamActive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
    const [fullscreenCountdown, setFullscreenCountdown] = useState(30);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [isTerminated, setIsTerminated] = useState(false);
    const [terminationReason, setTerminationReason] = useState('');

    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isExamActiveRef = useRef(false);
    const tabSwitchCountRef = useRef(0);

    // Keep refs in sync
    useEffect(() => { isExamActiveRef.current = isExamActive; }, [isExamActive]);
    useEffect(() => { tabSwitchCountRef.current = tabSwitchCount; }, [tabSwitchCount]);

    const terminateExam = useCallback((reason: string) => {
        setIsTerminated(true);
        setTerminationReason(reason);
        setIsExamActive(false);
        setShowFullscreenWarning(false);
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        // Exit fullscreen if still in it
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
        onTerminate(reason);
    }, [onTerminate]);

    // ── Fullscreen change handler ──
    const handleFullscreenChange = useCallback(() => {
        if (!isExamActiveRef.current) return;

        const inFullscreen = !!document.fullscreenElement;
        setIsFullscreen(inFullscreen);

        if (!inFullscreen) {
            // User exited fullscreen — start 30s countdown
            setShowFullscreenWarning(true);
            setFullscreenCountdown(30);

            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                setFullscreenCountdown(prev => {
                    if (prev <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        terminateExam('Fullscreen exit timeout');
                        return 0;
                    }
                    return prev - 1;
                });
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
            const newCount = tabSwitchCountRef.current + 1;
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

        // Block Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+A, Ctrl+S, Ctrl+P, F12
        if (e.ctrlKey && ['c', 'v', 'u', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.key === 'F12') {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // Block Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            e.stopPropagation();
            return;
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
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.warn('Fullscreen request failed:', err);
        }

        setIsExamActive(true);
        setIsTerminated(false);
        setTerminationReason('');
        setTabSwitchCount(0);
        setShowFullscreenWarning(false);
        setShowTabWarning(false);

        // Attach event listeners
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('selectstart', handleSelectStart);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Apply no-select style
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
    }, [handleFullscreenChange, handleVisibilityChange, handleKeyDown, handleContextMenu, handleCopy, handlePaste, handleBeforeUnload, handleSelectStart]);

    // ── Deactivate exam mode ──
    const deactivateExamMode = useCallback(() => {
        setIsExamActive(false);

        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }

        // Remove event listeners
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handlePaste);
        document.removeEventListener('selectstart', handleSelectStart);
        window.removeEventListener('beforeunload', handleBeforeUnload);

        // Restore selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';

        // Exit fullscreen if still in it
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
    }, [handleFullscreenChange, handleVisibilityChange, handleKeyDown, handleContextMenu, handleCopy, handlePaste, handleBeforeUnload, handleSelectStart]);

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
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('selectstart', handleSelectStart);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
        };
    }, []);

    return {
        isExamActive,
        isFullscreen,
        showFullscreenWarning,
        fullscreenCountdown,
        tabSwitchCount,
        showTabWarning,
        isTerminated,
        terminationReason,
        activateExamMode,
        deactivateExamMode,
        dismissTabWarning,
        returnToFullscreen,
    };
}
