"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface SectionErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Inline error state for a section that failed to load.
 * Does not unmount the rest of the page.
 */
export function SectionError({
  title = "Unable to load this section",
  message = "An error occurred while fetching data. Please try again.",
  onRetry,
}: SectionErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-6 flex items-start gap-4"
    >
      <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-red-900 dark:text-red-300">{title}</p>
        <p className="text-xs text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white dark:bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 transition-colors shrink-0"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Meaningful empty state for executive sections.
 * Never shows zeros or blank space — explains why data is absent.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
      {icon && <div className="text-3xl">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/**
 * Status badge component with accessible text.
 * Never relies solely on color for communication — always includes text label.
 */
export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
    HIGH: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    MEDIUM: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    LOW: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    // Governance verdicts
    ALLOWED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ALLOWED_WITH_WARNING: "bg-amber-100 text-amber-800 border-amber-200",
    REQUIRES_ESCALATION: "bg-purple-100 text-purple-800 border-purple-200",
    BLOCKED: "bg-red-100 text-red-800 border-red-200",
    INSUFFICIENT_EVIDENCE: "bg-slate-100 text-slate-700 border-slate-200",
    // Statuses
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
    DEFERRED: "bg-slate-100 text-slate-700 border-slate-200",
    EXECUTING: "bg-blue-100 text-blue-800 border-blue-200",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
    EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
    PROPOSED: "bg-violet-100 text-violet-800 border-violet-200",
    PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-200",
    // Attribution
    DIRECT_CAUSAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
    CORRELATED: "bg-amber-100 text-amber-800 border-amber-200",
    INCONCLUSIVE: "bg-slate-100 text-slate-700 border-slate-200",
    // Health
    HEALTHY: "bg-emerald-100 text-emerald-800 border-emerald-200",
    STABLE: "bg-blue-100 text-blue-800 border-blue-200",
    ATTENTION_NEEDED: "bg-amber-100 text-amber-800 border-amber-200",
    CRITICAL_ATTENTION: "bg-red-100 text-red-800 border-red-200",
    // Goals
    ON_TRACK: "bg-blue-100 text-blue-800 border-blue-200",
    AT_RISK: "bg-amber-100 text-amber-800 border-amber-200",
    ACHIEVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    BEHIND: "bg-red-100 text-red-800 border-red-200",
  };

  const style =
    styles[status] ?? "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style} ${className}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/**
 * Governance verdict badge — extra prominent for BLOCKED state.
 */
export function GovernanceBadge({ verdict }: { verdict: string }) {
  if (verdict === "BLOCKED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-800">
        🔒 GOVERNANCE BLOCKED
      </span>
    );
  }
  return <StatusBadge status={verdict} />;
}

/** Section heading with consistent styling */
export function SectionHeading({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
