import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNation } from "@/lib/nation-context";
import {
  Cell,
  CartesianGrid,
  Customized,
  Label,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/political-contestation")({
  head: () => ({
    meta: [
      { title: "Political Compass - PR:R Tools" },
      {
        name: "description",
        content:
          "Condense all active party ideology axes into a political compass with left-right and libertarian-authoritarian coordinates.",
      },
    ],
  }),
  component: PoliticalContestationTool,
});

const API = "/api/ptr";
const FALLBACK_COLOR = "#7c8798";
const COMPASS_X_NEGATIVE = "Left";
const COMPASS_X_POSITIVE = "Right";
const COMPASS_Y_NEGATIVE = "Libertarian";
const COMPASS_Y_POSITIVE = "Authoritarian";

const AXIS_WEIGHTS: Record<
  string,
  {
    x: number;
    y: number;
    label: string;
  }
> = {
  economic_redistribution: { x: 1, y: 0, label: "Economic Redistribution" },
  market_regulation: { x: 0.85, y: 0, label: "Market Regulation" },
  trade_policy: { x: 0.5, y: 0.1, label: "Trade Policy" },
  labor_relations: { x: 0.85, y: 0.05, label: "Labor Relations" },
  welfare_design: { x: 0.8, y: 0.1, label: "Welfare Design" },
  global_integration: { x: 0.45, y: 0.2, label: "Global Integration" },
  technological_stance: { x: 0.2, y: 0.25, label: "Technological Stance" },
  social_values: { x: 0, y: 1, label: "Social Values" },
  personal_liberty: { x: 0.1, y: 1, label: "Personal Liberty" },
  judicial_authority: { x: 0.05, y: 0.75, label: "Judicial Authority" },
  territorial_authority: { x: 0.05, y: 0.65, label: "Territorial Authority" },
  political_inclusiveness: { x: 0.1, y: 0.7, label: "Political Inclusiveness" },
  political_contestation: { x: 0.05, y: 0.45, label: "Political Contestation" },
  governance_philosophy: { x: 0.05, y: 0.55, label: "Governance Philosophy" },
  military_posture: { x: 0.15, y: 0.55, label: "Military Posture" },
  national_identity: { x: 0.15, y: 0.65, label: "National Identity" },
  immigration_policy: { x: 0.15, y: 0.7, label: "Immigration Policy" },
  demographic_focus: { x: 0.2, y: 0.1, label: "Demographic Focus" },
};

const COMPASS_AXIS_GROUPS = {
  x: [
    AXIS_WEIGHTS.economic_redistribution.label,
    AXIS_WEIGHTS.market_regulation.label,
    AXIS_WEIGHTS.trade_policy.label,
    AXIS_WEIGHTS.labor_relations.label,
    AXIS_WEIGHTS.welfare_design.label,
    AXIS_WEIGHTS.global_integration.label,
    AXIS_WEIGHTS.technological_stance.label,
    AXIS_WEIGHTS.demographic_focus.label,
  ],
  y: [
    AXIS_WEIGHTS.social_values.label,
    AXIS_WEIGHTS.personal_liberty.label,
    AXIS_WEIGHTS.judicial_authority.label,
    AXIS_WEIGHTS.territorial_authority.label,
    AXIS_WEIGHTS.political_inclusiveness.label,
    AXIS_WEIGHTS.political_contestation.label,
    AXIS_WEIGHTS.governance_philosophy.label,
    AXIS_WEIGHTS.military_posture.label,
    AXIS_WEIGHTS.national_identity.label,
    AXIS_WEIGHTS.immigration_policy.label,
  ],
} as const;

type AxisPosition = {
  axis_id: number;
  axis_code: string;
  axis_name: string;
  position_value: number;
  pole_negative_label: string;
  pole_positive_label: string;
};

type Party = {
  id: number;
  name: string;
  abbreviation: string;
  color: string | null;
  logo_url: string | null;
  vote_count: number;
  seat_count: number;
  platform_positions?: AxisPosition[];
};

type PartyPoint = {
  id: number;
  name: string;
  abbreviation: string;
  color: string;
  votes: number;
  seats: number;
  x: number;
  y: number;
};

type MissingAxisEntry = {
  id: number;
  name: string;
  abbreviation: string;
};

type QuadrantSummary = {
  id: "q1" | "q2" | "q3" | "q4";
  title: string;
  subtitle: string;
  parties: PartyPoint[];
  totalVotes: number;
};

type CompassComputation = {
  x: number | null;
  y: number | null;
  missingAxes: string[];
};

