import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { fetchNationFlag } from "../lib/nations";
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
  nation_name?: string;
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
  charisma_band?: string;
  experience_band?: string;
  experience_breakdown?: Record<string, number>;
  image_url?: string | null;
  wiki_url?: string | null;
  created_at_game_month?: number | string;
  gender?: string;
  is_active?: boolean;
  party_id?: number;
};

type DetailLabel = {
  is_current?: boolean;
};

type HosTerm = {
  is_current?: boolean;
  label?: DetailLabel | null;
  title_at_term_start?: string | null;
  term_start_month?: number | string | null;
  term_end_month?: number | string | null;
  term_start_game_month?: number | string | null;
  term_end_game_month?: number | string | null;
};

type CabinetPosition = {
  is_current?: boolean;
  label?: DetailLabel | null;
  ministry_display_name?: string | null;
  ministry_name?: string | null;
  start_month?: number | string | null;
  end_month?: number | string | null;
  term_start_month?: number | string | null;
  term_end_month?: number | string | null;
  term_start_game_month?: number | string | null;
  term_end_game_month?: number | string | null;
  start_game_month?: number | string | null;
  end_game_month?: number | string | null;
};

type PositionHeld = {
  position_title?: string | null;
  term_start_game_month?: number | string | null;
  term_end_game_month?: number | string | null;
  is_current?: boolean;
};

type FigureDetail = Figure & {
  hos_terms?: HosTerm[];
  cabinet_positions?: CabinetPosition[];
  positions_held?: PositionHeld[];
};

