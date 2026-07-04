import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { usePtrAuth } from "../lib/ptr-auth";

export const Route = createFileRoute("/members")({
  component: MembersPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-destructive">Something went wrong: {error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-3 rounded-md border border-input px-3 py-1.5 text-xs"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-[88rem] px-4 py-6 text-sm text-muted-foreground sm:px-6 sm:py-8">Not found.</div>
  ),
});

type MyParty = {
  id: number;
  name: string;
  abbreviation: string;
  color: string | null;
  logo_url: string | null;
  seat_count?: number;
  nation_id?: number;
};
type Position = {
  id: number;
  title: string;
  display_order: number;
  current_holder: { political_figure_id: number; name: string } | null;
};
type Figure = {
  id: number;
  name?: string;
  full_name?: string;
  charisma?: number;
  experience?: number;
  image_url?: string | null;
  wiki_url?: string | null;
  created_at_game_month?: number | string;
  gender?: string;
  is_active?: boolean;
  party_id?: number;
};

type FigureStats = {
  charisma?: number;
  experience?: number;
  image_url?: string | null;
  wiki_url?: string | null;
};

type MinisterAssignment = {
  political_figure_id?: number;
  ministry_name?: string;
  effective_minister_name?: string;
  minister_name?: string;
};

type FutureRolePill = {
  label: string;
  hover: string;
};

type MemberSortKey = "name" | "role" | "charisma" | "experience" | "joinDate";
type MemberSortConfig = {
  key: MemberSortKey;
  direction: "asc" | "desc";
};

const CHARISMA_BAND_UPPER_BOUNDS = [-0.8416, -0.2533, 0.2533, 0.8416] as const;
const CHARISMA_BAND_COLORS = [
  "bg-rose-600",
  "bg-orange-500",
  "bg-amber-400",
  "bg-lime-500",
  "bg-emerald-600",
] as const;
const CHARISMA_BAND_LABELS = [
  "Offputting",
  "Awkward",
  "Plain",
  "Persuasive",
  "Compelling",
] as const;
const EXPERIENCE_TIER_MINIMUMS = [0, 3, 6, 9, 15] as const;
const EXPERIENCE_TIER_LABELS = [
  "Newcomer",
  "Emerging",
  "Established",
  "Veteran",
  "Statesperson",
] as const;
const EXPERIENCE_TIER_COLORS = [
  "bg-amber-500",
  "bg-amber-500",
  "bg-amber-500",
  "bg-amber-500",
  "bg-amber-500",
] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function charismaBandIndex(value: number) {
  for (let i = 0; i < CHARISMA_BAND_UPPER_BOUNDS.length; i += 1) {
    if (value <= CHARISMA_BAND_UPPER_BOUNDS[i]) return i;
  }
  return CHARISMA_BAND_UPPER_BOUNDS.length;
}

function charismaBandLabel(value: number) {
  return CHARISMA_BAND_LABELS[charismaBandIndex(value)];
}

function experienceTierIndex(value: number) {
  for (let i = EXPERIENCE_TIER_MINIMUMS.length - 1; i >= 0; i -= 1) {
    if (value >= EXPERIENCE_TIER_MINIMUMS[i]) return i;
  }
  return 0;
}

function experienceTierLabel(value: number) {
  return EXPERIENCE_TIER_LABELS[experienceTierIndex(value)];
}

