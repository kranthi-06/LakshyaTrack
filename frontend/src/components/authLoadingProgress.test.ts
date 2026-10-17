import { describe, expect, it } from 'vitest';
import {
    computeLoadingProgress,
    getLoadingJourneyStep,
    LOADING_JOURNEY,
} from './authLoadingProgress';

describe('auth loading progress', () => {
    it('advances with elapsed time and stays below completion', () => {
        expect(computeLoadingProgress(0)).toBe(8);
        expect(computeLoadingProgress(10_000)).toBeGreaterThan(computeLoadingProgress(1000));
        expect(computeLoadingProgress(60_000)).toBe(95);
    });

    it('maps progress onto the requested journey steps', () => {
        expect(LOADING_JOURNEY).toEqual([
            'LEARN',
            'STUDY',
            'PRACTICE',
            'TRAIN',
            'UPSKILL',
            'BUILD YOUR RESUME',
            'PREPARE FOR INTERVIEWS',
            'EXPLORE OPPORTUNITIES',
        ]);
        expect(getLoadingJourneyStep(0)).toBe(0);
        expect(getLoadingJourneyStep(51)).toBe(4);
        expect(getLoadingJourneyStep(100)).toBe(7);
    });
});
