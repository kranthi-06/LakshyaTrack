import { useEffect, useMemo, useState } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function detectLowPowerDevice(): boolean {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const deviceMemory = nav.deviceMemory;
    const cpuCores = navigator.hardwareConcurrency;

    const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;
    const lowCpu = typeof cpuCores === 'number' && cpuCores <= 4;

    return lowMemory || lowCpu;
}

function getMotionPreference(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePerformanceMode() {
    const [width, setWidth] = useState(() => window.innerWidth);
    const [reducedMotion, setReducedMotion] = useState(() => getMotionPreference());
    const [lowPower] = useState(() => detectLowPowerDevice());

    useEffect(() => {
        let rafId = 0;
        const handleResize = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => setWidth(window.innerWidth));
        };

        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleMotionChange = () => setReducedMotion(mq.matches);

        window.addEventListener('resize', handleResize, { passive: true });
        mq.addEventListener('change', handleMotionChange);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            mq.removeEventListener('change', handleMotionChange);
        };
    }, []);

    return useMemo(() => {
        const isMobile = width < MOBILE_BREAKPOINT;
        const isTabletOrBelow = width < TABLET_BREAKPOINT;
        const liteMode = isTabletOrBelow || reducedMotion || lowPower;

        return {
            isMobile,
            isTabletOrBelow,
            reducedMotion,
            lowPower,
            liteMode,
        };
    }, [width, reducedMotion, lowPower]);
}

