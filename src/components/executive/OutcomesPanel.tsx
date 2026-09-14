"use client";

import { useState } from "react";
import { ListSkeleton } from "@/components/executive/ExecutiveSkeleton";
import {
  SectionError,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from "@/components/executive/ExecutiveShared";
import { useToast } from "@/components/ui/Toast";

interface OutcomeRecord {
  id?: string;
  targetKpiKey?: string | null;
  baselineValue?: number | null;
  finalValue?: number | null;
  deltaPercentage?: number | null;
  expectedValue?: number | null;
  variance?: number | null;
  varianceStatus?: string | null;
  resultStatus?: string | null;
  attributionLevel?: string | null;
  attributionRationale?: string | null;
  effectivenessScore?: number | null;
  measurementWindowDays?: number;
  evaluationDueAt?: string | Date | null;
}

interface PerformanceMetrics {
  effectivenessScore?: number;
  successRatePct?: number;
  learningSignalsCount?: number;
  totalMeasured?: number;
}

interface Props {
  measuringOutcomes: OutcomeRecord[];
  completedOutcomes: OutcomeRecord[];
  performance: PerformanceMetrics | null;
  loading: boolean;
  error?: string;
  onEvaluateOutcome: (id: string) => Promise<void>;
}

/**
 * WHAT HAPPENED? (Phase 35 attribution semantics)
 *
 * Attribution levels and their UI language:
 *
 *   DIRECT_CAUSAL          → May show attributed business value
 *   CORRELATED             → "Outcome observed — causal attribution not established"
 *   INCONCLUSIVE           → "Evidence insufficient to determine attribution"
 *   INSUFFICIENT_EVIDENCE  → "Insufficient evidence"
 *
 * NEVER labels CORRELATED outcomes as ROI or attributed value.
 * This preserves the Phase 35 conservative attribution semantics exactly.
 */
export function OutcomesPanel({
  measuringOutcomes,
  completedOutcomes,
  performance,
  loading,
  error,
  onEvaluateOutcome,
}: Props) {
  const { addToast } = useToast();
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const attributionLanguage: Record<string, { label: string; color: string; caution?: string }> = {
    DIRECT_CAUSAL: {
      label: "Direct Causal",
      color: "bg-emerald-100 text-emerald-800",
    },
    CORRELATED: {
      label: "Correlated",
      color: "bg-amber-100 text-amber-800",
      caution: "Outcome observed — causal attribution not established.",
    },
    INCONCLUSIVE: {
      label: "Inconclusive",
      color: "bg-slate-100 text-slate-700",
      caution: "Evidence insufficient to determine attribution.",
    },
    INSUFFICIENT_EVIDENCE: {
      label: "Insufficient Evidence",
      color: "bg-slate-100 text-slate-700",
      caution: "Insufficient evidence for attribution.",
    },
  };

  if (loading) return <ListSkeleton rows={2} />;
  if (error) return <SectionError message={error} />;

  async function handleEvaluate(id: string) {
    setEvaluatingId(id);
    try {
      await onEvaluateOutcome(id);
      addToast("Outcome evaluated.", "success");
    } catch (e: any) {
      addToast(e.message || "Evaluation failed.", "error");
    } finally {
      setEvaluatingId(null);
    }
  }

  const hasData = measuringOutcomes.length > 0 || completedOutcomes.length > 0;

  return (
    <section aria-label="Outcomes and Results" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      <SectionHeading
        title="Results & Outcomes"
        subtitle="Expected vs. actual variance, closed-loop learning. Attribution semantics are conservative."
      />

      {/* Performance summary */}
      {performance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Decision Effectiveness",
              value: `${performance.effectivenessScore ?? "—"}/100`,
              sub: "Deterministic formula",
            },
            {
              label: "Learning Signals",
              value: performance.learningSignalsCount ?? completedOutcomes.length,
              sub: "Closed-loop evidence",
            },
            {
              label: "Measured Outcomes",
              value: performance.totalMeasured ?? completedOutcomes.length,
              sub: `Measuring: ${measuringOutcomes.length}`,
            },
            {
              label: "Outcome Win Rate",
              value: `${performance.successRatePct ?? "—"}%`,
              sub: "Supported by evidence",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-muted/20 p-4 text-center space-y-1"
            >
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {m.label}
              </span>
              <div className="text-2xl font-black text-foreground tabular-nums">{m.value}</div>
              <span className="text-[10px] text-muted-foreground">{m.sub}</span>
            </div>
          ))}
        </div>
      )}

      {!hasData ? (
        <EmptyState
          icon="📊"
          title="No outcomes recorded yet"
          description="Approved actions will automatically enter an observation window. Evaluate outcomes once the measurement window closes."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Measuring Windows */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Observation Windows ({measuringOutcomes.length})
            </h3>
            {measuringOutcomes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground italic">
                No actions currently inside an active observation window.
              </div>
            ) : (
              measuringOutcomes.map((o, idx) => (
                <div
                  key={o.id ?? idx}
                  className="rounded-xl border border-border bg-muted/20 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      MEASURING ({o.measurementWindowDays}d window)
                    </span>
                    {o.evaluationDueAt && (
                      <span className="text-xs text-muted-foreground">
                        Due {new Date(o.evaluationDueAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Target KPI:</span>{" "}
                    {o.targetKpiKey ?? "Business Health"} · Baseline:{" "}
                    {o.baselineValue?.toLocaleString() ?? "—"}
                  </div>
                  {o.id && (
                    <div className="flex justify-end pt-2 border-t border-border">
                      <button
                        onClick={() => handleEvaluate(o.id!)}
                        disabled={evaluatingId === o.id}
                        className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition"
                      >
                        {evaluatingId === o.id ? "Evaluating..." : "Evaluate Now"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Completed Outcomes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recently Evaluated ({completedOutcomes.length})
            </h3>
            {completedOutcomes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground italic">
                No outcomes evaluated yet.
              </div>
            ) : (
              completedOutcomes.slice(0, 4).map((o, idx) => {
                const attribution = attributionLanguage[o.attributionLevel ?? "INCONCLUSIVE"] ??
                  attributionLanguage["INCONCLUSIVE"];
                return (
                  <div
                    key={o.id ?? idx}
                    className="rounded-xl border border-border bg-muted/20 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.resultStatus ?? "INCONCLUSIVE"} />
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${attribution.color}`}
                        >
                          {attribution.label}
                        </span>
                      </div>
                      {o.effectivenessScore != null && (
                        <span className="text-xs font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                          Score {o.effectivenessScore}/100
                        </span>
                      )}
                    </div>

                    {/* KPI movement */}
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {o.targetKpiKey ?? "KPI"}:
                      </span>{" "}
                      {o.baselineValue?.toLocaleString() ?? "—"} ➔{" "}
                      {o.finalValue?.toLocaleString() ?? "—"}
                      {o.deltaPercentage != null && (
                        <span
                          className={`ml-1 font-bold ${
                            o.deltaPercentage >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          ({o.deltaPercentage >= 0 ? "+" : ""}
                          {o.deltaPercentage}%)
                        </span>
                      )}
                    </div>

                    {/* Variance */}
                    {typeof o.variance === "number" && (
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Expected: {o.expectedValue ?? "N/A"} | Actual:{" "}
                        {o.finalValue?.toLocaleString() ?? "—"} | Variance:{" "}
                        {o.variance > 0 ? `+${o.variance}` : o.variance} ({o.varianceStatus ?? "NEUTRAL"})
                      </div>
                    )}

                    {/* Attribution caution */}
                    {attribution.caution && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/30 p-1.5 rounded border border-border">
                        {attribution.caution}
                      </p>
                    )}

                    {/* Rationale */}
                    {o.attributionRationale && (
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {o.attributionRationale}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
