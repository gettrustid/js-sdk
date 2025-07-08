"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryCache = void 0;
const quick_lru_1 = __importDefault(require("quick-lru"));
function createInMemoryCache(params) {
    const cache = new quick_lru_1.default({ maxSize: params.maxSize, maxAge: params.ttl });
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
exports.createInMemoryCache = createInMemoryCache;
