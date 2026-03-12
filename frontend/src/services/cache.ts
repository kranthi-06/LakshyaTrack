interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

interface CacheOptions {
    ttlMs: number;
    persist?: boolean;
    bypassCache?: boolean;
}

const CACHE_KEY_PREFIX = 'vm-cache:';
const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

function storageKey(key: string) {
    return `${CACHE_KEY_PREFIX}${key}`;
}

function readFromStorage<T>(key: string): CacheEntry<T> | null {
    try {
        const raw = localStorage.getItem(storageKey(key));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (!parsed || typeof parsed.expiresAt !== 'number') return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeToStorage<T>(key: string, entry: CacheEntry<T>) {
    try {
        localStorage.setItem(storageKey(key), JSON.stringify(entry));
    } catch {
        // Ignore quota/storage errors.
    }
}

function isValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
    return !!entry && entry.expiresAt > Date.now();
}

export function invalidateCache(keyOrPrefix: string) {
    for (const key of memoryCache.keys()) {
        if (key.startsWith(keyOrPrefix)) memoryCache.delete(key);
    }

    try {
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(CACHE_KEY_PREFIX)) continue;
            const rawKey = key.slice(CACHE_KEY_PREFIX.length);
            if (rawKey.startsWith(keyOrPrefix)) keysToDelete.push(key);
        }
        keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch {
        // Ignore storage enumeration errors.
    }
}

export async function cachedRequest<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions,
): Promise<T> {
    const { ttlMs, persist = false, bypassCache = false } = options;

    if (!bypassCache) {
        const memoryEntry = (memoryCache.get(key) as CacheEntry<T> | undefined) ?? null;
        if (isValid(memoryEntry)) {
            return memoryEntry.value;
        }

        if (persist) {
            const storageEntry = readFromStorage<T>(key);
            if (isValid(storageEntry)) {
                memoryCache.set(key, storageEntry);
                return storageEntry.value;
            }
        }
    }

    const existingRequest = inflightRequests.get(key) as Promise<T> | undefined;
    if (existingRequest) return existingRequest;

    const request = fetcher()
        .then((value) => {
            const entry: CacheEntry<T> = {
                value,
                expiresAt: Date.now() + ttlMs,
            };
            memoryCache.set(key, entry);
            if (persist) writeToStorage(key, entry);
            return value;
        })
        .finally(() => {
            inflightRequests.delete(key);
        });

    inflightRequests.set(key, request as Promise<unknown>);
    return request;
}