type PartyAxisDetail = {
  axisCode: string;
  axisLabel: string;
  platformValue: number;
  negativePole: string;
  positivePole: string;
};

function safeColor(c: string | null | undefined) {
  if (!c) return FALLBACK_COLOR;
  return /^#([0-9a-f]{3}){1,2}$/i.test(c) ? c : FALLBACK_COLOR;
}

function colorLuma(hex: string) {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isNearWhite(hex: string) {
  return colorLuma(hex) > 0.92;
}

function readableFillColor(hex: string) {
  return isNearWhite(hex) ? "#e5e7eb" : hex;
}

function readableStrokeColor(hex: string) {
  return isNearWhite(hex) ? "#111827" : hex;
}

function clampAxisValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function fmtAxis(value: number) {
  return value.toFixed(3);
}

function axisToPercent(value: number) {
  return ((clampAxisValue(value) + 1) / 2) * 100;
}

function getPlatformPositionForAxis(party: Party, axisCode: string) {
  return party.platform_positions?.find((position) => position.axis_code === axisCode) ?? null;
}

function computeCompassPoint(party: Party): CompassComputation {
  const positions = party.platform_positions;
  if (!positions?.length) {
    return { x: null, y: null, missingAxes: Object.keys(AXIS_WEIGHTS) };
  }

  let weightedX = 0;
  let weightedY = 0;
  let totalXWeight = 0;
  let totalYWeight = 0;
  const missingAxes: string[] = [];

  for (const [axisCode, weight] of Object.entries(AXIS_WEIGHTS)) {
    const position = positions.find((item) => item.axis_code === axisCode);
    if (!position) {
      missingAxes.push(weight.label);
      continue;
    }

    const value = clampAxisValue(Number(position.position_value));
    if (weight.x > 0) {
      weightedX += value * weight.x;
      totalXWeight += weight.x;
    }
    if (weight.y > 0) {
      weightedY += value * weight.y;
      totalYWeight += weight.y;
    }
  }

  return {
    x: totalXWeight > 0 ? clampAxisValue(weightedX / totalXWeight) : null,
    y: totalYWeight > 0 ? clampAxisValue(weightedY / totalYWeight) : null,
    missingAxes,
  };
}

function buildCompassPoint(party: Party): PartyPoint | null {
  const compass = computeCompassPoint(party);
  if (compass.x == null || compass.y == null) return null;

  return {
    id: party.id,
    name: party.name,
    abbreviation: party.abbreviation || party.name.slice(0, 3).toUpperCase(),
    color: safeColor(party.color),
    votes: Number(party.vote_count ?? 0),
    seats: Number(party.seat_count ?? 0),
    x: compass.x,
    y: compass.y,
  };
}

function CenterAxesLayer(props: any) {
  const xScale = (Object.values(props?.xAxisMap ?? {})[0] as any)?.scale;
  const yScale = (Object.values(props?.yAxisMap ?? {})[0] as any)?.scale;
  const width = props?.width ?? 0;
  const height = props?.height ?? 0;

  if (!xScale || !yScale) return null;

  const centerX = xScale(0);
  const centerY = yScale(0);

  return (
    <g pointerEvents="none">
      <line
        x1={centerX}
        y1={0}
        x2={centerX}
        y2={height}
        stroke="hsl(var(--foreground))"
        strokeWidth={2.5}
        strokeOpacity={0.9}
      />
      <line
        x1={0}
        y1={centerY}
        x2={width}
        y2={centerY}
        stroke="hsl(var(--foreground))"
        strokeWidth={2.5}
        strokeOpacity={0.9}
      />
    </g>
  );
}

function BlackLabel(props: any) {
  const { x, y, value } = props;
  if (x == null || y == null || value == null) return null;
  return (
    <text
      x={x}
      y={y - 10}
      textAnchor="middle"
      fontSize="10"
      fontWeight={700}
      fill="currentColor"
      style={{ color: "hsl(var(--foreground))" }}
    >
      {value}
    </text>
  );
}

function IdeologyGlyph({ point }: { point: PartyPoint }) {
  const xPct = ((point.x + 1) / 2) * 100;
  const yPct = ((1 - point.y) / 2) * 100;

  return (
    <div className="w-[92px]">
      <div className="relative h-10 w-[92px] rounded-md border border-border bg-background">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/70" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/70" />
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            left: `${xPct}%`,
            top: `${yPct}%`,
            backgroundColor: readableFillColor(point.color),
            borderColor: readableStrokeColor(point.color),
          }}
        />
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[10px] leading-none text-muted-foreground">
        <span>L</span>
        <span>R</span>
      </div>
    </div>
  );
}