type FigureStats = {
  charisma?: number;
  experience?: number;
  charisma_band?: string;
  experience_band?: string;
  experience_breakdown?: Record<string, number>;
  image_url?: string | null;
  wiki_url?: string | null;
  hos_terms?: HosTerm[];
  cabinet_positions?: CabinetPosition[];
  positions_held?: PositionHeld[];
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

type OfficialPositionPill = {
  source: "hos" | "cabinet";
  label: string;
};

type RoleHistoryEntry = {
  category: "Head of State" | "Cabinet" | "Party Position";
  title: string;
  startMonth: number | string | null;
  endMonth: number | string | null;
  isCurrent: boolean;
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

function experienceBandColorClass(label: string | null | undefined): string {
  if (!label) return "bg-amber-500";
  const index = experienceTierIndexFromLabel(label);
  if (index !== null) return EXPERIENCE_TIER_COLORS[index];
  return "bg-amber-500";
}

function charismaBandIndexFromLabel(label: string | undefined): number | null {
  if (!label) return null;
  const normalized = label.toLowerCase().replace(/-/g, "");
  const index = CHARISMA_BAND_LABELS.findIndex(
    (l) => l.toLowerCase().replace(/-/g, "") === normalized,
  );
  return index >= 0 ? index : null;
}

function experienceTierIndexFromLabel(label: string | undefined): number | null {
  if (!label) return null;
  const index = EXPERIENCE_TIER_LABELS.findIndex(
    (l) => l.toLowerCase() === label.toLowerCase(),
  );
  return index >= 0 ? index : null;
}

function formatExperienceLabel(key: string): string {
  // Replace 'hos' with 'Presidency', remove 'total' and 'office', and format the rest
  let label = key
    .toLowerCase()
    .replace(/hos/g, "Presidency")
    .replace(/\s*total\s*/g, " ")
    .replace(/\s*office\s*/g, " ")
    .trim()
    .replace(/_/g, " ");
  
  // Capitalize first letter of each word
  return label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getExperienceBreakdownTooltip(key: string): string {
  // Return the formatted key with underscores and capitalization for tooltip
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function formatHosTitleWithNation(title: string, nationName: string | null | undefined): string {
  const trimmedTitle = title.trim();
  const trimmedNation = nationName?.trim() ?? "";
  if (!trimmedTitle || !trimmedNation) return trimmedTitle;
  if (/\bof\b/i.test(trimmedTitle)) return trimmedTitle;
  return `${trimmedTitle} of ${trimmedNation}`;
}

function currentOfficialPositions(
  stats: FigureStats | undefined,
  nationName: string | null | undefined,
): OfficialPositionPill[] {
  if (!stats) return [];

  const hos = (stats.hos_terms ?? [])
    .filter((term) => term?.is_current === true || term?.label?.is_current === true)
    .map((term) => formatHosTitleWithNation(term?.title_at_term_start?.trim() ?? "", nationName))
    .filter((label) => label.length > 0)
    .map((label) => ({ source: "hos" as const, label }));

  const cabinet = (stats.cabinet_positions ?? [])
    .filter((position) => position?.is_current === true || position?.label?.is_current === true)
    .map((position) => position?.ministry_display_name?.trim() ?? "")
    .filter((label) => label.length > 0)
    .map((label) => ({ source: "cabinet" as const, label }));

  return [...hos, ...cabinet];
}

function buildRoleHistoryEntries(
  stats: FigureStats | undefined,
  nationName: string | null | undefined,
): RoleHistoryEntry[] {
  if (!stats) return [];

  const entries: RoleHistoryEntry[] = [];

  (stats.hos_terms ?? []).forEach((term) => {
    const titleRaw = term?.title_at_term_start?.trim() ?? "";
    const title = formatHosTitleWithNation(titleRaw, nationName);
    if (!title) return;
    const isCurrent = term?.is_current === true || term?.label?.is_current === true;
    entries.push({
      category: "Head of State",
      title,
      startMonth: term?.term_start_month ?? term?.term_start_game_month ?? null,
      endMonth: term?.term_end_month ?? term?.term_end_game_month ?? null,
      isCurrent,
    });
  });

  (stats.cabinet_positions ?? []).forEach((position) => {
    const title = (position?.ministry_display_name ?? position?.ministry_name ?? "").trim();
    if (!title) return;
    const isCurrent = position?.is_current === true || position?.label?.is_current === true;
    entries.push({
      category: "Cabinet",
      title,
      startMonth:
        position?.start_month ??
        position?.term_start_month ??
        position?.term_start_game_month ??
        position?.start_game_month ??
        null,
      endMonth:
        position?.end_month ??
        position?.term_end_month ??
        position?.term_end_game_month ??
        position?.end_game_month ??
        null,
      isCurrent,
    });
  });

  (stats.positions_held ?? []).forEach((position) => {
    const title = (position?.position_title ?? "").trim();
    if (!title) return;
    entries.push({
      category: "Party Position",
      title,
      startMonth: position?.term_start_game_month ?? null,
      endMonth: position?.term_end_game_month ?? null,
      isCurrent: position?.is_current === true,
    });
  });

  return entries.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const aStart = joinDateSortValue(a.startMonth);
    const bStart = joinDateSortValue(b.startMonth);
    return compareNullableNumbers(aStart, bStart, "desc");
  });
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
  const [nationNameById, setNationNameById] = useState<Record<number, string>>({});
  const [nationFlagUrlById, setNationFlagUrlById] = useState<Record<number, string | null>>({});
  const [figuresErr, setFiguresErr] = useState<string | null>(null);
  const [loadingFigures, setLoadingFigures] = useState(false);
  const [memberSort, setMemberSort] = useState<MemberSortConfig | null>(null);
  const [experienceBreakdownFigureId, setExperienceBreakdownFigureId] = useState<number | null>(null);
  const [experienceBreakdownData, setExperienceBreakdownData] = useState<Record<string, number> | null>(null);
  const [experienceBreakdownName, setExperienceBreakdownName] = useState<string | null>(null);
  const [experienceBreakdownBand, setExperienceBreakdownBand] = useState<string | null>(null);
  const [roleHistoryFigureId, setRoleHistoryFigureId] = useState<number | null>(null);
  const [roleHistoryName, setRoleHistoryName] = useState<string | null>(null);
  const [roleHistoryEntries, setRoleHistoryEntries] = useState<RoleHistoryEntry[]>([]);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isClosingRoleHistoryModal, setIsClosingRoleHistoryModal] = useState(false);

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
          nation_name: p.nation_name,
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
                nation_name: p.nation_name ?? j.nation_name ?? j.nation?.name,
              } as MyParty;
            } catch {
              return p;
            }
          }),
        );
        setMyParties(enriched);
        setNationNameById((prev) => {
          const next = { ...prev };
          enriched.forEach((party) => {
            if (party.nation_id != null && party.nation_name) {
              next[party.nation_id] = party.nation_name;
            }
          });
          return next;
        });
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

      if (nationId != null && !nationNameById[nationId]) {
        void (async () => {
          try {
            const nationRes = await fetch(`/api/ptr/nations/${nationId}`);
            if (!nationRes.ok) return;
            const nation = await nationRes.json();
            const name = typeof nation?.name === "string" ? nation.name.trim() : "";
            if (!name) return;
            setNationNameById((prev) => ({
              ...prev,
              [nationId]: name,
            }));
          } catch {
            // Keep nation lookup best-effort and non-blocking.
          }
        })();
      }

      if (nationId != null && nationFlagUrlById[nationId] === undefined) {
        void (async () => {
          try {
            const flagUrl = await fetchNationFlag(nationId);
            setNationFlagUrlById((prev) => ({
              ...prev,
              [nationId]: safeHttpUrl(flagUrl),
            }));
          } catch {
            setNationFlagUrlById((prev) => ({
              ...prev,
              [nationId]: null,
            }));
          }
        })();
      }

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
                const detail = (await detailRes.json()) as FigureDetail;
                setFigureStatsById((prev) => {
                  const existing = prev[f.id] ?? {};
                  return {
                    ...prev,
                    [f.id]: {
                      ...existing,
                      charisma: detail.charisma ?? existing.charisma,
                      experience: detail.experience ?? existing.experience,
                      charisma_band: detail.charisma_band ?? existing.charisma_band,
                      experience_band: detail.experience_band ?? existing.experience_band,
                      experience_breakdown: detail.experience_breakdown ?? existing.experience_breakdown,
                      image_url: detail.image_url ?? existing.image_url,
                      wiki_url: detail.wiki_url ?? existing.wiki_url,
                      hos_terms: detail.hos_terms ?? existing.hos_terms,
                      cabinet_positions: detail.cabinet_positions ?? existing.cabinet_positions,
                      positions_held: detail.positions_held ?? existing.positions_held,
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
    [authFetch, nationNameById, nationFlagUrlById],
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

  const selectedNationName = useMemo(() => {
    const byParty = selectedParty?.nation_name?.trim();
    if (byParty) return byParty;
    const nationId = selectedParty?.nation_id;
    if (nationId == null) return null;
    return nationNameById[nationId] ?? null;
  }, [selectedParty, nationNameById]);

  const selectedNationFlagUrl = useMemo(() => {
    const nationId = selectedParty?.nation_id;
    if (nationId == null) return null;
    return nationFlagUrlById[nationId] ?? null;
  }, [selectedParty?.nation_id, nationFlagUrlById]);

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

      const aOfficialPositions = currentOfficialPositions(aStats, selectedNationName);
      const bOfficialPositions = currentOfficialPositions(bStats, selectedNationName);

      const aRole =
        positionHolderIds.get(a.id) ??
        aOfficialPositions[0]?.label ??
        futureRolesByFigureId[a.id]?.[0]?.label ??
        "Member";
      const bRole =
        positionHolderIds.get(b.id) ??
        bOfficialPositions[0]?.label ??
        futureRolesByFigureId[b.id]?.[0]?.label ??
        "Member";

      const aCharismaBandIndex = charismaBandIndexFromLabel(aStats?.charisma_band ?? a.charisma_band);
      const bCharismaBandIndex = charismaBandIndexFromLabel(bStats?.charisma_band ?? b.charisma_band);
      const aCharisma = aCharismaBandIndex ?? aStats?.charisma ?? a.charisma ?? null;
      const bCharisma = bCharismaBandIndex ?? bStats?.charisma ?? b.charisma ?? null;

      const aExperienceTierIndex = experienceTierIndexFromLabel(aStats?.experience_band ?? a.experience_band);
      const bExperienceTierIndex = experienceTierIndexFromLabel(bStats?.experience_band ?? b.experience_band);
      const aExperience = aExperienceTierIndex ?? aStats?.experience ?? a.experience ?? null;
      const bExperience = bExperienceTierIndex ?? bStats?.experience ?? b.experience ?? null;

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
  }, [
    baseFigures,
    figureStatsById,
    futureRolesByFigureId,
    memberSort,
    positionHolderIds,
    selectedNationName,
  ]);

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

  const openRoleHistoryModal = useCallback(
    (figureId: number, name: string, stats: FigureStats | undefined) => {
      setRoleHistoryFigureId(figureId);
      setRoleHistoryName(name);
      setRoleHistoryEntries(buildRoleHistoryEntries(stats, selectedNationName));
    },
    [selectedNationName],
  );

  const closeRoleHistoryModal = useCallback(() => {
    setIsClosingRoleHistoryModal(true);
    setTimeout(() => {
      setRoleHistoryFigureId(null);
      setRoleHistoryName(null);
      setRoleHistoryEntries([]);
      setIsClosingRoleHistoryModal(false);
    }, 200);
  }, []);

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
                          const officialPositions = currentOfficialPositions(stats, selectedNationName);
                          const hasOfficialPositions = officialPositions.length > 0;
                          const imageUrl = safeHttpUrl(stats?.image_url ?? f.image_url);
                          const wikiHref = safeHttpUrl(stats?.wiki_url ?? f.wiki_url);
                          
                          const charismaBandStr = stats?.charisma_band ?? f.charisma_band;
                          const charismaNum = stats?.charisma ?? f.charisma;
                          const charismaBandIndex_val = charismaBandIndexFromLabel(charismaBandStr);
                          const charismaBand = charismaBandIndex_val !== null ? charismaBandIndex_val : (typeof charismaNum === "number" ? charismaBandIndex(charismaNum) : null);
                          const charismaLabel = charismaBandStr ?? (typeof charismaNum === "number" ? charismaBandLabel(charismaNum) : null);
                          
                          const experienceBandStr = stats?.experience_band ?? f.experience_band;
                          const experienceNum = stats?.experience ?? f.experience;
                          const experienceTierIndex_val = experienceTierIndexFromLabel(experienceBandStr);
                          const experienceTier = experienceTierIndex_val !== null ? experienceTierIndex_val : (typeof experienceNum === "number" ? experienceTierIndex(experienceNum) : null);
                          const experienceLabel = experienceBandStr ?? (typeof experienceNum === "number" ? experienceTierLabel(experienceNum) : null);
                          return (
                            <tr
                              key={f.id}
                              className="border-t border-border"
                            >
                              <td className="px-3 py-2 font-medium">
                                <div
                                  className="flex items-center gap-2"
                                  onClick={
                                    wikiHref
                                      ? () => {
                                          window.open(wikiHref, "_blank", "noopener,noreferrer");
                                        }
                                      : undefined
                                  }
                                  style={{ cursor: wikiHref ? "pointer" : "default" }}
                                >
                                  <div
                                    className={`h-7 w-7 shrink-0 overflow-hidden rounded-full ${imageUrl ? "bg-muted" : "bg-transparent"}`}
                                  >
                                    {imageUrl ? (
                                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full rounded-full border border-border/40 bg-muted/20" />
                                    )}
                                  </div>
                                  <span className={wikiHref ? "hover:underline" : ""}>{name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {role || hasOfficialPositions || futureRoles.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {role && (
                                      <button
                                        type="button"
                                        onClick={() => openRoleHistoryModal(f.id, name, stats)}
                                        className="inline-flex cursor-pointer items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                                        style={{
                                          background: selectedParty?.color ?? "#6b7280",
                                          color: textForColor(selectedParty?.color ?? "#6b7280"),
                                          borderColor:
                                            selectedParty?.color
                                              ? roleBorderForColor(selectedParty.color)
                                              : "#374151",
                                        }}
                                        title="Click for full role history"
                                      >
                                        {role}
                                      </button>
                                    )}
                                    {officialPositions.map((officialPosition, index) => (
                                      <button
                                        type="button"
                                        onClick={() => openRoleHistoryModal(f.id, name, stats)}
                                        key={`${f.id}-official-${officialPosition.source}-${officialPosition.label}-${index}`}
                                        className="inline-flex cursor-pointer items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                                        title={
                                          officialPosition.source === "hos"
                                            ? "Current head-of-state term (click for history)"
                                            : "Current cabinet position (click for history)"
                                        }
                                      >
                                        {officialPosition.label}
                                      </button>
                                    ))}
                                    {!hasOfficialPositions && futureRoles.map((futureRole) => (
                                      <button
                                        type="button"
                                        onClick={() => openRoleHistoryModal(f.id, name, stats)}
                                        key={`${f.id}-${futureRole.label}-${futureRole.hover}`}
                                        className="inline-flex cursor-pointer items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                        title={`${futureRole.hover} (click for history)`}
                                      >
                                        {futureRole.label}
                                      </button>
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
                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                    title={`${experienceLabel} (click for breakdown)`}
                                    onClick={() => {
                                      setExperienceBreakdownFigureId(f.id);
                                      const breakdown = figureStatsById[f.id]?.experience_breakdown ?? f.experience_breakdown;
                                      setExperienceBreakdownData(breakdown ?? null);
                                      setExperienceBreakdownName(name);
                                      setExperienceBreakdownBand(experienceLabel);
                                    }}
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
                  
                  {experienceBreakdownFigureId !== null && experienceBreakdownData && (
                    <div 
                      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200 ${
                        isClosingModal ? "opacity-0" : "opacity-100"
                      }`}
                      onClick={() => {
                        setIsClosingModal(true);
                        setTimeout(() => {
                          setExperienceBreakdownFigureId(null);
                          setIsClosingModal(false);
                        }, 200);
                      }}
                    >
                      <style>{`
                        @keyframes slideInScale {
                          from {
                            opacity: 0;
                            transform: scale(0.95);
                          }
                          to {
                            opacity: 1;
                            transform: scale(1);
                          }
                        }
                        @keyframes slideOutScale {
                          from {
                            opacity: 1;
                            transform: scale(1);
                          }
                          to {
                            opacity: 0;
                            transform: scale(0.95);
                          }
                        }
                        .modal-open {
                          animation: slideInScale 0.2s ease-out;
                        }
                        .modal-close {
                          animation: slideOutScale 0.2s ease-in;
                        }
                      `}</style>
                      <div
                        className={`bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg ${
                          isClosingModal ? "modal-close" : "modal-open"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-foreground">Experience Breakdown</h3>
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors ml-2 flex-shrink-0"
                            onClick={() => {
                              setIsClosingModal(true);
                              setTimeout(() => {
                                setExperienceBreakdownFigureId(null);
                                setIsClosingModal(false);
                              }, 200);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            {experienceBreakdownName && (
                              <p className="text-sm text-muted-foreground">{experienceBreakdownName}</p>
                            )}
                          </div>
                          {experienceBreakdownBand && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              {experienceBreakdownBand}
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {Object.entries(experienceBreakdownData)
                            .sort((a, b) => b[1] - a[1])
                            .map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-sm" title={getExperienceBreakdownTooltip(key)}>
                                <span className="text-muted-foreground font-medium cursor-help">{formatExperienceLabel(key)}</span>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 bg-muted rounded flex-1 w-24">
                                    <div
                                      className={`h-full ${experienceBandColorClass(experienceBreakdownBand)} rounded transition-all duration-300`}
                                      style={{
                                        width: `${(value / Math.max(...Object.values(experienceBreakdownData))) * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="font-medium w-12 text-right text-foreground">{value}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {roleHistoryFigureId !== null && (
                    <div
                      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200 ${
                        isClosingRoleHistoryModal ? "opacity-0" : "opacity-100"
                      }`}
                      onClick={closeRoleHistoryModal}
                    >
                      <style>{`
                        @keyframes slideInScale {
                          from {
                            opacity: 0;
                            transform: scale(0.95);
                          }
                          to {
                            opacity: 1;
                            transform: scale(1);
                          }
                        }
                        @keyframes slideOutScale {
                          from {
                            opacity: 1;
                            transform: scale(1);
                          }
                          to {
                            opacity: 0;
                            transform: scale(0.95);
                          }
                        }
                        .modal-open {
                          animation: slideInScale 0.2s ease-out;
                        }
                        .modal-close {
                          animation: slideOutScale 0.2s ease-in;
                        }
                      `}</style>
                      <div
                        className={`bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4 shadow-lg ${
                          isClosingRoleHistoryModal ? "modal-close" : "modal-open"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-foreground">Role History</h3>
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors ml-2 flex-shrink-0"
                            onClick={closeRoleHistoryModal}
                          >
                            ✕
                          </button>
                        </div>
                        {roleHistoryName && (
                          <p className="mb-4 text-sm text-muted-foreground">{roleHistoryName}</p>
                        )}

                        {roleHistoryEntries.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No role history available yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {roleHistoryEntries.map((entry, index) => {
                              const startText =
                                entry.startMonth == null ? null : formatJoinDate(entry.startMonth);
                              const endText = entry.isCurrent
                                ? "Present"
                                : entry.endMonth == null
                                  ? null
                                  : formatJoinDate(entry.endMonth);
                              const dateText =
                                startText || endText
                                  ? `${startText ?? "Unknown"} - ${endText ?? "Unknown"}`
                                  : "Dates unavailable";
                              const categoryIconUrl =
                                entry.category === "Party Position"
                                  ? partyLogoFallbackUrl
                                  : selectedNationFlagUrl;

                              return (
                                <div
                                  key={`${entry.category}-${entry.title}-${index}`}
                                  className="rounded-md border border-border/60 bg-muted/20 p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                      {categoryIconUrl && (
                                        <img
                                          src={categoryIconUrl}
                                          alt=""
                                          className="mr-1 h-3.5 w-auto max-w-6 rounded-sm object-contain"
                                        />
                                      )}
                                      {entry.category === "Party Position"
                                        ? selectedParty?.abbreviation || "PP"
                                        : entry.category}
                                    </span>
                                    {entry.isCurrent && (
                                      <span className="inline-flex items-center rounded-full border border-sky-500 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 text-sm font-medium text-foreground">{entry.title}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{dateText}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
