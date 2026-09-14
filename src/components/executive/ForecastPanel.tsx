"use client";

import { useState } from "react";
import { CardSkeleton, MetricGridSkeleton } from "@/components/executive/ExecutiveSkeleton";
import {
  SectionError,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from "@/components/executive/ExecutiveShared";
import { useToast } from "@/components/ui/Toast";

interface Forecast {
  id?: string;
  domain: string;
  metric: string;
  currentValue: number;
  forecastValue: number;
  lowerBound?: number;
  upperBound?: number;
  forecastHorizon: string;
  horizonDays: number;
  direction: "INCREASING" | "DECREASING" | "STABLE";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  scenarioType: string;
  evidence?: string;
}

interface PredictiveRisk {
  riskType: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  probabilityPct: number;
  horizon: string;
  explanation: string;
}

interface ScenarioComparison {
  domain: string;
  metric: string;
  currentValue: number;
  conservativeForecast: number;
  baselineForecast: number;
  optimisticForecast: number;
  variancePotentialPct: number;
}

interface ForecastSummaryData {
  totalForecasts?: number;
  highConfidenceCount?: number;
  identifiedRisksCount?: number;
  forecasts?: Forecast[];
  activeForecasts?: Forecast[];
  topPredictiveRisks?: PredictiveRisk[];
  scenarioComparisons?: ScenarioComparison[];
}

interface Props {
  forecastSummary: ForecastSummaryData | null;
  loading: boolean;
  error?: string;
  onRefresh: () => Promise<void>;
}

/**
 * WHAT IS LIKELY TO HAPPEN NEXT?
 *
 * Forecast panel. All projected values are explicitly labeled as FORECAST,
 * never confused with actuals. Uncertainty ranges are always shown.
 *
 * Empty state is meaningful: tells the user what data is needed to produce forecasts.
 */
export function ForecastPanel({ forecastSummary, loading, error, onRefresh }: Props) {
  const { addToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const forecasts = forecastSummary?.forecasts ?? forecastSummary?.activeForecasts ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      addToast("Forecasts refreshed.", "success");
    } catch (e: any) {
      addToast(e.message || "Forecast refresh failed.", "error");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <CardSkeleton />;
  if (error) return <SectionError message={error} onRetry={handleRefresh} />;

  const directionIcon: Record<string, string> = {
    INCREASING: "↗",
    DECREASING: "↘",
    STABLE: "→",
  };

  const directionColor: Record<string, string> = {
    INCREASING: "text-emerald-700 bg-emerald-50 border-emerald-200",
    DECREASING: "text-red-700 bg-red-50 border-red-200",
    STABLE: "text-slate-700 bg-slate-50 border-slate-200",
  };

  const confidenceColor: Record<string, string> = {
    HIGH: "bg-emerald-100 text-emerald-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    LOW: "bg-amber-100 text-amber-800",
    VERY_LOW: "bg-red-100 text-red-800",
  };

  return (
    <section aria-label="Forecast" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      <SectionHeading
        title="Forecast"
        subtitle="Statistical projections from telemetry baselines and learning signals. These are FORECASTS, not actuals."
        badge={
          forecastSummary && (
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
              <span>{forecastSummary.totalForecasts ?? forecasts.length} Forecasts</span>
              {(forecastSummary.highConfidenceCount ?? 0) > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-emerald-700">
                    {forecastSummary.highConfidenceCount} High Confidence
                  </span>
                </>
              )}
              {(forecastSummary.identifiedRisksCount ?? 0) > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-amber-700">
                    {forecastSummary.identifiedRisksCount} Predictive Risks
                  </span>
                </>
              )}
            </div>
          )
        }
        action={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition shadow-sm"
          >
            {refreshing ? "Refreshing..." : "Refresh Forecasts"}
          </button>
        }
      />

      {/* Predictive Risk Signals */}
      {(forecastSummary?.topPredictiveRisks?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
            Predictive Risk Signals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {forecastSummary!.topPredictiveRisks!.map((risk, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                  risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL"
                    ? "border-red-200 bg-red-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <span className="text-base shrink-0">
                  {risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL" ? "🚨" : "⚠️"}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{risk.riskType}</span>
                    <StatusBadge status={risk.riskLevel} />
                    <span className="text-[10px] text-muted-foreground">
                      {risk.probabilityPct}% prob · {risk.horizon}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{risk.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Cards */}
      {forecasts.length === 0 ? (
        <EmptyState
          icon="🔮"
          title="No forecasts available"
          description="Not enough historical telemetry data to produce reliable forecasts. Connect more data sources or wait for more activity to accumulate."
          action={
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition"
            >
              Generate Forecasts
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasts.map((f, idx) => (
            <article
              key={idx}
              className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 shadow-sm hover:bg-muted/30 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  {f.domain} · {f.metric}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    confidenceColor[f.confidence] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {f.confidence}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    Actual Baseline:
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground tabular-nums">
                    {f.currentValue?.toLocaleString() ?? "—"}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-foreground">
                    FORECAST ({f.forecastHorizon}):
                  </span>
                  <span className="text-sm font-mono font-extrabold text-violet-900 dark:text-violet-300 tabular-nums">
                    {f.forecastValue?.toLocaleString() ?? "—"}
                  </span>
                </div>

                {f.lowerBound != null && f.upperBound != null && (
                  <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span>Uncertainty Range:</span>
                    <span className="font-mono text-muted-foreground">
                      [{f.lowerBound.toLocaleString()} – {f.upperBound.toLocaleString()}]
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span
                  className={`px-2 py-0.5 font-bold rounded border text-[11px] ${
                    directionColor[f.direction] ?? directionColor["STABLE"]
                  }`}
                >
                  {directionIcon[f.direction] ?? "→"} {f.direction}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {f.horizonDays}d window · {f.scenarioType}
                </span>
              </div>

              {f.evidence && (
                <p className="text-[11px] text-muted-foreground italic bg-card p-2 rounded border border-border/40 leading-relaxed">
                  &ldquo;{f.evidence}&rdquo;
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Scenario Comparison Matrix */}
      {(forecastSummary?.scenarioComparisons?.length ?? 0) > 0 && (
        <div className="space-y-3 pt-2">
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
            Strategic Scenario Matrix (30-Day Projections — All values are FORECASTS)
          </span>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs" aria-label="Scenario comparison matrix">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Domain & Metric</th>
                  <th className="p-3 text-right">Actual Current</th>
                  <th className="p-3 text-right">Conservative (−25%)</th>
                  <th className="p-3 text-right bg-violet-50/40 font-bold text-violet-900 dark:text-violet-300">
                    Baseline Forecast
                  </th>
                  <th className="p-3 text-right">Optimistic (+25%)</th>
                  <th className="p-3 text-center">Variance Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {forecastSummary!.scenarioComparisons!.map((sc, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-3 font-bold text-foreground">
                      <span className="text-[10px] text-muted-foreground block">{sc.domain}</span>
                      {sc.metric}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {sc.currentValue?.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {sc.conservativeForecast?.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-violet-900 dark:text-violet-300 bg-violet-50/20">
                      {sc.baselineForecast?.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800 dark:text-emerald-400">
                      {sc.optimisticForecast?.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground font-mono">
                        ±{sc.variancePotentialPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
