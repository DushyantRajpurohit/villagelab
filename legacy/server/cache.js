/** Tiny in-memory TTL cache. The Supercell API is rate limited, so every
 *  successful response is held briefly and served to repeat callers. */
export class TTLCache {
  constructor(defaultTtlMs = 60_000, maxEntries = 500) {
    this.map = new Map();
    this.ttl = defaultTtlMs;
    this.max = maxEntries;
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value, ttlMs = this.ttl) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }

  get size() { return this.map.size; }
  clear() { this.map.clear(); }
}