function PlatformAxisGlyph({ entry }: { entry: PartyAxisDetail }) {
  const platformPct = axisToPercent(entry.platformValue);
  const hoverText = [
    `${entry.axisLabel}`,
    `${entry.negativePole} <-> ${entry.positivePole}`,
    `Platform: ${fmtAxis(entry.platformValue)}`,
  ].join("\n");

  return (
    <div className="w-full max-w-[260px]" title={hoverText}>
      <div className="relative h-8 w-full rounded-md border border-border bg-background">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/70" />
        <div className="absolute inset-x-2 top-0 bottom-0">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border/70" />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white"
            style={{ left: `${platformPct}%` }}
            aria-label="Platform position"
          />
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] leading-none text-muted-foreground">
        <span>{entry.negativePole}</span>
        <span>{entry.positivePole}</span>
      </div>
    </div>
  );
}

function getQuadrant(point: PartyPoint) {
  if (point.x >= 0 && point.y >= 0) return "q1";
  if (point.x < 0 && point.y >= 0) return "q2";
  if (point.x < 0 && point.y < 0) return "q3";
  return "q4";
}

function PoliticalContestationTool() {
  const { nationId, selectedNation } = useNation();

  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [parties, setParties] = useState<Party[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (nationId == null) {
      setParties(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API}/parties?nation_id=${nationId}&active_only=true`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load parties (${response.status})`);
        }
        return (await response.json()) as Party[];
      })
      .then((data) => {
        if (cancelled) return;
        setParties(Array.isArray(data) ? data.slice(0, 12) : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message || err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nationId]);

  const axisMeta = useMemo(() => {
    return {
      xNegative: COMPASS_X_NEGATIVE,
      xPositive: COMPASS_X_POSITIVE,
      yNegative: COMPASS_Y_NEGATIVE,
      yPositive: COMPASS_Y_POSITIVE,
    };
  }, []);

  const points = useMemo(() => {
    const items = parties ?? [];
    const parsed: PartyPoint[] = [];

    for (const party of items) {
      const point = buildCompassPoint(party);
      if (!point) continue;
      parsed.push(point);
    }

    return parsed.sort((a, b) => b.votes - a.votes);
  }, [parties]);

  const missingAxisParties = useMemo(() => {
    const items = parties ?? [];
    const missing: MissingAxisEntry[] = [];

    for (const party of items) {
      const compass = computeCompassPoint(party);
      if (compass.x != null && compass.y != null) continue;
      missing.push({
        id: party.id,
        name: party.name,
        abbreviation: party.abbreviation || party.name,
      });
    }

    return missing;
  }, [parties]);

  const quadrants = useMemo<QuadrantSummary[]>(() => {
    const base: QuadrantSummary[] = [
      {
        id: "q1",
        title: `${axisMeta.xPositive} ${axisMeta.yPositive}`,
        subtitle: "Economic right, socially authoritarian",
        parties: [],
        totalVotes: 0,
      },
      {
        id: "q2",
        title: `${axisMeta.xNegative} ${axisMeta.yPositive}`,
        subtitle: "Economic left, socially authoritarian",
        parties: [],
        totalVotes: 0,
      },
      {
        id: "q3",
        title: `${axisMeta.xNegative} ${axisMeta.yNegative}`,
        subtitle: "Economic left, socially libertarian",
        parties: [],
        totalVotes: 0,
      },
      {
        id: "q4",
        title: `${axisMeta.xPositive} ${axisMeta.yNegative}`,
        subtitle: "Economic right, socially libertarian",
        parties: [],
        totalVotes: 0,
      },
    ];

    const byId = new Map(base.map((item) => [item.id, item]));

    for (const point of points) {
      const id = getQuadrant(point);
      const quadrant = byId.get(id);
      if (!quadrant) continue;
      quadrant.parties.push(point);
      quadrant.totalVotes += point.votes;
    }

    return base;
  }, [axisMeta, points]);

  const selectorParties = useMemo(() => {
    const items = parties ?? [];
    return [...items].sort((a, b) => Number(b.vote_count ?? 0) - Number(a.vote_count ?? 0));
  }, [parties]);

  useEffect(() => {
    if (selectedPartyId == null) return;
    if (selectorParties.some((party) => party.id === selectedPartyId)) return;
    setSelectedPartyId(null);
  }, [selectedPartyId, selectorParties]);

  const selectedParty = useMemo(() => {
    if (selectedPartyId == null) return null;
    return selectorParties.find((party) => party.id === selectedPartyId) ?? null;
  }, [selectedPartyId, selectorParties]);

  const partyDetails = useMemo(() => {
    if (!selectedParty) {
      return {
        entries: [] as PartyAxisDetail[],
        availableCount: 0,
        totalAxisCount: Object.keys(AXIS_WEIGHTS).length,
        missingPlatform: [] as string[],
      };
    }

    const entries: PartyAxisDetail[] = [];
    const missingPlatform: string[] = [];

    for (const [axisCode, weight] of Object.entries(AXIS_WEIGHTS)) {
      const platform = getPlatformPositionForAxis(selectedParty, axisCode);

      if (!platform) missingPlatform.push(weight.label);
      if (!platform) continue;

      const platformValue = clampAxisValue(Number(platform.position_value));

      entries.push({
        axisCode,
        axisLabel: weight.label,
        platformValue,
        negativePole: platform.pole_negative_label || "Negative pole",
        positivePole: platform.pole_positive_label || "Positive pole",
      });
    }

    const sorted = [...entries].sort((a, b) => {
      const valueDiff = Math.abs(b.platformValue) - Math.abs(a.platformValue);
      if (valueDiff !== 0) return valueDiff;
      return a.axisLabel.localeCompare(b.axisLabel);
    });

    return {
      entries: sorted,
      availableCount: entries.length,
      totalAxisCount: Object.keys(AXIS_WEIGHTS).length,
      missingPlatform,
    };
  }, [selectedParty]);

  if (nationId == null) {
    return (
      <main className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-8">
        <EmptyState message="Select a nation to map party contestation." />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[88rem] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Political Compass</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Condensed 2-axis map for {selectedNation?.name ?? "selected nation"}: left-right on
            X and libertarian-authoritarian on Y, derived from all party ideology categories.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          {error && <p className="text-sm text-destructive">Failed to load parties: {error}</p>}
          {loading && !error && <p className="text-sm text-muted-foreground">Loading parties…</p>}
          {!loading && !error && points.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No usable platform compass positions found.
            </p>
          )}

          {!loading && !error && points.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{points.length} plotted parties</span>
                <span>Axis range: left/right and libertarian/authoritarian</span>
              </div>

              <div className="h-[360px] w-full sm:h-[430px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 24, bottom: 18, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[-1, 1]}
                      ticks={[-1, -0.5, 0, 0.5, 1]}
                      tick={{ fontSize: 12 }}
                      axisLine={{ strokeOpacity: 0.35 }}
                      tickLine={{ strokeOpacity: 0.35 }}
                      label={{
                        value: `${axisMeta.xNegative} <-> ${axisMeta.xPositive}`,
                        position: "bottom",
                        offset: -2,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[-1, 1]}
                      ticks={[-1, -0.5, 0, 0.5, 1]}
                      tick={{ fontSize: 12 }}
                      axisLine={{ strokeOpacity: 0.35 }}
                      tickLine={{ strokeOpacity: 0.35 }}
                    >
                      <Label
                        value={`${axisMeta.yNegative} <-> ${axisMeta.yPositive}`}
                        angle={-90}
                        position="insideLeft"
                        offset={0}
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0]?.payload as PartyPoint | undefined;
                        if (!point) return null;
                        return (
                          <div className="rounded-md border border-border bg-background p-2 text-xs shadow-md">
                            <p className="font-semibold text-foreground">{point.name}</p>
                            <p className="text-muted-foreground">{point.abbreviation}</p>
                            <p className="mt-1 text-muted-foreground">
                              Left-right: <span className="font-mono text-foreground">{fmtAxis(point.x)}</span>
                            </p>
                            <p className="text-muted-foreground">
                              Libertarian-authoritarian: <span className="font-mono text-foreground">{fmtAxis(point.y)}</span>
                            </p>
                            <p className="text-muted-foreground">Votes: {point.votes}</p>
                            <p className="text-muted-foreground">Seats: {point.seats}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={points} shape="circle" fillOpacity={0.95}>
                      {points.map((point) => (
                        <Cell
                          key={point.id}
                          fill={readableFillColor(point.color)}
                          stroke={readableStrokeColor(point.color)}
                        />
                      ))}
                      <LabelList dataKey="abbreviation" position="top" content={BlackLabel} />
                    </Scatter>
                    <Customized
                      component={(props: any) => <CenterAxesLayer {...props} />}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                <span className="rounded-md border border-border px-2 py-1">X-: {axisMeta.xNegative}</span>
                <span className="rounded-md border border-border px-2 py-1">X+: {axisMeta.xPositive}</span>
                <span className="rounded-md border border-border px-2 py-1">Y-: {axisMeta.yNegative}</span>
                <span className="rounded-md border border-border px-2 py-1">Y+: {axisMeta.yPositive}</span>
              </div>

              <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Axis condensation</p>
                <p className="mt-1">
                  X combines {COMPASS_AXIS_GROUPS.x.join(", ")}. Y combines {COMPASS_AXIS_GROUPS.y.join(", ")}.
                </p>
              </div>
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Quadrant concentration</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Quick read of where points cluster across the two fixed axes.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quadrants.map((quadrant) => (
                <article key={quadrant.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{quadrant.title}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {quadrant.subtitle}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Parties: {quadrant.parties.length} | Votes: {quadrant.totalVotes}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quadrant.parties.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">No parties</span>
                    )}
                    {quadrant.parties.map((party) => (
                      <span
                        key={party.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px]"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full border"
                          style={{
                            backgroundColor: readableFillColor(party.color),
                            borderColor: readableStrokeColor(party.color),
                          }}
                          aria-hidden
                        />
                        {party.abbreviation}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Party snapshot</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sorted for fast cross-checking.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Party</th>
                    <th className="px-2 py-2 font-medium">Ideology</th>
                    <th className="px-2 py-2 font-medium">Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.id} className="border-b border-border/70">
                      <td className="px-2 py-2">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border"
                            style={{
                              backgroundColor: readableFillColor(point.color),
                              borderColor: readableStrokeColor(point.color),
                            }}
                            aria-hidden
                          />
                          <span className="font-medium text-foreground">{point.abbreviation}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <IdeologyGlyph point={point} />
                      </td>
                      <td className="px-2 py-2">{point.seats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingAxisParties.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                <p className="font-medium">Missing axis data</p>
                <p className="mt-1">
                  Excluded from chart: {missingAxisParties.map((party) => party.abbreviation).join(", ")}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Party Details</h2>
              <p className="text-xs text-muted-foreground">
                Select one party to inspect platform positions by ideology axis.
              </p>
            </div>
            <div className="w-full md:w-[320px]">
              <Select
                value={selectedPartyId == null ? "" : String(selectedPartyId)}
                onValueChange={(value) => setSelectedPartyId(value ? Number(value) : null)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a party" />
                </SelectTrigger>
                <SelectContent>
                  {selectorParties.map((party) => (
                    <SelectItem key={party.id} value={String(party.id)}>
                      {party.name} ({party.abbreviation || party.name.slice(0, 3).toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedParty == null ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No party selected. Choose a party to view platform category positions.
            </p>
          ) : (
            <>
              <div className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {selectedParty.logo_url ? (
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border"
                        style={{ backgroundColor: readableFillColor(safeColor(selectedParty.color)) }}
                      >
                        <img
                          src={selectedParty.logo_url}
                          alt={`${selectedParty.name} logo`}
                          className="h-full w-full object-contain"
                        />
                      </span>
                    ) : (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border"
                        style={{
                          backgroundColor: readableFillColor(safeColor(selectedParty.color)),
                          borderColor: readableStrokeColor(safeColor(selectedParty.color)),
                        }}
                        aria-hidden
                      />
                    )}
                    <span className="truncate font-medium text-foreground">{selectedParty.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {selectedParty.abbreviation || selectedParty.name.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    Platform axes available: {partyDetails.availableCount}/{partyDetails.totalAxisCount}
                  </span>
                </div>
              </div>

              {partyDetails.availableCount === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  This party does not have enough platform data to show category details.
                </p>
              ) : (
                <article className="mt-4 rounded-md border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Platform Axis Positions</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ordered by strongest leaning from center. Hover an axis for precise values.
                  </p>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {partyDetails.entries.map((entry) => (
                      <div
                        key={`platform-${entry.axisCode}`}
                        className="flex items-center justify-between gap-3 rounded border border-border/80 px-2 py-1.5 text-[11px]"
                      >
                        <p className="font-medium text-foreground">{entry.axisLabel}</p>
                        <PlatformAxisGlyph entry={entry} />
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {partyDetails.missingPlatform.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                  <p className="font-medium">Partial category coverage</p>
                  <p className="mt-1">
                    Missing in platform: {partyDetails.missingPlatform.join(", ")}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
