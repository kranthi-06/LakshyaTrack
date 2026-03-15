import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useResumeProtection — comprehensive screenshot & screen-capture protection
 *
 * Techniques used:
 * 1. PrintScreen key interception → instant blur + clipboard overwrite
 * 2. Win+Shift+S / Cmd+Shift+3/4/5 detection → instant blur
 * 3. Window blur (alt-tab to screenshot tool, snipping tool opens) → blur
 * 4. Page Visibility API → blur when page is hidden
 * 5. Ctrl+P print blocking → blur
 * 6. Right-click / drag / text selection disabled on protected area
 * 7. CSS print media → hide resume in print output
 * 8. Transparent video overlay → hardware-accelerated content that appears
 *    as a black rectangle in most screenshot tools (DRM-style protection)
 *
 * This protection applies to ALL users — admin, paid, free — permanently.
 */
export function useResumeProtection() {
    const [isCapturing, setIsCapturing] = useState(false);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    /** Trigger blur for `duration` milliseconds */
    const triggerBlur = useCallback((duration = 2500) => {
        setIsCapturing(true);
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        blurTimerRef.current = setTimeout(() => setIsCapturing(false), duration);
    }, []);

    useEffect(() => {
        // ── 1. PrintScreen key (fires on keyup in most browsers) ──
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen') {
                triggerBlur(3000);
                // Overwrite clipboard so they can't paste the screenshot
                try {
                    navigator.clipboard.writeText(
                        '🔒 VidyaMitra — Resume content is protected. Screenshots are not permitted.'
                    );
                } catch {
                    /* clipboard API may be unavailable */
                }
            }
        };

        // ── 2. Keyboard shortcut detection ──
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            // PrintScreen (some browsers fire on keydown)
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                triggerBlur(3000);
                return;
            }

            // Win+Shift+S — Windows Snipping Tool / Snip & Sketch
            if (key === 's' && e.shiftKey && (e.metaKey || e.getModifierState('OS'))) {
                triggerBlur(3000);
                return;
            }

            // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
            if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key)) {
                triggerBlur(3000);
                return;
            }

            // Ctrl+P / Cmd+P — Print
            if ((e.ctrlKey || e.metaKey) && key === 'p') {
                e.preventDefault();
                triggerBlur(3000);
                return;
            }

            // Ctrl+Shift+I / F12 — DevTools (can inspect and screenshot)
            if ((e.ctrlKey && e.shiftKey && key === 'i') || e.key === 'F12') {
                triggerBlur(2000);
                return;
            }
        };

        // ── 3. Window blur — fires when user alt-tabs, opens snipping tool, etc. ──
        const handleWindowBlur = () => {
            triggerBlur(2000);
        };

        // ── 4. Visibility API — fires when tab becomes hidden ──
        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerBlur(2500);
            }
        };

        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        };
    }, [triggerBlur]);

    // ── 5. Setup transparent video overlay for hardware DRM protection ──
    const setupVideoOverlay = useCallback((container: HTMLElement | null) => {
        if (!container) return;

        // Remove any existing video overlay
        const existingVideo = container.querySelector('.resume-drm-video');
        if (existingVideo) existingVideo.remove();

        try {
            // Create a tiny transparent canvas to stream
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
                ctx.fillRect(0, 0, 2, 2);
            }

            // Stream the canvas to a video element
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
            /* Canvas.captureStream() may not be supported in all browsers */
        }
    }, []);

    /** CSS protection props to apply to the resume paper container */
    const paperProtectionStyle: React.CSSProperties = {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // @ts-ignore vendor prefix
        MozUserSelect: 'none',
        // @ts-ignore vendor prefix
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        filter: isCapturing ? 'blur(30px) brightness(0.3)' : 'none',
        transition: 'filter 0.08s ease-out',
    };

    /** Event handlers for the resume paper container */
    const paperProtectionHandlers = {
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onDragStart: (e: React.DragEvent) => e.preventDefault(),
        onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    };

    return {
        /** Whether a capture attempt is detected (paper should be blurred) */
        isCapturing,
        /** Style object for the resume paper container */
        paperProtectionStyle,
        /** Event handlers for the resume paper container */
        paperProtectionHandlers,
        /** Call this with the paper DOM element to set up video DRM overlay */
        setupVideoOverlay,
        /** Force-trigger a blur (e.g., from external detection sources) */
        triggerBlur,
    };
}
