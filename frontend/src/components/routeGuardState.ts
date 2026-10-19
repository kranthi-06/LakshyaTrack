export type RouteGuardState = 'loading' | 'render' | 'recover' | 'redirect';

export interface RouteGuardStateInput {
    loading: boolean;
    authReady: boolean;
    /** The backend did not confirm the account for the browser's token. */
    authUnavailable: boolean;
    hasUser: boolean;
    hasToken: boolean;
    waitExpired: boolean;
}

export const SESSION_RESTORE_GRACE_MS = 8000;

export function resolveRouteGuardState(input: RouteGuardStateInput): RouteGuardState {
    // A browser-cached profile is not proof of a valid backend session.  Make
    // this decision before `hasUser` so the protected route cannot render it.
    if (input.authUnavailable) {
        return 'recover';
    }

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
