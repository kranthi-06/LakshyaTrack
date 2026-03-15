import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useResumeProtection — comprehensive screenshot & screen-capture protection
 *
 * Techniques used:
 * 1. Window blur (alt-tab, Snipping tool, etc.) -> STAYS BLURRED until focus returns
 * 2. Page Visibility API -> STAYS BLURRED until tab is visible again
 * 3. PrintScreen key interception -> timed blur
 * 4. Win+Shift+S / Mac shortcuts -> instant blur (window focus loss handles the hold)
 * 5. Transparent video overlay -> hardware-accelerated DRM-style protection
 *
 * This protection applies to ALL users permanently.
 */
export function useResumeProtection() {
    const [isCapturing, setIsCapturing] = useState(false);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Some events require a timed blur (like PrintScreen button)
    const triggerTimedBlur = useCallback((duration = 3000) => {
        setIsCapturing(true);
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        blurTimerRef.current = setTimeout(() => {
            // Only unblur if the window actually has focus and is visible
            if (document.hasFocus() && !document.hidden) {
                setIsCapturing(false);
            }
        }, duration);
    }, []);

    useEffect(() => {
        // Initial check - if page loads in background, blur it
        if (!document.hasFocus() || document.hidden) {
            setIsCapturing(true);
        }

        const handleFocus = () => {
            // When regaining focus, unblur after a short delay (1-2s)
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            blurTimerRef.current = setTimeout(() => {
                setIsCapturing(false);
            }, 1000);
        };

        const handleBlur = () => {
            // Stay blurred as long as window doesn't have focus
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setIsCapturing(true);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                setIsCapturing(true);
            } else {
                handleFocus();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen') {
                triggerTimedBlur(3000);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            if (e.key === 'PrintScreen') {
                triggerTimedBlur(3000);
                return;
            }

            // Win shortcut (Windows key) - Snipping tool often uses this
            if (key === 'meta' || key === 'os') {
                triggerTimedBlur(3000);
                return;
            }

            // Win+Shift+S
            if (key === 's' && e.shiftKey && (e.metaKey || e.getModifierState('OS'))) {
                triggerTimedBlur(3000);
                return;
            }

            // Mac shortcuts
            if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key)) {
                triggerTimedBlur(3000);
                return;
            }

            // Print
            if ((e.ctrlKey || e.metaKey) && key === 'p') {
                e.preventDefault();
                triggerTimedBlur(3000);
                return;
            }
            
            // DevTools
            if ((e.ctrlKey && e.shiftKey && key === 'i') || e.key === 'F12') {
                triggerTimedBlur(3000);
                return;
            }
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('keydown', handleKeyDown, { capture: true });
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        };
    }, [triggerTimedBlur]);

    // ── Setup transparent video overlay for hardware DRM protection ──
    const setupVideoOverlay = useCallback((container: HTMLElement | null) => {
        if (!container) return;

        const existingVideo = container.querySelector('.resume-drm-video');
        if (existingVideo) existingVideo.remove();

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
                ctx.fillRect(0, 0, 2, 2);
            }

            const stream = canvas.captureStream(1);
            const video = document.createElement('video');
            video.className = 'resume-drm-video';
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                opacity: 0.01;
                z-index: 15;
                object-fit: cover;
            `;

            container.style.position = 'relative';
            container.appendChild(video);
            video.play().catch(() => { /* autoplay may be blocked */ });

            videoRef.current = video;
        } catch {
            /* ignore unsupported */
        }
    }, []);

    const paperProtectionStyle: React.CSSProperties = {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // @ts-ignore
        MozUserSelect: 'none',
        // @ts-ignore
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        filter: isCapturing ? 'blur(30px) brightness(0.3)' : 'none',
        transition: 'filter 0.05s ease-out',
    };

    const paperProtectionHandlers = {
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onDragStart: (e: React.DragEvent) => e.preventDefault(),
        onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    };

    return {
        isCapturing,
        paperProtectionStyle,
        paperProtectionHandlers,
        setupVideoOverlay,
        triggerBlur: triggerTimedBlur,
    };
}
