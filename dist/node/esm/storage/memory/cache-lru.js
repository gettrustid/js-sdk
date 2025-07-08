import QuickLRU from 'quick-lru';
export function createInMemoryCache(params) {
    const cache = new QuickLRU({ maxSize: params.maxSize, maxAge: params.ttl });
    return {
        get: async (key) => {
            return cache.get(key);
        },
        set: async (key, value, ttl) => {
            cache.set(key, value, { maxAge: ttl ?? params.ttl });
        },
        clear: async () => {
            cache.clear();
        },
        delete: async (key) => {
            cache.delete(key);
        }
    };
}
