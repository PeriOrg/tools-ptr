import { getCachedValue, setCachedValue } from "./ttl-cache";

export type PartyMetadata = {
  id: number;
  name: string | null;
  abbreviation: string | null;
  color: string | null;
  logoUrl: string | null;
  seatCount: number | null;
  nationId: number | null;
  nationName: string | null;
};

const PARTY_METADATA_CACHE_KEY = "ptr.cache.party-metadata.v1";
const PARTY_METADATA_TTL_MS = 24 * 60 * 60 * 1000;
type PartyMetadataCacheMap = Record<number, PartyMetadata>;

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePartyMetadata(party: any, id: number): PartyMetadata {
  return {
    id,
    name: cleanString(party?.name),
    abbreviation: cleanString(party?.abbreviation),
    color: cleanString(party?.color),
    logoUrl: cleanString(party?.logo_url),
    seatCount: asNumber(party?.seat_count),
    nationId: asNumber(party?.nation_id),
    nationName: cleanString(party?.nation_name) ?? cleanString(party?.nation?.name),
  };
}

export async function getPartyMetadata(id: number): Promise<PartyMetadata | null> {
  const cache = getCachedValue<PartyMetadataCacheMap>(PARTY_METADATA_CACHE_KEY) ?? {};
  if (cache[id]) return cache[id];

  try {
    const response = await fetch(`/api/ptr/parties/${id}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const metadata = normalizePartyMetadata(payload, id);
    const nextCache: PartyMetadataCacheMap = {
      ...cache,
      [id]: metadata,
    };
    setCachedValue(PARTY_METADATA_CACHE_KEY, nextCache, PARTY_METADATA_TTL_MS);
    return metadata;
  } catch {
    return null;
  }
}
