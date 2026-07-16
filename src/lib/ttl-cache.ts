type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(raw: string): CacheEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!("expiresAt" in parsed) || !("value" in parsed)) return null;
    if (typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedValue<T>(key: string): T | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  const parsed = safeParse<T>(raw);
  if (!parsed) {
    window.localStorage.removeItem(key);
    return null;
  }

  if (Date.now() > parsed.expiresAt) {
    window.localStorage.removeItem(key);
    return null;
  }

  return parsed.value;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  if (!hasWindow()) return;
  const payload: CacheEnvelope<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage exceptions and fall back to network-only behavior.
  }
}

export function removeCachedValue(key: string) {
  if (!hasWindow()) return;
  window.localStorage.removeItem(key);
}

export function removeCachedValuesByPrefix(prefix: string) {
  if (!hasWindow()) return;

  const keysToDelete: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