function parseYearMonth(value: number | string | null | undefined) {
  if (value == null) return null;

  if (typeof value === "number") {
    const yyyymm = String(Math.trunc(value));
    if (/^\d{6}$/.test(yyyymm)) {
      const year = Number(yyyymm.slice(0, 4));
      const month = Number(yyyymm.slice(4, 6));
      if (month >= 1 && month <= 12) return { year, month };
    }
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dashMatch = /^(\d{4})[-/](\d{1,2})$/.exec(trimmed);
  if (dashMatch) {
    const year = Number(dashMatch[1]);
    const month = Number(dashMatch[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const monthYearMatch = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(trimmed);
  if (monthYearMatch) {
    const month = MONTH_NAME_TO_INDEX[monthYearMatch[1].toLowerCase()];
    const year = Number(monthYearMatch[2]);
    if (month) return { year, month };
  }

  const yearMonthMatch = /^(\d{4})\s+([A-Za-z]{3,9})$/.exec(trimmed);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = MONTH_NAME_TO_INDEX[yearMonthMatch[2].toLowerCase()];
    if (month) return { year, month };
  }

  return null;
}

function formatJoinDate(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const parsed = parseYearMonth(value);
  if (!parsed) return String(value);
  return `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
}

function joinDateSortValue(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = parseYearMonth(value);
  if (parsed) return parsed.year * 12 + parsed.month;
  if (typeof value === "number") return value;
  const numericText = Number(value);
  if (Number.isFinite(numericText)) return numericText;
  return null;
}

function compareNullableNumbers(a: number | null, b: number | null, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function compareText(a: string, b: string, direction: "asc" | "desc") {
  const base = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? base : -base;
}

function colorLuma(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function borderForColor(hex: string) {
  return colorLuma(hex) > 0.92 ? "#cbd5e1" : "transparent";
}

function roleBorderForColor(hex: string) {
  return colorLuma(hex) > 0.85 ? "#94a3b8" : "rgba(15, 23, 42, 0.35)";
}

function textForColor(hex: string) {
  return colorLuma(hex) > 0.6 ? "#111827" : "#ffffff";
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

function normalizeFutureRole(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();

  if (!trimmed) return "";
  if (lower.startsWith("party secretary") || lower.startsWith("party nominee")) {
    return trimmed;
  }

  const deputyMinisterOfMatch = /^(vice|deputy)\s+minister\s+of\s+(.+)$/i.exec(trimmed);
  if (deputyMinisterOfMatch) {
    return `Deputy Party Secretary of ${deputyMinisterOfMatch[2]}`;
  }

  const ministerOfMatch = /^minister\s+of\s+(.+)$/i.exec(trimmed);
  if (ministerOfMatch) {
    return `Party Secretary of ${ministerOfMatch[1]}`;
  }

  const headOfficeAliases: Record<string, string> = {
    "prime minister": "Prime Minister",
    president: "President",
    chancellor: "Chancellor",
    premier: "Premier",
    toshiagh: "Toshiagh",
    taoiseach: "Taoiseach",
  };

  if (headOfficeAliases[lower]) {
    return `Party nominee for ${headOfficeAliases[lower]}`;
  }

  if (/^(vice|deputy)\s+(president|prime minister|chancellor|premier)$/i.test(trimmed)) {
    return `Party nominee for ${trimmed}`;
  }

  return `Party nominee for ${trimmed}`;
}

function nomineeHoverText(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/^party nominee for\s+/i.test(trimmed)) return trimmed;
  return `Party nominee for ${trimmed}`;
}

function PositionHallCard({
  holderName,
  positionTitle,
  portraitUrl,
  partyLogoUrl,
}: {
  holderName: string;
  positionTitle: string;
  portraitUrl: string | null;
  partyLogoUrl: string | null;
}) {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(portraitUrl ?? partyLogoUrl);

  useEffect(() => {
    setCurrentImageUrl(portraitUrl ?? partyLogoUrl);
  }, [portraitUrl, partyLogoUrl]);

  const onImageError = useCallback(() => {
    setCurrentImageUrl((prev) => {
      if (prev !== partyLogoUrl && partyLogoUrl) return partyLogoUrl;
      return null;
    });
  }, [partyLogoUrl]);

  return (
    <article className="text-center">
      <div
        className={`mx-auto h-32 w-32 overflow-hidden rounded-xl border border-border/70 ${currentImageUrl ? "bg-muted" : "bg-muted/20"}`}
        title={positionTitle}
      >
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="h-full w-full bg-muted/30" />
        )}
      </div>
      <div className="mt-2 space-y-1 px-1">
        <div className="text-sm font-medium leading-tight text-center">{holderName}</div>
        <div className="text-xs leading-tight text-muted-foreground text-center">{positionTitle}</div>
      </div>
    </article>
  );
}

function MembersPage() {
  const { session, authFetch } = usePtrAuth();

  const [myParties, setMyParties] = useState<MyParty[] | null>(null);
  const [myPartiesErr, setMyPartiesErr] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<number | null>(null);

  const [positions, setPositions] = useState<Position[] | null>(null);
  const [figures, setFigures] = useState<Figure[] | null>(null);
  const [figureStatsById, setFigureStatsById] = useState<Record<number, FigureStats>>({});
  const [futureRolesByFigureId, setFutureRolesByFigureId] = useState<Record<number, FutureRolePill[]>>({});
  const [figuresErr, setFiguresErr] = useState<string | null>(null);
  const [loadingFigures, setLoadingFigures] = useState(false);
  const [memberSort, setMemberSort] = useState<MemberSortConfig | null>(null);

  // Fetch the signed-in user's party(ies)
  useEffect(() => {
    if (!session) {
      setMyParties(null);
      setMyPartiesErr(null);
      setPartyId(null);
      return;
    }
    setMyPartiesErr(null);
    setMyParties(null);
    (async () => {
      try {
        const r = await authFetch("/api/ptr/players/me/parties");
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "Session expired. Please sign in again."
              : `Failed to load your party (${r.status})`,
          );
        }
        const data = await r.json();
        const raw: any[] = Array.isArray(data) ? data : data?.parties ?? [];
        // Normalize: endpoint returns { party_id, party_name, nation_id, role, ... }
        const normalized: MyParty[] = raw.map((p) => ({
          id: p.id ?? p.party_id,
          name: p.name ?? p.party_name ?? "",
          abbreviation: p.abbreviation ?? "",
          color: p.color ?? null,
          logo_url: p.logo_url ?? null,
          seat_count: p.seat_count,
          nation_id: p.nation_id,
        }));
        // Enrich missing fields (abbreviation/color/logo) from /parties/{id}
        const enriched = await Promise.all(
          normalized.map(async (p) => {
            if (p.abbreviation && p.color) return p;
            try {
              const d = await fetch(`/api/ptr/parties/${p.id}`);
              if (!d.ok) return p;
              const j = await d.json();
              return {
                ...p,
                name: p.name || j.name,
                abbreviation: p.abbreviation || j.abbreviation || "",
                color: p.color || j.color || null,
                logo_url: p.logo_url || j.logo_url || null,
                seat_count: p.seat_count ?? j.seat_count,
                nation_id: p.nation_id ?? j.nation_id,
              } as MyParty;
            } catch {
              return p;
            }
          }),
        );
        setMyParties(enriched);
        setPartyId(enriched[0]?.id ?? null);
      } catch (e) {
        setMyPartiesErr((e as Error).message);
      }
    })();
  }, [session, authFetch]);

  const loadPartyDetail = useCallback(
    async (id: number, nationId: number | null) => {
      setPositions(null);
      setFigures(null);
      setFigureStatsById({});
      setFutureRolesByFigureId({});
      setFiguresErr(null);
      try {
        const r = await fetch(`/api/ptr/parties/${id}/positions`);
        if (r.ok) setPositions(await r.json());
        else setPositions([]);
      } catch {
        setPositions([]);
      }
      setLoadingFigures(true);
      try {
        const r = await authFetch(`/api/ptr/parties/${id}/political-figures`);
        if (!r.ok) {
          const text = await r.text();
          throw new Error(
            r.status === 401
              ? "Session expired. Please sign in again."
              : `Failed (${r.status}) ${text.slice(0, 120)}`,
          );
        }
        const data = (await r.json()) as Figure[];
        setFigures(data);
        setLoadingFigures(false);

        try {
          const mr = await authFetch(`/api/ptr/parties/${id}/minister-names`);
          if (mr.ok) {
            const payload = await mr.json();
            const rawAssignments: MinisterAssignment[] = Array.isArray(payload)
              ? payload
              : payload?.assignments ?? payload?.minister_names ?? [];

            const figureIdByName = new Map<string, number>();
            data.forEach((f) => {
              const candidateNames = [f.name, f.full_name]
                .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
                .map((n) => n.trim().toLowerCase());
              candidateNames.forEach((n) => figureIdByName.set(n, f.id));
            });

            const roleMap = new Map<number, Map<string, FutureRolePill>>();
            rawAssignments.forEach((a) => {
              const politicianNameKey = (a.effective_minister_name ?? "").trim().toLowerCase();
              const figureId =
                typeof a.political_figure_id === "number"
                  ? a.political_figure_id
                  : figureIdByName.get(politicianNameKey);
              const sourceRole = (a.ministry_name ?? a.minister_name ?? "").trim();
              const roleLabel = normalizeFutureRole(sourceRole);
              const hover = nomineeHoverText(sourceRole);
              if (typeof figureId !== "number" || !roleLabel || !hover) return;
              if (!roleMap.has(figureId)) roleMap.set(figureId, new Map<string, FutureRolePill>());
              roleMap.get(figureId)?.set(`${roleLabel}|${hover}`, { label: roleLabel, hover });
            });

            setFutureRolesByFigureId(
              Object.fromEntries(
                Array.from(roleMap.entries()).map(([figureId, labels]) => [figureId, Array.from(labels.values())]),
              ),
            );
          }
        } catch {
          // Keep the members table functional if minister-name fetch fails.
        }

        if (nationId != null) {
          // Enrich rows progressively so the table is visible immediately.
          void Promise.allSettled(
            data.map(async (f) => {
              try {
                const detailRes = await authFetch(
                  `/api/ptr/nations/${nationId}/political-figures/${f.id}`,
                );
                if (!detailRes.ok) return;
                const detail = (await detailRes.json()) as Figure;
                setFigureStatsById((prev) => {
                  const existing = prev[f.id] ?? {};
                  return {
                    ...prev,
                    [f.id]: {
                      ...existing,
                      charisma: detail.charisma ?? existing.charisma,
                      experience: detail.experience ?? existing.experience,
                      image_url: detail.image_url ?? existing.image_url,
                      wiki_url: detail.wiki_url ?? existing.wiki_url,
                    },
                  };
                });
              } catch {
                // Keep enrichment best-effort and non-blocking.
              }
            }),
          );
        }
      } catch (e) {
        setFiguresErr((e as Error).message);
      } finally {
        setLoadingFigures(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (partyId != null) {
      const nationId = myParties?.find((p) => p.id === partyId)?.nation_id ?? null;
      void loadPartyDetail(partyId, nationId);
    }
  }, [partyId, myParties, loadPartyDetail]);

  const selectedParty = useMemo(
    () => myParties?.find((p) => p.id === partyId) ?? null,
    [myParties, partyId],
  );

  const positionHolderIds = useMemo(() => {
    const m = new Map<number, string>();
    positions?.forEach((p) => {
      if (p.current_holder) m.set(p.current_holder.political_figure_id, p.title);
    });
    return m;
  }, [positions]);

  const baseFigures = useMemo(() => {
    if (!figures) return null;
    return [...figures].sort((a, b) => {
      const ah = positionHolderIds.has(a.id) ? 0 : 1;
      const bh = positionHolderIds.has(b.id) ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return (a.name ?? a.full_name ?? "").localeCompare(b.name ?? b.full_name ?? "");
    });
  }, [figures, positionHolderIds]);

  const sortedFigures = useMemo(() => {
    if (!baseFigures) return null;
    if (!memberSort) return baseFigures;
    const rows = [...baseFigures];

    rows.sort((a, b) => {
      const aName = a.name ?? a.full_name ?? `Figure #${a.id}`;
      const bName = b.name ?? b.full_name ?? `Figure #${b.id}`;

      const aStats = figureStatsById[a.id];
      const bStats = figureStatsById[b.id];

      const aRole =
        positionHolderIds.get(a.id) ?? futureRolesByFigureId[a.id]?.[0]?.label ?? "Member";
      const bRole =
        positionHolderIds.get(b.id) ?? futureRolesByFigureId[b.id]?.[0]?.label ?? "Member";

      const aCharisma = aStats?.charisma ?? a.charisma ?? null;
      const bCharisma = bStats?.charisma ?? b.charisma ?? null;
      const aExperience = aStats?.experience ?? a.experience ?? null;
      const bExperience = bStats?.experience ?? b.experience ?? null;

      const aJoinSort = joinDateSortValue(a.created_at_game_month);
      const bJoinSort = joinDateSortValue(b.created_at_game_month);

      if (memberSort.key === "name") {
        return compareText(aName, bName, memberSort.direction);
      }
      if (memberSort.key === "role") {
        const byRole = compareText(aRole, bRole, memberSort.direction);
        return byRole !== 0 ? byRole : compareText(aName, bName, "asc");
      }
      if (memberSort.key === "charisma") {
        const byCharisma = compareNullableNumbers(aCharisma, bCharisma, memberSort.direction);
        return byCharisma !== 0 ? byCharisma : compareText(aName, bName, "asc");
      }
      if (memberSort.key === "experience") {
        const byExperience = compareNullableNumbers(aExperience, bExperience, memberSort.direction);
        return byExperience !== 0 ? byExperience : compareText(aName, bName, "asc");
      }

      const byJoinDate = compareNullableNumbers(aJoinSort, bJoinSort, memberSort.direction);
      return byJoinDate !== 0 ? byJoinDate : compareText(aName, bName, "asc");
    });

    return rows;
  }, [baseFigures, figureStatsById, futureRolesByFigureId, memberSort, positionHolderIds]);

  const figuresById = useMemo(() => {
    const m = new Map<number, Figure>();
    figures?.forEach((f) => m.set(f.id, f));
    return m;
  }, [figures]);

  const partyLogoFallbackUrl = useMemo(
    () => safeHttpUrl(selectedParty?.logo_url),
    [selectedParty?.logo_url],
  );

  const onSortColumn = useCallback((key: MemberSortKey) => {
    setMemberSort((prev) => {
      if (!prev) return { key, direction: "asc" };
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sortIndicator = useCallback(
    (key: MemberSortKey) => {
      if (!memberSort || memberSort.key !== key) return "";
      return memberSort.direction === "asc" ? "^" : "v";
    },
    [memberSort],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[88rem] px-4 py-6 space-y-6 sm:px-6 sm:py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Internal positions and political figures for your party.
          </p>
        </header>

        {!session ? (
          <EmptyState
            message="Sign in (top-right) to access Members and load your party's members."
            tone="error"
          />
        ) : myPartiesErr ? (
          <div className="text-sm text-destructive">{myPartiesErr}</div>
        ) : !myParties ? (
          <div className="text-sm text-muted-foreground">Loading your party…</div>
        ) : myParties.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Your account isn't linked to any party.
          </div>
        ) : (
          <>
            {myParties.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Party
                </label>
                <select
                  className="w-full md:w-96 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={partyId ?? ""}
                  onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
                >
                  {myParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.abbreviation} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedParty && (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <PartyLogo party={selectedParty} />
                  <div>
                    <div className="text-sm font-semibold">{selectedParty.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedParty.abbreviation}
                      {typeof selectedParty.seat_count === "number"
                        ? ` · ${selectedParty.seat_count} seats`
                        : ""}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-tight">Party positions</h2>
              {!positions ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : positions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No party positions defined.</div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-4">
                  {positions.some((p) => p.current_holder) ? (
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                      {positions
                        .filter((p) => p.current_holder)
                        .map((p) => {
                          const holderId = p.current_holder?.political_figure_id;
                          const figure =
                            typeof holderId === "number" ? figuresById.get(holderId) : undefined;
                          const stats =
                            typeof holderId === "number" ? figureStatsById[holderId] : undefined;
                          const imageUrl = safeHttpUrl(stats?.image_url ?? figure?.image_url);

                          return (
                            <PositionHallCard
                              key={p.id}
                              holderName={p.current_holder?.name ?? "Unknown member"}
                              positionTitle={p.title}
                              portraitUrl={imageUrl}
                              partyLogoUrl={partyLogoFallbackUrl}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No party positions are currently assigned.</div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-tight">Members</h2>
              {loadingFigures ? (
                <div className="text-sm text-muted-foreground">Loading members…</div>
              ) : figuresErr ? (
                <div className="text-sm text-destructive">{figuresErr}</div>
              ) : !sortedFigures || sortedFigures.length === 0 ? (
                <div className="text-sm text-muted-foreground">No members found.</div>
              ) : (
                <>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => onSortColumn("name")}
                            >
                              Name
                              <span className="text-[10px]">{sortIndicator("name")}</span>
                            </button>
                          </th>
                          <th className="text-left px-3 py-2 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => onSortColumn("role")}
                            >
                              Role
                              <span className="text-[10px]">{sortIndicator("role")}</span>
                            </button>
                          </th>
                          <th className="text-left px-3 py-2 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => onSortColumn("charisma")}
                            >
                              Charisma
                              <span className="text-[10px]">{sortIndicator("charisma")}</span>
                            </button>
                          </th>
                          <th className="text-left px-3 py-2 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => onSortColumn("experience")}
                            >
                              Experience
                              <span className="text-[10px]">{sortIndicator("experience")}</span>
                            </button>
                          </th>
                          <th className="text-right px-3 py-2 font-medium">
                            <button
                              type="button"
                              className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => onSortColumn("joinDate")}
                            >
                              Join date
                              <span className="text-[10px]">{sortIndicator("joinDate")}</span>
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFigures.map((f) => {
                          const name = f.name ?? f.full_name ?? `Figure #${f.id}`;
                          const role = positionHolderIds.get(f.id);
                          const futureRoles = futureRolesByFigureId[f.id] ?? [];
                          const stats = figureStatsById[f.id];
                          const imageUrl = safeHttpUrl(stats?.image_url ?? f.image_url);
                          const wikiHref = safeHttpUrl(stats?.wiki_url ?? f.wiki_url);
                          const charisma = stats?.charisma ?? f.charisma;
                          const experience = stats?.experience ?? f.experience;
                          const charismaBand =
                            typeof charisma === "number" ? charismaBandIndex(charisma) : null;
                          const charismaLabel =
                            typeof charisma === "number" ? charismaBandLabel(charisma) : null;
                          const experienceTier =
                            typeof experience === "number" ? experienceTierIndex(experience) : null;
                          const experienceLabel =
                            typeof experience === "number" ? experienceTierLabel(experience) : null;
                          return (
                            <tr
                              key={f.id}
                              className={`border-t border-border ${wikiHref ? "cursor-pointer hover:bg-muted/30" : "cursor-default"}`}
                              onClick={
                                wikiHref
                                  ? () => {
                                      window.open(wikiHref, "_blank", "noopener,noreferrer");
                                    }
                                  : undefined
                              }
                            >
                              <td className="px-3 py-2 font-medium">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-7 w-7 shrink-0 overflow-hidden rounded-full ${imageUrl ? "bg-muted" : "bg-transparent"}`}
                                  >
                                    {imageUrl ? (
                                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full rounded-full border border-border/40 bg-muted/20" />
                                    )}
                                  </div>
                                  <span>{name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {role || futureRoles.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {role && (
                                      <span
                                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                                        style={{
                                          background: selectedParty?.color ?? "#6b7280",
                                          color: textForColor(selectedParty?.color ?? "#6b7280"),
                                          borderColor:
                                            selectedParty?.color
                                              ? roleBorderForColor(selectedParty.color)
                                              : "#374151",
                                        }}
                                      >
                                        {role}
                                      </span>
                                    )}
                                    {futureRoles.map((futureRole) => (
                                      <span
                                        key={`${f.id}-${futureRole.label}-${futureRole.hover}`}
                                        className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                        title={futureRole.hover}
                                      >
                                        {futureRole.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Member</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {charismaBand == null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex items-center gap-2" title={charismaLabel ?? undefined}>
                                    <div className="h-2.5 w-32 overflow-hidden rounded-full border border-border/60 bg-muted/50">
                                      <div className="flex h-full w-full">
                                        {CHARISMA_BAND_COLORS.map((colorClass, index) => (
                                          <div
                                            key={`${f.id}-charisma-band-${index}`}
                                            className={`h-full flex-1 ${colorClass} ${index === charismaBand ? "opacity-100" : "opacity-15 grayscale"} ${index > 0 ? "border-l border-black/15" : ""}`}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {experienceTier == null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div
                                    className="flex items-center gap-2"
                                    title={`${experience} · ${experienceLabel}`}
                                  >
                                    <div className="h-2.5 w-32 overflow-hidden rounded-full border border-border/60 bg-muted/50">
                                      <div className="flex h-full w-full">
                                        {EXPERIENCE_TIER_COLORS.map((colorClass, index) => (
                                          <div
                                            key={`${f.id}-experience-tier-${index}`}
                                            className={`h-full flex-1 ${colorClass} ${index === experienceTier ? "opacity-100" : "opacity-15"} ${index > 0 ? "border-l border-black/15" : ""}`}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatJoinDate(f.created_at_game_month)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-1 text-xs text-muted-foreground">
                    Click any column header to sort this table.
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function PartyLogo({ party }: { party: MyParty }) {
  const color = party.color || "#999999";
  return (
    <div
      className="h-10 w-10 rounded-md p-1 flex items-center justify-center shrink-0"
      style={{ background: color, border: `1.5px solid ${borderForColor(color)}` }}
    >
      {party.logo_url ? (
        <img src={party.logo_url} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-[10px] font-bold text-white mix-blend-difference">
          {party.abbreviation.slice(0, 3)}
        </span>
      )}
    </div>
  );
}
