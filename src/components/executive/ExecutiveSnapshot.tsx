"use client";

import { SnapshotSkeleton } from "@/components/executive/ExecutiveSkeleton";
import { SectionError, StatusBadge } from "@/components/executive/ExecutiveShared";
import type { ExecutiveOperatingState } from "@/ai/executive/operating-state/types";

interface Props {
  operatingState: ExecutiveOperatingState | null;
  valueSynthesis: any;
  briefing: any;
  forecastSummary: any;
  loading: boolean;
  error?: string;
}

/**
 * WHAT IS HAPPENING?
 *
 * Executive Snapshot — the top-of-page hero section.
 * Aggregates health score, key opportunity/risk/forecast, and executive summary.
 * All values sourced from server — no recalculation in this component.
 */
export function ExecutiveSnapshot({
  operatingState,
  valueSynthesis,
  briefing,
  forecastSummary,
  loading,
  error,
}: Props) {
  if (loading) return <SnapshotSkeleton />;
  if (error) return <SectionError title="Executive snapshot unavailable" message={error} />;

  const healthScore = valueSynthesis?.health?.overallScore ?? (operatingState?.businessContext as any)?.health?.overallScore ?? "—";
  const healthStatus = (valueSynthesis?.health?.status ?? "STABLE") as string;
  const executiveSummary =
    valueSynthesis?.briefingSummary?.executiveSummary ??
    briefing?.executiveSummary ??
    "Business operating within expected parameters.";

  const topOpportunity =
    valueSynthesis?.opportunities?.[0]?.title ??
    briefing?.opportunities?.[0] ??
    "Review active leads for high-value conversion opportunities.";
  const topOpportunityValue = valueSynthesis?.opportunities?.[0]?.financialImpact;

  const topRisk =
    valueSynthesis?.risks?.[0]?.title ??
    briefing?.risks?.[0] ??
    "No material risks detected at this time.";
  const topRiskSeverity = valueSynthesis?.risks?.[0]?.severity;

  const topForecast = forecastSummary?.activeForecasts?.[0];

  const evidenceSufficiency = valueSynthesis?.overallEvidenceSufficiency ?? "PARTIAL";

  const healthColors: Record<string, string> = {
    HEALTHY: "text-emerald-400 border-emerald-500/40",
    STABLE: "text-blue-400 border-blue-500/40",
    ATTENTION_NEEDED: "text-amber-400 border-amber-500/40",
    CRITICAL_ATTENTION: "text-red-400 border-red-500/40",
  };
  const healthRingColor = healthColors[healthStatus] ?? "text-slate-300 border-slate-500/40";

  const evidenceBanner: Record<string, { bg: string; text: string; label: string; desc: string }> = {
    INSUFFICIENT: {
      bg: "border-red-800/40 bg-red-900/20",
      text: "text-red-300",
      label: "INSUFFICIENT TELEMETRY",
      desc: "Connect data sources for reliable executive intelligence.",
    },
    PARTIAL: {
      bg: "border-amber-700/40 bg-amber-900/20",
      text: "text-amber-300",
      label: "PARTIAL TELEMETRY",
      desc: "Synthesis accuracy is limited. Some intelligence may be missing.",
    },
    SUFFICIENT: {
      bg: "border-emerald-700/40 bg-emerald-900/20",
      text: "text-emerald-300",
      label: "SUFFICIENT TELEMETRY",
      desc: "Operating system has adequate data for confident synthesis.",
    },
  };
  const banner = evidenceBanner[evidenceSufficiency] ?? evidenceBanner["PARTIAL"];

  return (
    <section
      id="overview"
      aria-label="Executive Snapshot"
      className="rounded-3xl border border-slate-700/40 bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 p-5 sm:p-8 text-white shadow-2xl"
    >
      {/* Evidence banner */}
      <div
        className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-2 ${banner.bg}`}
      >
        <span className={`text-[11px] font-bold uppercase tracking-widest ${banner.text}`}>
          {banner.label}
        </span>
        <span className={`text-[10px] ${banner.text} opacity-80`}>{banner.desc}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Summary + 3-card grid */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-300 uppercase tracking-wider">
              Executive Snapshot
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date().toLocaleString()}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
            {executiveSummary}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Opportunity */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
              <span className="text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                Strongest Opportunity
              </span>
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                {topOpportunity}
              </p>
              {topOpportunityValue != null && (
                <div className="text-[10px] font-bold text-emerald-400 font-mono">
                  EST. VALUE: ${topOpportunityValue.toLocaleString()}
                </div>
              )}
            </div>

            {/* Risk */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
              <span className="text-[10px] font-bold tracking-wider text-red-300 uppercase">
                Highest Risk
              </span>
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                {topRisk}
              </p>
              {topRiskSeverity && (
                <div className="text-[10px] font-bold text-red-400">
                  SEVERITY: {topRiskSeverity}
                </div>
              )}
            </div>

            {/* Forecast */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
              <span className="text-[10px] font-bold tracking-wider text-violet-300 uppercase">
                Top Forecast
              </span>
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                {topForecast
                  ? `${topForecast.metric} forecast to reach ${topForecast.forecastValue.toLocaleString()} (${topForecast.forecastHorizon})`
                  : "No active forecasts. Generate forecasts to see projections."}
              </p>
              {topForecast?.confidence != null && (
                <div className="text-[10px] font-bold text-violet-400 font-mono">
                  CONFIDENCE: {topForecast.confidence}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Health ring */}
        <div className="lg:col-span-4 rounded-2xl bg-white/10 border border-white/15 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Business Health
          </span>

          <div className="relative flex items-center justify-center">
            <div
              className={`h-28 w-28 rounded-full border-8 flex items-center justify-center ${healthRingColor}`}
            >
              <span className="text-3xl font-black tracking-tight text-white tabular-nums">
                {healthScore}
              </span>
            </div>
          </div>

          <StatusBadge status={healthStatus} />

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Deterministic composite score from live telemetry
          </p>
        </div>
      </div>
    </section>
  );
}
