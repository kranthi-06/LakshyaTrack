export const LOADING_JOURNEY = [
    'LEARN',
    'STUDY',
    'PRACTICE',
    'TRAIN',
    'UPSKILL',
    'BUILD YOUR RESUME',
    'PREPARE FOR INTERVIEWS',
    'EXPLORE OPPORTUNITIES',
] as const;

let sessionStartedAt: number | null = null;
let lastUnmountedAt: number | null = null;
let activeLoaders = 0;

export function computeLoadingProgress(elapsedMs: number): number {
    const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
    return Math.min(95, Math.round(8 + (elapsed / 20_000) * 87));
}

export function getLoadingJourneyStep(progress: number): number {
    const boundedProgress = Math.min(100, Math.max(0, progress));
    return Math.min(
        LOADING_JOURNEY.length - 1,
        Math.floor((boundedProgress / 100) * LOADING_JOURNEY.length),
    );
}

export function acquireLoadingSession(now = Date.now()): {
    startedAt: number;
    animateEntrance: boolean;
} {
    const newSession =
        activeLoaders === 0 &&
        (sessionStartedAt === null ||
            (lastUnmountedAt !== null && now - lastUnmountedAt > 1000));

    if (newSession) {
        sessionStartedAt = now;
    }

    activeLoaders += 1;
    lastUnmountedAt = null;
    return { startedAt: sessionStartedAt ?? now, animateEntrance: newSession };
}

export function releaseLoadingSession(now = Date.now()): void {
    activeLoaders = Math.max(0, activeLoaders - 1);
    if (activeLoaders === 0) {
        lastUnmountedAt = now;
    }
}
