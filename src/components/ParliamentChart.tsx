import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
// @ts-expect-error - no types shipped
import { parliamentChart } from "d3-parliament-chart";

const FALLBACK_COLOR = "#999999";

export type ParliamentSeat = {
  partyId: number;
  abbr: string;
  name: string;
  color: string;
  seats: number;
};

type Props = {
  seats: ParliamentSeat[];
  totalSeats: number;
  hiddenPartyIds?: number[];
  // Logic settings (projection)
  estTotalSeats?: number;
  estThreshold?: number;
  defaultTotalSeats?: number;
  defaultThreshold?: number;
  onTotalSeatsChange?: (v: number) => void;
  onThresholdChange?: (v: number) => void;
};

function orderForHemicycle(parties: ParliamentSeat[]): ParliamentSeat[] {
  // Seat dots are filled from left to right, so present parties strictly from
  // biggest to smallest so the diagram reads as a descending ranking.
  return [...parties].filter((p) => p.seats > 0).sort((a, b) => b.seats - a.seats);
}

// Auto-fit: pick section count and geometry so the hemicycle fills the
// available width without leaving an oversized empty centre.
function autoParams(N: number, containerWidth: number) {
  const drawWidth = Math.min(
    containerWidth,
    Math.max(360, Math.round(Math.sqrt(Math.max(1, N)) * 55)),
  );
  const R = drawWidth / 2;
  const rawSections = Math.max(1, Math.min(9, Math.round(Math.sqrt(N) / 5)));
  const sections =
    N % 2 === 0
      ? rawSections % 2 === 0
        ? rawSections
        : Math.max(2, rawSections + 1)
      : rawSections % 2 === 1
        ? rawSections
        : rawSections + 1;
  const seatRadius = Math.max(
    3,
    Math.min(14, Math.round((0.4 * R) / Math.sqrt(Math.max(1, N)))),
  );
  const rowHeight = Math.max(seatRadius * 2 + 1, Math.round(seatRadius * 2.33));
  const sectionGap = Math.max(4, Math.round(seatRadius * 2.89));
  return { drawWidth, sections, seatRadius, rowHeight, sectionGap };
}

type Settings = {
  auto: boolean;
  sections: number;
  seatRadius: number;
  rowHeight: number;
  sectionGap: number;
};

type EffectiveSettings = Settings & { drawWidth: number };

