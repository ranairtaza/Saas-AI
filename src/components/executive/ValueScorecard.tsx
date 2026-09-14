"use client";

import { MetricGridSkeleton } from "@/components/executive/ExecutiveSkeleton";
import { SectionError, EmptyState, SectionHeading } from "@/components/executive/ExecutiveShared";

interface CommercialValueSignals {
  opportunitiesIdentified?: number;
  risksIdentified?: number;
  decisionsSupported?: number;
  actionsRecommended?: number;
  estimatedValueCreated?: string;
  roiEvidenceSufficiency?: string;
  evidenceDisclaimer?: string;
}

interface ValueSynthesis {
  overallEvidenceSufficiency?: "INSUFFICIENT" | "PARTIAL" | "SUFFICIENT";
  commercialValueSignals?: CommercialValueSignals;
}

interface Props {
  valueSynthesis: ValueSynthesis | null;
  loading: boolean;
  error?: string;
}

/**
 * Commercial Value Scorecard
 *
 * Strictly separates:
 *   1. Activity counts (opportunities identified, decisions supported etc.) — always shown
 *   2. Attributed business value — ONLY shown when roiEvidenceSufficiency === 'SUFFICIENT'
 *      AND overallEvidenceSufficiency === 'SUFFICIENT'
 *
 * If evidence is insufficient: shows "INSUFFICIENT CAUSAL EVIDENCE" label, never a fabricated number.
 */
export function ValueScorecard({ valueSynthesis, loading, error }: Props) {
  if (loading) return <MetricGridSkeleton cols={4} />;
  if (error) return <SectionError message={error} />;
  if (!valueSynthesis?.commercialValueSignals) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <SectionHeading
          title="Commercial Value Scorecard"
          subtitle="Activity and outcome summary. Attributed value requires sufficient causal evidence."
        />
        <div className="mt-4">
          <EmptyState
            icon="💎"
            title="No commercial value data yet"
            description="Connect data sources and run the operating system to see commercial value signals."
          />
        </div>
      </div>
    );
  }

  const cvs = valueSynthesis.commercialValueSignals;
  const overallSufficiency = valueSynthesis.overallEvidenceSufficiency ?? "INSUFFICIENT";
  const roiSufficiency = cvs.roiEvidenceSufficiency ?? "INSUFFICIENT_CAUSAL_EVIDENCE";

  const activityMetrics = [
    { label: "Opportunities Found", value: cvs.opportunitiesIdentified ?? 0 },
    { label: "Risks Prevented", value: cvs.risksIdentified ?? 0 },
    { label: "Decisions Supported", value: cvs.decisionsSupported ?? 0 },
    { label: "Actions Planned", value: cvs.actionsRecommended ?? 0 },
  ];

  const canShowValue =
    overallSufficiency === "SUFFICIENT" && roiSufficiency === "SUFFICIENT";

  const roiBadgeColor =
    roiSufficiency === "SUFFICIENT"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : roiSufficiency === "PARTIAL"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <section aria-label="Commercial Value Scorecard" className="rounded-2xl border border-violet-200 bg-card p-6 shadow-sm space-y-5">
      <SectionHeading
        title="Commercial Value Scorecard"
        subtitle="Activity counts are factual. Attributed value requires sufficient causal evidence — see disclaimer."
      />

      {/* Activity counts — always reliable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {activityMetrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-muted/20 border border-border p-4"
          >
            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              {m.label}
            </span>
            <span className="text-2xl font-black text-foreground tabular-nums">
              {m.value.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">Activity</span>
          </div>
        ))}
      </div>

      {/* Attributed Business Value — conditional on evidence */}
      <div
        className={`rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          canShowValue
            ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20"
            : "border-slate-200 bg-muted/20"
        }`}
      >
        <div>
          <span className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wide">
            Attributed Business Value
          </span>
          {canShowValue && cvs.estimatedValueCreated ? (
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {cvs.estimatedValueCreated}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${roiBadgeColor}`}
              >
                SUFFICIENT EVIDENCE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground">
                Not attributable
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700">
                INSUFFICIENT CAUSAL EVIDENCE
              </span>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground max-w-sm text-left md:text-right leading-relaxed">
          {cvs.evidenceDisclaimer ??
            "Attribution requires sufficient causal evidence between system actions and business outcomes. Correlation alone does not establish attribution."}
        </p>
      </div>
    </section>
  );
}
