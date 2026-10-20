import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, healthPayload } = vi.hoisted(() => {
  const healthPayload: { data: Record<string, unknown> } = { data: {} };
  const getMock = vi.fn(async () => healthPayload);
  return { getMock, healthPayload };
});

vi.mock('../../services/api', () => ({
  default: { get: getMock },
}));

// Minimal browser globals: the module reads the auth token from localStorage
// and uses window timers for reconnect backoff.
function installGlobals(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'token' ? 'test-token' : null),
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  healthPayload.data = {};
});

describe('progress stream capability gate', () => {
  it('never opens the socket when the runtime declines streaming', async () => {
    healthPayload.data = { streaming_supported: false };
    const fetchMock = vi.fn(async () => ({ ok: true, body: null, status: 200 }));
    installGlobals(fetchMock);

    const { subscribeToProgressUpdates } = await import('./progressApi');
    const dispose = subscribeToProgressUpdates();
    await flush();

    expect(getMock).toHaveBeenCalledWith('/progress-engine/health');
    expect(fetchMock).not.toHaveBeenCalled();
    dispose();
  });

  it('opens the socket when the runtime supports streaming', async () => {
    healthPayload.data = { streaming_supported: true };
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<{ ok: boolean; body: null; status: number }>>(async () => ({ ok: true, body: null, status: 200 }));
    installGlobals(fetchMock);

    const { subscribeToProgressUpdates } = await import('./progressApi');
    const dispose = subscribeToProgressUpdates();
    await flush();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/progress-engine/stream');
    dispose();
  });

  it('probes the capability once and reuses the answer', async () => {
    healthPayload.data = { streaming_supported: false };
    installGlobals(vi.fn(async () => ({ ok: true, body: null, status: 200 })));

    const { isProgressStreamSupported } = await import('./progressApi');
    await Promise.all([isProgressStreamSupported(), isProgressStreamSupported()]);

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('treats a failed probe as unsupported but allows a later retry', async () => {
    getMock.mockRejectedValueOnce(new Error('network down'));
    installGlobals(vi.fn(async () => ({ ok: true, body: null, status: 200 })));

    const { isProgressStreamSupported } = await import('./progressApi');
    await expect(isProgressStreamSupported()).resolves.toBe(false);

    // A transient probe failure must not latch for the rest of the session.
    healthPayload.data = { streaming_supported: true };
    await expect(isProgressStreamSupported()).resolves.toBe(true);
  });
});
