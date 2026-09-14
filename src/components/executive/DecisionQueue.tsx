"use client";

import { useState } from "react";
import { ListSkeleton } from "@/components/executive/ExecutiveSkeleton";
import {
  SectionError,
  EmptyState,
  SectionHeading,
  StatusBadge,
  GovernanceBadge,
} from "@/components/executive/ExecutiveShared";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface Decision {
  id: string;
  title: string;
  description: string;
  domain: string;
  priority: string;
  status: string;
  governanceVerdict: string;
  governanceExplanation?: string;
  requiredAuthority: string;
  riskScore: number;
  financialExposure?: number;
  evidenceConfidence: number;
}

interface Props {
  decisions: Decision[];
  loading: boolean;
  error?: string;
  onApprove: (id: string) => Promise<void>;
  onDefer: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

/**
 * HUMAN DECISION QUEUE
 *
 * Executive decisions requiring human judgment.
 * BLOCKED decisions (governanceVerdict === 'BLOCKED') cannot be approved —
 * no approve button is rendered for them.
 *
 * Rejection reason entered via dialog (not prompt()).
 */
export function DecisionQueue({ decisions, loading, error, onApprove, onDefer, onReject }: Props) {
  const { addToast } = useToast();
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; title: string } | null>(null);

  const actionable = decisions.filter(
    (d) => d.status === "PENDING" || d.status === "DEFERRED" || d.status === "BLOCKED"
  );

  if (loading) return <ListSkeleton rows={2} />;
  if (error) return <SectionError message={error} />;
  if (actionable.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <SectionHeading
          title="Decision Queue"
          subtitle="Executive decisions requiring human judgment before any action is taken"
        />
        <div className="mt-4">
          <EmptyState
            icon="✅"
            title="No pending executive decisions"
            description="All decisions have been resolved. New decisions will appear here when the system identifies situations requiring executive judgment."
          />
        </div>
      </div>
    );
  }

  async function handleApprove(id: string) {
    setDecidingId(id);
    try {
      await onApprove(id);
      addToast("Decision approved.", "success");
    } catch (e: any) {
      addToast(e.message || "Approval failed.", "error");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleDefer(id: string) {
    setDecidingId(id);
    try {
      await onDefer(id);
      addToast("Decision deferred for later review.", "info");
    } catch (e: any) {
      addToast(e.message || "Defer failed.", "error");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectDialog) return;
    const id = rejectDialog.id;
    setRejectDialog(null);
    setDecidingId(id);
    try {
      await onReject(id, reason);
      addToast("Decision rejected.", "info");
    } catch (e: any) {
      addToast(e.message || "Rejection failed.", "error");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <section aria-label="Decision Queue" className="rounded-2xl border border-violet-200/70 bg-violet-50/20 dark:bg-violet-950/10 dark:border-violet-900 p-6 shadow-sm space-y-4">
      <SectionHeading
        title="Decision Queue"
        subtitle="Executive decisions requiring human judgment"
        badge={
          <div className="flex items-center gap-1.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse" />
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-0.5 text-[10px] font-bold text-violet-800 dark:text-violet-300">
              {actionable.length} Decisions
            </span>
          </div>
        }
      />

      <div className="space-y-3">
        {actionable.map((dec) => {
          const isBlocked = dec.governanceVerdict === "BLOCKED" || dec.status === "BLOCKED";
          const loading = decidingId === dec.id;

          return (
            <div
              key={dec.id}
              className={`flex flex-col md:flex-row md:items-start justify-between gap-4 rounded-xl border p-4 shadow-sm ${
                isBlocked
                  ? "border-red-200 bg-red-50/30 dark:bg-red-950/10"
                  : "border-violet-200/60 bg-white dark:bg-violet-950/5"
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={dec.priority} />
                  <GovernanceBadge verdict={dec.governanceVerdict} />
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    AUTH: {dec.requiredAuthority}
                  </span>
                  {dec.status === "DEFERRED" && (
                    <StatusBadge status="DEFERRED" />
                  )}
                </div>

                <h3 className="text-sm font-bold text-foreground">{dec.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{dec.description}</p>

                {dec.governanceExplanation && (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/30 p-2 rounded border border-border">
                    {dec.governanceExplanation}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-muted-foreground font-mono">
                  <span>
                    Domain: <b className="text-foreground">{dec.domain}</b>
                  </span>
                  <span>
                    Risk: <b className="text-foreground">{dec.riskScore}/100</b>
                  </span>
                  {dec.financialExposure != null && (
                    <span>
                      Exposure:{" "}
                      <b className="text-foreground">${dec.financialExposure.toLocaleString()}</b>
                    </span>
                  )}
                  <span>
                    Evidence Confidence:{" "}
                    <b className="text-foreground">{dec.evidenceConfidence}%</b>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-start mt-2 md:mt-0">
                {isBlocked ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400">
                    🔒 Governance Blocked
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(dec.id)}
                      disabled={loading}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40 transition shadow-sm"
                    >
                      {loading ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleDefer(dec.id)}
                      disabled={loading}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition"
                    >
                      Defer
                    </button>
                    <button
                      onClick={() => setRejectDialog({ id: dec.id, title: dec.title })}
                      disabled={loading}
                      className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!rejectDialog}
        title={`Reject Decision: ${rejectDialog?.title ?? ""}`}
        description="Provide a reason for rejecting this decision. This will be logged and may inform future recommendations."
        reasonLabel="Rejection Reason"
        confirmLabel="Reject Decision"
        cancelLabel="Cancel"
        destructive
        onConfirm={(reason) => handleRejectConfirm(reason ?? "")}
        onCancel={() => setRejectDialog(null)}
      />
    </section>
  );
}
