import { describe, expect, it } from 'vitest';
import { shouldRetryProgressStream } from './progressApi';

describe('shouldRetryProgressStream', () => {
  it('does not reconnect to a serverless runtime that explicitly declines SSE', () => {
    expect(shouldRetryProgressStream(501, 0)).toBe(false);
  });

  it('does not retry authentication failures and bounds transient failures', () => {
    expect(shouldRetryProgressStream(401, 0)).toBe(false);
    expect(shouldRetryProgressStream(500, 2)).toBe(true);
    expect(shouldRetryProgressStream(500, 3)).toBe(false);
  });
});
