import { describe, expect, it } from 'vitest';
import { buildDeduplicationKey, isIdempotentRequestMethod } from './api';

describe('API retry policy', () => {
    it('retries only idempotent HTTP methods', () => {
        expect(isIdempotentRequestMethod('get')).toBe(true);
        expect(isIdempotentRequestMethod('HEAD')).toBe(true);
        expect(isIdempotentRequestMethod('put')).toBe(true);
        expect(isIdempotentRequestMethod('delete')).toBe(true);
        expect(isIdempotentRequestMethod('post')).toBe(false);
        expect(isIdempotentRequestMethod('patch')).toBe(false);
    });

    it('scopes GET deduplication by authentication token', () => {
        const config = {
            method: 'get',
            baseURL: '/api/v1',
            url: '/users/me',
        };

        const tokenA = buildDeduplicationKey(config, 'token-user-a');
        const tokenB = buildDeduplicationKey(config, 'token-user-b');
        const anonymous = buildDeduplicationKey(config, null);

        expect(tokenA).not.toBe(tokenB);
        expect(tokenA).not.toBe(anonymous);
    });

    it('does not deduplicate mutations', () => {
        expect(buildDeduplicationKey({
            method: 'post',
            baseURL: '/api/v1',
            url: '/exam/events',
        }, 'token-user-a')).toBeNull();
    });
});
