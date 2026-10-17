import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Deterministic pseudo-random generator (minstd rand) seeded once.
 * Safe to call during render — unlike Math.random it is pure and stable,
 * so it does not trigger the react-hooks/purity rule and never changes
 * across re-renders for the same seed (avoids cascading re-renders).
 */
export function makeStableRandom(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
