import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PartySquareLogo } from "@/components/PartySquareLogo";
import { useNation } from "@/lib/nation-context";

export const Route = createFileRoute("/nation")({
  head: () => ({
    meta: [
      { title: "Nation - PR:R Tools" },
      { name: "description", content: "Current office holders for the selected nation." },
    ],
  }),
  component: NationPage,
});

type HosHolder = {
  figure_id: number;
  figure_name: string;
  party_id?: number | null;
  party_name?: string | null;
  party_color?: string | null;
  title_at_term_start?: string | null;
  term_start_month?: string | null;
  is_acting?: boolean;
  deputy?: HosHolder | null;
};

type HolderCard = {
  figureId: number;
  name: string;
  title: string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
  isActing: boolean;
};

type GovernmentMember = {
  id: number;
  nation_ministry_id?: number | null;
  person_id?: number | null;
  minister_name?: string | null;
  minister_given_name?: string | null;
  minister_surname?: string | null;
  ministry_name?: string | null;
  party_id?: number | null;
  party_abbreviation?: string | null;
  party_name?: string | null;
  party_color?: string | null;
  display_order?: number | null;
  is_head_of_government?: boolean;
  is_deputy_hog?: boolean;
  deputy_until_game_month?: string | null;
};

type GovernmentData = {
  display_name?: string | null;
  deputy_title?: string | null;
  members?: GovernmentMember[];
};

type GovernmentCard = {
  key: string;
  personId: number;
  name: string;
  role: string;
  partyId: number | null;
  partyAbbreviation: string | null;
  partyName: string | null;
  partyColor: string | null;
};

type MinistryPositionHolder = {
  political_figure_id: number;
  name?: string | null;
  since_game_month?: string | null;
};

type MinistryPosition = {
  id: number;
  title?: string | null;
  display_order?: number | null;
  current_holder?: MinistryPositionHolder | null;
};

type MinistryPositionsMinistry = {
  nation_ministry_id: number;
  positions?: MinistryPosition[];
};

type MinistryPositionsData = {
  label?: string | null;
  ministries?: MinistryPositionsMinistry[];
};

type FigurePartyMeta = {
  partyId: number | null;
  partyAbbreviation: string | null;
  partyName: string | null;
  partyColor: string | null;
};

type MinistryPositionGroup = {
  ministryId: number;
  ministryName: string;
  cards: GovernmentCard[];
};

type PartyMeta = {
  logoUrl: string | null;
  abbreviation: string | null;
  name: string | null;
  color: string | null;
};

function safeColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  return /^#([0-9a-f]{3}){1,2}$/i.test(trimmed) ? trimmed : null;
}

function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function normalizePartyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeHolders(payload: unknown): HolderCard[] {
  const source = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const cards: HolderCard[] = [];
  const seen = new Set<number>();

  source.forEach((raw) => {
    const holder = raw as HosHolder;
    const pushHolder = (entry: HosHolder | null | undefined) => {
      if (!entry || typeof entry.figure_id !== "number" || seen.has(entry.figure_id)) return;
      const name = (entry.figure_name ?? "").trim() || `Figure #${entry.figure_id}`;
      const title = (entry.title_at_term_start ?? "").trim() || "Head of State";
      cards.push({
        figureId: entry.figure_id,
        name,
        title,
        partyId: typeof entry.party_id === "number" ? entry.party_id : null,
        partyName: typeof entry.party_name === "string" && entry.party_name.trim() ? entry.party_name.trim() : null,
        partyColor: safeColor(entry.party_color),
        isActing: entry.is_acting === true,
      });
      seen.add(entry.figure_id);
    };

    pushHolder(holder);
    pushHolder(holder?.deputy ?? null);
  });

  return cards;
}

