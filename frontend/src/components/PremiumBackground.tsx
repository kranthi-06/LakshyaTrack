import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Container, Engine, ISourceOptions } from 'tsparticles-engine';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

const Particles = lazy(async () => {
    const mod = await import('react-tsparticles');
    return { default: mod.default };
});

export const PremiumBackground = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);
    const [pageVisible, setPageVisible] = useState(!document.hidden);
    const { liteMode, isMobile } = usePerformanceMode();
    const particleId = useId().replace(/[:]/g, '');

    useEffect(() => {
        const target = containerRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInView(!!entry?.isIntersecting);
            },
            { rootMargin: '200px 0px' },
        );
        observer.observe(target);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onVisibilityChange = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    const particlesInit = useCallback(async (engine: Engine) => {
        const { loadSlim } = await import('tsparticles-slim');
        await loadSlim(engine);
    }, []);

    const particlesLoaded = useCallback(async (_container: Container | undefined) => {
        // no-op
    }, []);

    const particleOptions = useMemo<ISourceOptions>(() => {
        const isSmall = isMobile || liteMode;
        const particleCount = isSmall ? 20 : 68;

        return {
            background: { color: { value: 'transparent' } },
            fullScreen: { enable: false },
            fpsLimit: isSmall ? 30 : 60,
            pauseOnBlur: true,
            pauseOnOutsideViewport: true,
            interactivity: {
                events: {
                    onClick: { enable: !isSmall, mode: 'push' },
                    onHover: { enable: !isSmall, mode: 'repulse' },
                    resize: true,
                },
                modes: {
                    push: { quantity: 2 },
                    repulse: { distance: 130, duration: 0.3 },
                },
            },
            particles: {
                color: { value: '#ffffff' },
                links: {
                    color: '#ffffff',
                    distance: isSmall ? 110 : 150,
                    enable: true,
                    opacity: isSmall ? 0.12 : 0.2,
                    width: 1,
                },
                move: {
                    direction: 'none',
                    enable: true,
                    outModes: { default: 'bounce' },
                    random: false,
                    speed: isSmall ? 0.5 : 1,
                    straight: false,
                },
                number: {
                    density: { enable: true, area: isSmall ? 1400 : 1200 },
                    value: particleCount,
                },
                opacity: { value: isSmall ? 0.2 : 0.3 },
                shape: { type: 'circle' },
                size: { value: { min: 1, max: isSmall ? 3 : 5 } },
            },
            detectRetina: !isSmall,
        };
    }, [isMobile, liteMode]);

    const renderParticles = isInView && pageVisible && !liteMode;

    return (
        <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {renderParticles && (
                <Suspense fallback={null}>
                    <Particles
                        id={`tsparticles-${particleId}`}
                        init={particlesInit}
                        loaded={particlesLoaded}
                        options={particleOptions}
                    />
                </Suspense>
            )}

            {/* Decorative overlays retained for visual parity */}
            <div className="absolute top-[10%] left-[10%] w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float pointer-events-none hidden md:block" />
            <div className="absolute top-[60%] right-[15%] w-40 h-40 bg-white/10 rounded-2xl rotate-45 blur-2xl animate-float-delayed pointer-events-none hidden md:block" />
            <div
                className="absolute bottom-[10%] left-[20%] w-24 h-24 bg-white/10 blur-2xl animate-float-slow pointer-events-none hidden md:block"
                style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
            />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse hidden md:block" />
            <div
                className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -ml-64 -mb-64 animate-pulse hidden md:block"
                style={{ animationDelay: '2s' }}
            />
        </div>
    );
};

