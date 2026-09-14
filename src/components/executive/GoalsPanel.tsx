"use client";

import { CardSkeleton } from "@/components/executive/ExecutiveSkeleton";
import {
  SectionError,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from "@/components/executive/ExecutiveShared";

interface Goal {
  id?: string;
  title: string;
  status: "ACHIEVED" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "DRAFT" | "MISSED" | "CANCELLED";
  currentValue: number;
  targetValue: number;
  unit?: string;
  progressPct?: number;
}

interface Props {
  goals: Goal[];
  recommendations: any[];
  loading: boolean;
  error?: string;
  onProposeAction?: (recommendationId: string) => Promise<void>;
}

/**
 * Goals & Ranked Priorities
 *
 * Shows strategic business goals with milestone pacing and
 * ranked executive recommendations from the priority engine.
 */
export function GoalsPanel({ goals, recommendations, loading, error, onProposeAction }: Props) {
  if (loading) return <CardSkeleton />;
  if (error) return <SectionError message={error} />;

  const progressColor: Record<Goal["status"], string> = {
    ACHIEVED: "bg-emerald-500",
    ON_TRACK: "bg-violet-600",
    AT_RISK: "bg-amber-500",
    BEHIND: "bg-red-500",
    DRAFT: "bg-gray-400",
    MISSED: "bg-red-700",
    CANCELLED: "bg-gray-600",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Goals */}
      <section aria-label="Strategic Business Goals" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <SectionHeading
          title="Strategic Goals"
          subtitle="Milestone pacing monitor"
        />
        {goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No strategic goals configured"
            description="Add business goals to track progress toward revenue, pipeline, and other strategic targets."
          />
        ) : (
          <div className="space-y-4">
            {goals.map((g) => (
              <div
                key={g.id ?? g.title}
                className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{g.title}</span>
                  <StatusBadge status={g.status} />
                </div>

                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    role="progressbar"
                    aria-valuenow={g.progressPct ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className={`h-2 rounded-full transition-all ${progressColor[g.status]}`}
                    style={{ width: `${Math.min(100, g.progressPct ?? 0)}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {g.currentValue.toLocaleString()} / {g.targetValue.toLocaleString()}{" "}
                    {g.unit ?? ""}
                  </span>
                  <span>{g.progressPct ?? 0}% complete</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ranked Recommendations */}
      <section aria-label="Ranked Executive Priorities" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <SectionHeading
          title="Ranked Priorities"
          subtitle="Deterministic priority engine"
        />
        {recommendations.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No active recommendations"
            description="The priority engine has no active recommendations at this time."
          />
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id ?? rec.title}
                className="rounded-xl border border-border bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={rec.priorityLevel ?? "MEDIUM"} />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                      {rec.domain}
                    </span>
                    {rec.priorityScore != null && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({rec.priorityScore} pts)
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{rec.status}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground">{rec.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {rec.executiveSummary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Impact: {rec.expectedImpact}
                  </span>
                  {rec.status === "ACTIVE" && rec.id && onProposeAction && (
                    <button
                      onClick={() => onProposeAction(rec.id)}
                      className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition"
                    >
                      Stage Governed Action
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
