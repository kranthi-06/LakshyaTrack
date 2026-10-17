export type RouteGuardState = 'loading' | 'render' | 'recover' | 'redirect';

export interface RouteGuardStateInput {
    loading: boolean;
    authReady: boolean;
    hasUser: boolean;
    hasToken: boolean;
    waitExpired: boolean;
}

export const SESSION_RESTORE_GRACE_MS = 8000;

export function resolveRouteGuardState(input: RouteGuardStateInput): RouteGuardState {
    if (input.hasUser && !input.loading && input.authReady) {
        return 'render';
    }

    if (input.loading || !input.authReady) {
        return input.waitExpired ? 'recover' : 'loading';
    }

    if (!input.hasUser && input.hasToken) {
        return input.waitExpired ? 'recover' : 'loading';
    }

    return 'redirect';
}
