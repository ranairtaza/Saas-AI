"use client";

import { ListSkeleton } from "@/components/executive/ExecutiveSkeleton";
import {
  SectionError,
  EmptyState,
  SectionHeading,
  StatusBadge,
  GovernanceBadge,
} from "@/components/executive/ExecutiveShared";

interface AttentionItem {
  id: string;
  title: string;
  domain: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  whyNow: string;
  businessImpact?: number;
  governanceVerdict?: string;
}

interface Props {
  items: AttentionItem[];
  loading: boolean;
  error?: string;
}

/**
 * WHAT DESERVES ATTENTION?
 *
 * Deterministic priority ranking from the operating state synthesis.
 * No frontend scoring — all ranking is done server-side.
 * GOVERNANCE BLOCKED items are shown but have no action buttons.
 */
export function AttentionPanel({ items, loading, error }: Props) {
  if (loading) return <ListSkeleton rows={2} />;
  if (error) return <SectionError message={error} />;
  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <SectionHeading
          title="Attention Required"
          subtitle="Items that require executive awareness, ranked by business impact"
          badge={<StatusBadge status="LOW" />}
        />
        <div className="mt-4">
          <EmptyState
            icon="✅"
            title="No executive attention items at this time"
            description="The operating system has detected no critical anomalies, governance violations, or risks requiring immediate attention."
          />
        </div>
      </div>
    );
  }

  const criticalCount = items.filter((i) => i.priority === "CRITICAL").length;
  const highCount = items.filter((i) => i.priority === "HIGH").length;

  return (
    <section aria-label="Attention Required" className="rounded-2xl border border-rose-200 bg-rose-50/30 dark:bg-rose-950/20 dark:border-rose-900 p-6 shadow-sm space-y-4">
      <SectionHeading
        title="Attention Required"
        subtitle="Deterministic priority ranking — no AI scoring in this view"
        badge={
          <div className="flex items-center gap-1.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
            <span className="rounded-full bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
              {items.length} Items
            </span>
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800">
                {criticalCount} Critical
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => {
          const isBlocked = item.governanceVerdict === "BLOCKED";
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between md:items-start transition-colors ${
                item.priority === "CRITICAL"
                  ? "border-red-200 bg-white dark:bg-red-950/10"
                  : item.priority === "HIGH"
                  ? "border-amber-200 bg-white dark:bg-amber-950/10"
                  : "border-rose-200/60 bg-white"
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.priority} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    {item.domain}
                  </span>
                  {isBlocked && <GovernanceBadge verdict="BLOCKED" />}
                </div>
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.whyNow}</p>
              </div>

              {item.businessImpact != null && (
                <div className="text-right shrink-0 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 px-3 py-2">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                    Business Impact
                  </span>
                  <span className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">
                    ${item.businessImpact.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
