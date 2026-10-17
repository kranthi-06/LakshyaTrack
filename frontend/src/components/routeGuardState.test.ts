import { describe, expect, it } from 'vitest';
import { resolveRouteGuardState, type RouteGuardStateInput } from './routeGuardState';

const resolvedState: RouteGuardStateInput = {
    loading: false,
    authReady: true,
    hasUser: false,
    hasToken: false,
    waitExpired: false,
};

describe('resolveRouteGuardState', () => {
    it('continues waiting when a user exists but auth is still loading', () => {
        expect(resolveRouteGuardState({
            ...resolvedState,
            hasUser: true,
            hasToken: true,
            loading: true,
        })).toBe('loading');
        expect(resolveRouteGuardState({
            ...resolvedState,
            hasUser: true,
            hasToken: true,
            loading: true,
            waitExpired: true,
        })).toBe('recover');
    });

    it.each([
        { loading: true, authReady: true },
        { loading: false, authReady: false },
    ])('waits while authentication is unresolved: $loading/$authReady', (authState) => {
        expect(resolveRouteGuardState({
            ...resolvedState,
            ...authState,
        })).toBe('loading');
        expect(resolveRouteGuardState({
            ...resolvedState,
            ...authState,
            waitExpired: true,
        })).toBe('recover');
    });

    it('waits for a user when a token exists, then offers recovery after expiry', () => {
        const input = { ...resolvedState, hasToken: true };
        expect(resolveRouteGuardState(input)).toBe('loading');
        expect(resolveRouteGuardState({ ...input, waitExpired: true })).toBe('recover');
    });

    it('renders when a user arrives after the wait expires', () => {
        expect(resolveRouteGuardState({
            ...resolvedState,
            hasUser: true,
            hasToken: true,
            waitExpired: true,
        })).toBe('render');
    });

    it('redirects when auth is resolved and neither user nor token exists', () => {
        expect(resolveRouteGuardState(resolvedState)).toBe('redirect');
    });
});