export function ParliamentChart({
  seats,
  totalSeats,
  hiddenPartyIds = [],
  estTotalSeats,
  estThreshold,
  defaultTotalSeats,
  defaultThreshold,
  onTotalSeatsChange,
  onThresholdChange,
}: Props) {
  const hasLogicControls = onTotalSeatsChange != null && onThresholdChange != null;
    const hiddenPartySet = useMemo(() => new Set(hiddenPartyIds), [hiddenPartyIds]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const [width, setWidth] = useState(640);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    auto: true,
    sections: 5,
    seatRadius: 9,
    rowHeight: 21,
    sectionGap: 26,
  });

  useEffect(() => {
    if (!settingsOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        settingsPanelRef.current?.contains(e.target as Node) ||
        settingsBtnRef.current?.contains(e.target as Node)
      ) return;
      setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [settingsOpen]);

  const N = useMemo(
    () => seats.filter((s) => s.seats > 0).reduce((s, p) => s + p.seats, 0),
    [seats],
  );

  const effectiveSettings = useMemo<EffectiveSettings>(() => {
    const auto = autoParams(N, width);
    if (!settings.auto) return { ...settings, drawWidth: auto.drawWidth };
    return { ...settings, ...auto, drawWidth: auto.drawWidth };
  }, [settings, N, width]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(280, Math.floor(e.contentRect.width));
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const ordered = orderForHemicycle(seats.filter((s) => s.seats > 0));
    const flat: { color: string }[] = [];
    for (const p of ordered) {
      for (let i = 0; i < p.seats; i++) flat.push({ color: p.color || FALLBACK_COLOR });
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (flat.length === 0) return;

    const { drawWidth, sections, seatRadius, rowHeight, sectionGap } = effectiveSettings;

    const chart = parliamentChart()
      .width(drawWidth)
      .sections(Math.max(1, sections))
      .sectionGap(sectionGap)
      .seatRadius(seatRadius)
      .rowHeight(rowHeight);

    const height = Math.ceil(drawWidth / 2) + Math.ceil(seatRadius * 2);
    svg
      .attr("viewBox", `0 0 ${drawWidth} ${height}`)
      .attr("width", "100%")
      .attr("preserveAspectRatio", "xMidYMin meet")
      .style("max-width", `${drawWidth}px`)
      .style("display", "block")
      .style("margin", "0 auto");

    const g = svg.append("g");
    g.call(chart.data(flat));
    g.selectAll("circle")
      .attr("fill", (d: unknown) => (d as { color: string }).color)
      .attr("stroke", (d: unknown) => {
        const c = (d as { color: string }).color;
        const h = c.replace("#", "");
        const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
        const r = parseInt(f.slice(0, 2), 16);
        const gg = parseInt(f.slice(2, 4), 16);
        const b = parseInt(f.slice(4, 6), 16);
        const luma = (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
        return luma > 0.92 ? "#94a3b8" : "#ffffff";
      })
      .attr("stroke-width", 0.75);
  }, [seats, width, effectiveSettings]);

  const legend = [...seats]
    .filter((s) => s.seats > 0 && !hiddenPartySet.has(s.partyId))
    .sort((a, b) => b.seats - a.seats);
  const allocated = legend.reduce((s, p) => s + p.seats, 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute right-0 top-0 z-10" data-export-ignore>
          <button
            ref={settingsBtnRef}
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Edit chart settings"
            title="Edit chart settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {settingsOpen && (
            <div ref={settingsPanelRef} className="absolute right-0 top-8 w-72 rounded-lg border border-border bg-background shadow-xl p-4 space-y-4 text-xs z-20">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Settings</span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close settings"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Section 1: Projection logic */}
              {hasLogicControls && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Projection</span>
                    <div className="flex-1 h-px bg-border" />
                    {(estTotalSeats !== defaultTotalSeats || estThreshold !== defaultThreshold) && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { onTotalSeatsChange!(defaultTotalSeats!); onThresholdChange!(defaultThreshold!); }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                        </svg>
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total seats</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={estTotalSeats}
                        onChange={(e) => onTotalSeatsChange!(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        className="h-7 w-20 rounded-md border border-input bg-background px-2 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Threshold</span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={estThreshold}
                          onChange={(e) => onThresholdChange!(Math.max(0, Number(e.target.value) || 0))}
                          className="h-7 w-20 rounded-md border border-input bg-background pl-2 pr-5 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Divider between sections */}
              {hasLogicControls && <div className="h-px bg-border" />}

              {/* Section 2: Appearance */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Appearance</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Auto-fit toggle */}
                <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2 cursor-pointer select-none">
                  <div>
                    <div className="font-medium text-foreground">Auto-fit</div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">Compute geometry from seat count</div>
                  </div>
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${settings.auto ? "bg-foreground" : "bg-input"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${settings.auto ? "translate-x-4" : "translate-x-0"}`}
                    />
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.auto}
                      onChange={(e) => setSettings((s) => ({ ...s, auto: e.target.checked }))}
                    />
                  </div>
                </label>

                <SliderField
                  label="Sections"
                  value={effectiveSettings.sections}
                  min={1} max={11} step={2}
                  disabled={settings.auto}
                  onChange={(v) => setSettings((s) => ({ ...s, sections: v }))}
                />
                <SliderField
                  label="Seat radius"
                  value={effectiveSettings.seatRadius}
                  min={2} max={18} step={1}
                  disabled={settings.auto}
                  onChange={(v) => setSettings((s) => ({ ...s, seatRadius: v }))}
                />
                <SliderField
                  label="Row height"
                  value={effectiveSettings.rowHeight}
                  min={4} max={40} step={1}
                  disabled={settings.auto}
                  onChange={(v) => setSettings((s) => ({ ...s, rowHeight: v }))}
                />
                <SliderField
                  label="Section gap"
                  value={effectiveSettings.sectionGap}
                  min={0} max={60} step={1}
                  disabled={settings.auto}
                  onChange={(v) => setSettings((s) => ({ ...s, sectionGap: v }))}
                />

                {!settings.auto && (
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, auto: true }))}
                    className="w-full rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Reset to auto-fit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div ref={containerRef} className="w-full pt-2">
          <svg ref={svgRef} />
        </div>
      </div>
      <div data-chart-legend className="text-center text-xs text-muted-foreground">
        {allocated} of {totalSeats} seats allocated
      </div>
      <div data-chart-legend className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4 text-xs">
        {legend.map((p) => (
          <div key={p.partyId} className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-border shrink-0"
              style={{ backgroundColor: p.color || FALLBACK_COLOR }}
            />
            <span className="font-medium truncate">{p.abbr}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{p.seats}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`space-y-1 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-foreground w-7 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-foreground cursor-pointer rounded-full"
      />
    </div>
  );
}
