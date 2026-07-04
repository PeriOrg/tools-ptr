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
  created_at_game_month?: number;
  gender?: string;
  is_active?: boolean;
  party_id?: number;
};

type FigureStats = {
  charisma?: number;
  experience?: number;
};

function toPercent(value: number, min: number, max: number) {
  if (max <= min) return 100;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
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

function MembersPage() {
  const { session, authFetch } = usePtrAuth();

  const [myParties, setMyParties] = useState<MyParty[] | null>(null);
  const [myPartiesErr, setMyPartiesErr] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<number | null>(null);

  const [positions, setPositions] = useState<Position[] | null>(null);
  const [figures, setFigures] = useState<Figure[] | null>(null);
  const [figureStatsById, setFigureStatsById] = useState<Record<number, FigureStats>>({});
  const [figuresErr, setFiguresErr] = useState<string | null>(null);
  const [loadingFigures, setLoadingFigures] = useState(false);

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

        if (nationId != null) {
          const figuresNeedingStats = data.filter(
            (f) => f.charisma == null || f.experience == null,
          );
          if (figuresNeedingStats.length > 0) {
            const statsEntries = await Promise.all(
              figuresNeedingStats.map(async (f) => {
                try {
                  const detailRes = await authFetch(
                    `/api/ptr/nations/${nationId}/political-figures/${f.id}`,
                  );
                  if (!detailRes.ok) return [f.id, {}] as const;
                  const detail = (await detailRes.json()) as Figure;
                  return [
                    f.id,
                    {
                      charisma: detail.charisma,
                      experience: detail.experience,
                    },
                  ] as const;
                } catch {
                  return [f.id, {}] as const;
                }
              }),
            );
            setFigureStatsById(Object.fromEntries(statsEntries));
          }
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

  const sortedFigures = useMemo(() => {
    if (!figures) return null;
    return [...figures].sort((a, b) => {
      const ah = positionHolderIds.has(a.id) ? 0 : 1;
      const bh = positionHolderIds.has(b.id) ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return (a.name ?? a.full_name ?? "").localeCompare(b.name ?? b.full_name ?? "");
    });
  }, [figures, positionHolderIds]);

  const statRange = useMemo(() => {
    if (!sortedFigures || sortedFigures.length === 0) return null;

    const charismaValues: number[] = [];
    const experienceValues: number[] = [];

    sortedFigures.forEach((f) => {
      const stats = figureStatsById[f.id];
      const charisma = stats?.charisma ?? f.charisma;
      const experience = stats?.experience ?? f.experience;
      if (typeof charisma === "number") charismaValues.push(charisma);
      if (typeof experience === "number") experienceValues.push(experience);
    });

    return {
      charismaMin: charismaValues.length ? Math.min(...charismaValues) : null,
      charismaMax: charismaValues.length ? Math.max(...charismaValues) : null,
      experienceMin: experienceValues.length ? Math.min(...experienceValues) : null,
      experienceMax: experienceValues.length ? Math.max(...experienceValues) : null,
    };
  }, [sortedFigures, figureStatsById]);

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
              <h2 className="text-sm font-semibold tracking-tight">Internal positions</h2>
              {!positions ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : positions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No internal positions defined.</div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="min-w-[520px] w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Position</th>
                        <th className="text-left px-3 py-2 font-medium">Holder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2">{p.title}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {p.current_holder?.name ?? <span className="italic">vacant</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-tight">Political figures</h2>
              {loadingFigures ? (
                <div className="text-sm text-muted-foreground">Loading members…</div>
              ) : figuresErr ? (
                <div className="text-sm text-destructive">{figuresErr}</div>
              ) : !sortedFigures || sortedFigures.length === 0 ? (
                <div className="text-sm text-muted-foreground">No members found.</div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Role</th>
                        <th className="text-left px-3 py-2 font-medium">Charisma</th>
                        <th className="text-left px-3 py-2 font-medium">Experience</th>
                        <th className="text-right px-3 py-2 font-medium">Join date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFigures.map((f) => {
                        const name = f.name ?? f.full_name ?? `Figure #${f.id}`;
                        const role = positionHolderIds.get(f.id);
                        const stats = figureStatsById[f.id];
                        const charisma = stats?.charisma ?? f.charisma;
                        const experience = stats?.experience ?? f.experience;
                        const charismaPct =
                          typeof charisma === "number" &&
                          statRange?.charismaMin != null &&
                          statRange.charismaMax != null
                            ? toPercent(charisma, statRange.charismaMin, statRange.charismaMax)
                            : null;
                        const experiencePct =
                          typeof experience === "number" &&
                          statRange?.experienceMin != null &&
                          statRange.experienceMax != null
                            ? toPercent(
                                experience,
                                statRange.experienceMin,
                                statRange.experienceMax,
                              )
                            : null;
                        return (
                          <tr key={f.id} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{name}</td>
                            <td className="px-3 py-2">
                              {role ? (
                                <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium">
                                  {role}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Member</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {charismaPct == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2" title={String(charisma)}>
                                  <div className="h-2.5 w-32 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-sky-500"
                                      style={{ width: `${charismaPct}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {experiencePct == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2" title={String(experience)}>
                                  <div className="h-2.5 w-32 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-amber-500"
                                      style={{ width: `${experiencePct}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {f.created_at_game_month ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