function NationPage() {
  const { nationId, selectedNation } = useNation();

  const [holders, setHolders] = useState<HolderCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [government, setGovernment] = useState<GovernmentData | null>(null);
  const [governmentErr, setGovernmentErr] = useState<string | null>(null);
  const [ministryPositions, setMinistryPositions] = useState<MinistryPositionsData | null>(null);
  const [ministryPositionsErr, setMinistryPositionsErr] = useState<string | null>(null);
  const [figureImageById, setFigureImageById] = useState<Record<number, string | null>>({});
  const [figurePartyById, setFigurePartyById] = useState<Record<number, FigurePartyMeta>>({});
  const [partyMetaById, setPartyMetaById] = useState<Record<number, PartyMeta>>({});

  useEffect(() => {
    if (nationId == null) {
      setHolders(null);
      setError(null);
      setGovernment(null);
      setGovernmentErr(null);
      setMinistryPositions(null);
      setMinistryPositionsErr(null);
      setFigureImageById({});
      setFigurePartyById({});
      setPartyMetaById({});
      return;
    }

    let cancelled = false;
    setHolders(null);
    setError(null);
    setGovernment(null);
    setGovernmentErr(null);
    setMinistryPositions(null);
    setMinistryPositionsErr(null);
    setFigureImageById({});
    setFigurePartyById({});
    setPartyMetaById({});

    (async () => {
      let normalizedHolders: HolderCard[] = [];
      let governmentData: GovernmentData | null = null;
      let ministryPositionsData: MinistryPositionsData | null = null;

      try {
        const response = await fetch(`/api/ptr/nations/${nationId}/head-of-state`);
        if (!response.ok) {
          throw new Error(`Failed to load head of state (${response.status})`);
        }
        const payload = await response.json();
        normalizedHolders = normalizeHolders(payload);
        if (cancelled) return;
        setHolders(normalizedHolders);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setHolders([]);
      }

      try {
        const governmentRes = await fetch(`/api/ptr/nations/${nationId}/government`);
        if (!governmentRes.ok) {
          throw new Error(`Failed to load government (${governmentRes.status})`);
        }
        governmentData = (await governmentRes.json()) as GovernmentData;
        if (!cancelled) setGovernment(governmentData);
      } catch (e) {
        if (!cancelled) {
          setGovernmentErr((e as Error).message);
          setGovernment({ members: [] });
        }
      }

      try {
        const ministryPositionsRes = await fetch(`/api/ptr/nations/${nationId}/ministry-positions`);
        if (!ministryPositionsRes.ok) {
          throw new Error(`Failed to load ministry positions (${ministryPositionsRes.status})`);
        }
        ministryPositionsData = (await ministryPositionsRes.json()) as MinistryPositionsData;
        if (!cancelled) setMinistryPositions(ministryPositionsData);
      } catch (e) {
        if (!cancelled) {
          setMinistryPositionsErr((e as Error).message);
          setMinistryPositions({ ministries: [] });
        }
      }

      const figureIds = new Set<number>();
      const partyIds = new Set<number>();

      normalizedHolders.forEach((holder) => {
        figureIds.add(holder.figureId);
        if (holder.partyId != null) partyIds.add(holder.partyId);
      });

      (governmentData?.members ?? []).forEach((member) => {
        if (typeof member.person_id === "number") figureIds.add(member.person_id);
        if (typeof member.party_id === "number") partyIds.add(member.party_id);
      });

      (ministryPositionsData?.ministries ?? []).forEach((ministry) => {
        (ministry.positions ?? []).forEach((position) => {
          const figureId = position.current_holder?.political_figure_id;
          if (typeof figureId === "number") figureIds.add(figureId);
        });
      });

      if (figureIds.size > 0) {
        const figureEntries = await Promise.all(
          Array.from(figureIds).map(async (figureId) => {
            try {
              const detailRes = await fetch(`/api/ptr/nations/${nationId}/political-figures/${figureId}`);
              if (!detailRes.ok) {
                return {
                  figureId,
                  imageUrl: null,
                  party: {
                    partyId: null,
                    partyAbbreviation: null,
                    partyName: null,
                    partyColor: null,
                  } as FigurePartyMeta,
                };
              }
              const detail = await detailRes.json();
              const imageUrl = safeHttpUrl(detail?.image_url);
              const partyId =
                typeof detail?.party_id === "number"
                  ? detail.party_id
                  : typeof detail?.party?.id === "number"
                    ? detail.party.id
                    : null;
              const partyName =
                typeof detail?.party_name === "string" && detail.party_name.trim()
                  ? detail.party_name.trim()
                  : typeof detail?.party?.name === "string" && detail.party.name.trim()
                    ? detail.party.name.trim()
                    : null;
              const partyAbbreviation =
                typeof detail?.party_abbreviation === "string" && detail.party_abbreviation.trim()
                  ? detail.party_abbreviation.trim()
                  : typeof detail?.party?.abbreviation === "string" && detail.party.abbreviation.trim()
                    ? detail.party.abbreviation.trim()
                    : null;
              const partyColor =
                safeColor(detail?.party_color) ??
                safeColor(detail?.party?.color);
              return {
                figureId,
                imageUrl,
                party: {
                  partyId,
                  partyAbbreviation,
                  partyName,
                  partyColor,
                } as FigurePartyMeta,
              };
            } catch {
              return {
                figureId,
                imageUrl: null,
                party: {
                  partyId: null,
                  partyAbbreviation: null,
                  partyName: null,
                  partyColor: null,
                } as FigurePartyMeta,
              };
            }
          }),
        );

        figureEntries.forEach((entry) => {
          if (entry.party.partyId != null) partyIds.add(entry.party.partyId);
        });

        if (!cancelled) {
          setFigureImageById(Object.fromEntries(figureEntries.map((entry) => [entry.figureId, entry.imageUrl])));
          setFigurePartyById(Object.fromEntries(figureEntries.map((entry) => [entry.figureId, entry.party])));
        }
      }

      if (partyIds.size > 0) {
        const partyEntries = await Promise.all(
          Array.from(partyIds).map(async (partyId) => {
            try {
              const partyRes = await fetch(`/api/ptr/parties/${partyId}`);
              if (!partyRes.ok) {
                return [
                  partyId,
                  {
                    logoUrl: null,
                    abbreviation: null,
                    name: null,
                    color: null,
                  },
                ] as const;
              }
              const party = await partyRes.json();
              const logoUrl = safeHttpUrl(party?.logo_url);
              const partyAbbreviation =
                typeof party?.abbreviation === "string" && party.abbreviation.trim()
                  ? party.abbreviation.trim()
                  : null;
              const partyName = typeof party?.name === "string" && party.name.trim() ? party.name.trim() : null;
              const partyColor = safeColor(party?.color);
              return [
                partyId,
                {
                  logoUrl,
                  abbreviation: partyAbbreviation,
                  name: partyName,
                  color: partyColor,
                },
              ] as const;
            } catch {
              return [
                partyId,
                {
                  logoUrl: null,
                  abbreviation: null,
                  name: null,
                  color: null,
                },
              ] as const;
            }
          }),
        );

        if (!cancelled) {
          setPartyMetaById(Object.fromEntries(partyEntries));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nationId]);

  const nationLabel = useMemo(() => {
    const name = selectedNation?.name?.trim();
    if (name) return name;
    return nationId != null ? `Nation #${nationId}` : "Nation";
  }, [selectedNation?.name, nationId]);

  const governmentCards = useMemo(() => {
    const members = [...(government?.members ?? [])].sort(
      (a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER),
    );

    const mapMemberToCard = (member: GovernmentMember, roleOverride?: string): GovernmentCard | null => {
      if (typeof member.person_id !== "number") return null;
      const fullNameFromParts = [member.minister_given_name ?? "", member.minister_surname ?? ""]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" ");
      const name =
        (member.minister_name ?? "").trim() ||
        fullNameFromParts ||
        `Figure #${member.person_id}`;
      const role = roleOverride ?? (member.ministry_name?.trim() || "Minister");
      return {
        key: `gov-${member.id}`,
        personId: member.person_id,
        name,
        role,
        partyId: typeof member.party_id === "number" ? member.party_id : null,
        partyAbbreviation:
          typeof member.party_abbreviation === "string" && member.party_abbreviation.trim()
            ? member.party_abbreviation.trim()
            : null,
        partyName:
          typeof member.party_name === "string" && member.party_name.trim() ? member.party_name.trim() : null,
        partyColor: safeColor(member.party_color),
      };
    };

    const headMember = members.find((m) => m.is_head_of_government === true);
    const deputyMember = members.find(
      (m) => m.is_deputy_hog === true && (m.deputy_until_game_month == null || m.deputy_until_game_month === ""),
    ) ?? members.find((m) => m.is_deputy_hog === true);

    const head = headMember ? mapMemberToCard(headMember, headMember.ministry_name?.trim() || "Head of Government") : null;
    const deputyRoleTitle = (government?.deputy_title ?? "Deputy Head of Government").trim() || "Deputy Head of Government";
    const deputyRoleMinistry = deputyMember?.ministry_name?.trim();
    const deputyRole = deputyRoleMinistry ? `${deputyRoleTitle} · ${deputyRoleMinistry}` : deputyRoleTitle;
    const deputy = deputyMember ? mapMemberToCard(deputyMember, deputyRole) : null;

    const excludedIds = new Set<number>();
    if (headMember?.id != null) excludedIds.add(headMember.id);
    if (deputyMember?.id != null) excludedIds.add(deputyMember.id);

    const others = members
      .filter((member) => !excludedIds.has(member.id))
      .map((member) => mapMemberToCard(member))
      .filter((card): card is GovernmentCard => card != null);

    return { head, deputy, others };
  }, [government]);

  const ministryPositionGroups = useMemo(() => {
    const ministryNameById = new Map<number, string>();
    (government?.members ?? []).forEach((member) => {
      const ministryId = member.nation_ministry_id;
      const ministryName = member.ministry_name?.trim();
      if (typeof ministryId === "number" && ministryName) {
        ministryNameById.set(ministryId, ministryName);
      }
    });

    const groups: MinistryPositionGroup[] = [];

    (ministryPositions?.ministries ?? []).forEach((ministry) => {
      const ministryName =
        ministryNameById.get(ministry.nation_ministry_id) ??
        `Ministry #${ministry.nation_ministry_id}`;
      const positions = [...(ministry.positions ?? [])].sort(
        (a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER),
      );

      const cards: GovernmentCard[] = [];

      positions.forEach((position) => {
        const holder = position.current_holder;
        if (!holder || typeof holder.political_figure_id !== "number") return;
        const name = (holder.name ?? "").trim() || `Figure #${holder.political_figure_id}`;
        const title = (position.title ?? "").trim() || "Ministry Position";
        const figureParty = figurePartyById[holder.political_figure_id];

        cards.push({
          key: `ministry-position-${position.id}`,
          personId: holder.political_figure_id,
          name,
          role: title,
          partyId: figureParty?.partyId ?? null,
          partyAbbreviation: figureParty?.partyAbbreviation ?? null,
          partyName: figureParty?.partyName ?? null,
          partyColor: figureParty?.partyColor ?? null,
        });
      });

      if (cards.length > 0) {
        groups.push({
          ministryId: ministry.nation_ministry_id,
          ministryName,
          cards,
        });
      }
    });

    return groups;
  }, [government?.members, ministryPositions, figurePartyById]);

  const ministerRows = useMemo(() => {
    const all = governmentCards.others;
    if (all.length === 0) return { top: [] as GovernmentCard[], bottom: [] as GovernmentCard[] };
    const topCount = Math.ceil(all.length / 2);
    return {
      top: all.slice(0, topCount),
      bottom: all.slice(topCount),
    };
  }, [governmentCards.others]);

  return (
    <main className="mx-auto max-w-[88rem] px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Nation</h1>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Current holders of national offices for {nationLabel}.
          </p>
          {selectedNation?.flagUrl ? (
            <span className="inline-flex h-12 shrink-0">
              <img
                src={selectedNation.flagUrl}
                alt={`Flag of ${selectedNation.name}`}
                className="block h-full w-auto rounded-sm border border-border dark:border-transparent"
              />
            </span>
          ) : null}
        </div>
      </header>

      {nationId == null ? (
        <EmptyState message="Select a country in the top selector to view national office holders." />
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : !holders ? (
        <div className="text-sm text-muted-foreground">Loading head of state…</div>
      ) : holders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No current head-of-state holders found.
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">Head of State</h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                {holders.map((holder) => {
                  const partyMeta = holder.partyId != null ? partyMetaById[holder.partyId] : undefined;
                  return (
                    <HolderCard
                      key={holder.figureId}
                      holderName={holder.name}
                      positionTitle={holder.isActing ? `${holder.title} (Acting)` : holder.title}
                      portraitUrl={figureImageById[holder.figureId] ?? null}
                      partyLogoUrl={partyMeta?.logoUrl ?? null}
                      partyName={holder.partyName ?? partyMeta?.name ?? null}
                      partyColor={holder.partyColor ?? partyMeta?.color ?? null}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">Government</h2>
            {governmentErr ? (
              <div className="text-sm text-destructive">{governmentErr}</div>
            ) : !government ? (
              <div className="text-sm text-muted-foreground">Loading government…</div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="text-sm font-semibold text-foreground">
                  {government.display_name?.trim() || "Current Government"}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {governmentCards.head ? (
                    <GovernmentHolderCard
                      card={governmentCards.head}
                      figureImageById={figureImageById}
                      figurePartyById={figurePartyById}
                      partyMetaById={partyMetaById}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No active head of government found.
                    </div>
                  )}

                  {governmentCards.deputy ? (
                    <GovernmentHolderCard
                      card={governmentCards.deputy}
                      figureImageById={figureImageById}
                      figurePartyById={figurePartyById}
                      partyMetaById={partyMetaById}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No active deputy head of government found.
                    </div>
                  )}
                </div>

                {governmentCards.others.length > 0 ? (
                  <div className="mt-10 space-y-2">
                    <h3 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ministers</h3>
                    <div className="space-y-3">
                      <div className="mx-auto flex w-full max-w-7xl justify-between gap-3">
                        {ministerRows.top.map((member) => (
                          <div key={`ministers-top-${member.key}`} className="w-[11rem]">
                            <GovernmentHolderCard
                              card={member}
                              figureImageById={figureImageById}
                              figurePartyById={figurePartyById}
                              partyMetaById={partyMetaById}
                              size="compact"
                            />
                          </div>
                        ))}
                      </div>
                      {ministerRows.bottom.length > 0 ? (
                        <div className="mx-auto flex w-full max-w-7xl justify-between gap-3">
                          {ministerRows.bottom.map((member) => (
                            <div key={`ministers-bottom-${member.key}`} className="w-[11rem]">
                              <GovernmentHolderCard
                                card={member}
                                figureImageById={figureImageById}
                                figurePartyById={figurePartyById}
                                partyMetaById={partyMetaById}
                                size="compact"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {ministryPositionsErr ? (
                  <div className="text-sm text-destructive">{ministryPositionsErr}</div>
                ) : ministryPositionGroups.length > 0 ? (
                  <div className="mt-10 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ministryPositions?.label?.trim() || "Ministry Positions"}
                    </h3>
                    <div className="space-y-5">
                      {ministryPositionGroups.map((group) => (
                        <section key={`ministry-group-${group.ministryId}`} className="space-y-2 pt-2">
                          <h4 className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground">
                            {group.ministryName}
                          </h4>
                          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(6.5rem,1fr))] sm:[grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))] lg:[grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr))]">
                            {group.cards.map((position) => (
                              <GovernmentHolderCard
                                key={position.key}
                                card={position}
                                figureImageById={figureImageById}
                                figurePartyById={figurePartyById}
                                partyMetaById={partyMetaById}
                                size="tiny"
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function GovernmentHolderCard({
  card,
  figureImageById,
  figurePartyById,
  partyMetaById,
  size = "regular",
}: {
  card: GovernmentCard;
  figureImageById: Record<number, string | null>;
  figurePartyById: Record<number, FigurePartyMeta>;
  partyMetaById: Record<number, PartyMeta>;
  size?: "regular" | "compact" | "tiny";
}) {
  const figureParty = figurePartyById[card.personId];
  const partyNameCandidate = card.partyName ?? figureParty?.partyName ?? null;
  const partyId = card.partyId ?? figureParty?.partyId ?? null;
  const partyMetaByIdMatch = partyId != null ? partyMetaById[partyId] : undefined;
  const partyMetaByNameMatch =
    partyMetaByIdMatch == null && partyNameCandidate
      ? Object.values(partyMetaById).find(
          (meta) =>
            typeof meta?.name === "string" &&
            normalizePartyName(meta.name) === normalizePartyName(partyNameCandidate),
        )
      : undefined;
  const partyMeta = partyMetaByIdMatch ?? partyMetaByNameMatch;
  const isAcronymMode = size === "compact" || size === "tiny";
  const partyDisplay = isAcronymMode
    ? card.partyAbbreviation ?? figureParty?.partyAbbreviation ?? partyMeta?.abbreviation ?? partyNameCandidate ?? partyMeta?.name ?? null
    : partyNameCandidate ?? partyMeta?.name ?? null;
  return (
    <HolderCard
      holderName={card.name}
      positionTitle={card.role}
      portraitUrl={figureImageById[card.personId] ?? null}
      partyLogoUrl={partyMeta?.logoUrl ?? null}
      partyName={partyDisplay}
      partyColor={card.partyColor ?? figureParty?.partyColor ?? partyMeta?.color ?? null}
      size={size}
    />
  );
}

function HolderCard({
  holderName,
  positionTitle,
  portraitUrl,
  partyLogoUrl,
  partyName,
  partyColor,
  size = "regular",
}: {
  holderName: string;
  positionTitle: string;
  portraitUrl: string | null;
  partyLogoUrl: string | null;
  partyName: string | null;
  partyColor: string | null;
  size?: "regular" | "compact" | "tiny";
}) {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(portraitUrl ?? partyLogoUrl);

  const imageSizeClass = size === "tiny" ? "h-16 w-16" : size === "compact" ? "h-20 w-20" : "h-32 w-32";
  const nameSizeClass = size === "tiny" ? "text-[11px]" : size === "compact" ? "text-xs" : "text-sm";
  const roleSizeClass = size === "tiny" ? "text-[10px]" : "text-xs";
  const roleOverflowClass = "";
  const subtitleSizeClass = size === "tiny" ? "text-[10px]" : "text-xs";
  const subtitleOverflowClass = size === "tiny" ? "truncate" : "";
  const partySwatchSizeClass = size === "tiny" ? "h-3 w-3" : "h-3.5 w-3.5";

  useEffect(() => {
    setCurrentImageUrl(portraitUrl ?? partyLogoUrl);
  }, [portraitUrl, partyLogoUrl]);

  return (
    <article className="text-center">
      <div
        className={`mx-auto overflow-hidden rounded-xl border border-border/70 ${imageSizeClass} ${currentImageUrl ? "bg-muted" : "bg-muted/20"}`}
        title={positionTitle}
      >
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              setCurrentImageUrl((prev) => {
                if (prev !== partyLogoUrl && partyLogoUrl) return partyLogoUrl;
                return null;
              });
            }}
          />
        ) : (
          <div className="h-full w-full bg-muted/30" />
        )}
      </div>
      <div className="mt-2 space-y-1 px-1">
        <div className={`${nameSizeClass} font-semibold leading-tight text-center text-foreground`}>{holderName}</div>
        <div
          className={`${roleSizeClass} ${roleOverflowClass} font-medium leading-tight text-center text-foreground/75`}
          title={positionTitle}
        >
          {positionTitle}
        </div>
        <div className="pt-1" />
        <div className={`flex items-center justify-center gap-1.5 leading-tight text-muted-foreground/70 ${subtitleSizeClass}`}>
          <PartySquareLogo
            logoUrl={partyLogoUrl}
            partyColor={partyColor}
            className={partySwatchSizeClass}
            imgClassName="object-contain"
            title={partyName ?? "Independent"}
          />
          <span className={subtitleOverflowClass}>{partyName ?? "Independent"}</span>
        </div>
      </div>
    </article>
  );
}