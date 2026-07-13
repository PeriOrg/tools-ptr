import { getCachedValue, setCachedValue } from "./ttl-cache";

export type Nation = { id: number; name: string };
export type NationWithFlag = Nation & { flagUrl: string | null };

const NATION_FLAGS_CACHE_KEY = "ptr.cache.nation-flags.v1";
const NATION_FLAGS_TTL_MS = 48 * 60 * 60 * 1000;
type NationFlagCacheMap = Record<number, string | null>;

export async function fetchNationFlag(id: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/ptr/nations/${id}/law-states`);
    if (!res.ok) return null;
    const data = await res.json();
    const categories: any[] = Array.isArray(data) ? data : data.categories ?? [];
    for (const cat of categories) {
      const laws: any[] = cat.laws ?? [];
      for (const law of laws) {
        const name = String(law.law_name ?? "").toLowerCase();
        if (!name.includes("national flag")) continue;
        const value = String(law.current_value ?? "").trim();
        if (value.startsWith("http")) return value;
      }
    }
  } catch {}
  return null;
}

export async function fetchNationsWithFlags(): Promise<NationWithFlag[]> {
  const res = await fetch("/api/ptr/nations");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const list: Nation[] = await res.json();

  const cachedFlags = getCachedValue<NationFlagCacheMap>(NATION_FLAGS_CACHE_KEY) ?? {};
  const nextFlags: NationFlagCacheMap = { ...cachedFlags };

  const missingNationIds = list
    .map((nation) => nation.id)
    .filter((id) => !(id in cachedFlags));

  if (missingNationIds.length > 0) {
    const fetchedEntries = await Promise.all(
      missingNationIds.map(async (nationId) => [nationId, await fetchNationFlag(nationId)] as const),
    );
    for (const [nationId, flagUrl] of fetchedEntries) {
      nextFlags[nationId] = flagUrl;
    }
    setCachedValue(NATION_FLAGS_CACHE_KEY, nextFlags, NATION_FLAGS_TTL_MS);
  }

  const enriched = await Promise.all(
    list.map(async (nation) => ({
      ...nation,
      flagUrl: nextFlags[nation.id] ?? null,
    })),
  );

  return enriched.sort((a, b) => a.name.localeCompare(b.name));
}