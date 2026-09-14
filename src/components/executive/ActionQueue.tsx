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

interface ActionPlan {
  id: string;
  title: string;
  description: string;
  domain: string;
  priority: string;
  priorityScore: number;
  status: string;
  governanceVerdict: string;
  whyNow: string;
  expectedImpact: string;
  requiredAuthority: string;
  pendingActionId?: string;
}

interface PendingAction {
  id: string;
  actionName: string;
  humanDescription: string;
  riskLevel?: string;
}

interface ActionSummary {
  totalPlans?: number;
  pendingApprovalCount?: number;
  blockedCount?: number;
  priorityBreakdown?: { critical?: number; high?: number };
}

interface Props {
  actionPlans: ActionPlan[];
  pendingActions: PendingAction[];
  actionSummary: ActionSummary | null;
  loading: boolean;
  error?: string;
  onSynthesizePlans: () => Promise<void>;
  onApproveActionPlan: (id: string) => Promise<void>;
  onDeferActionPlan: (id: string) => Promise<void>;
  onRejectActionPlan: (id: string, reason: string) => Promise<void>;
  onApprovePendingAction: (id: string) => Promise<void>;
  onRejectPendingAction: (id: string) => Promise<void>;
}

/**
 * WHAT ACTION SHOULD BE CONSIDERED?
 *
 * Shows executive action plans (from action-planner) and the human-gated
 * pending action queue (from ActionEngine). The human approval gate is
 * preserved — no action executes without explicit approval.
 *
 * BLOCKED plans: no approve button rendered. Governance is enforced on the
 * server; we do not allow UI bypass.
 */
export function ActionQueue({
  actionPlans,
  pendingActions,
  actionSummary,
  loading,
  error,
  onSynthesizePlans,
  onApproveActionPlan,
  onDeferActionPlan,
  onRejectActionPlan,
  onApprovePendingAction,
  onRejectPendingAction,
}: Props) {
  const { addToast } = useToast();
  const [synthesizing, setSynthesizing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; title: string } | null>(null);
  const [rejectingPendingId, setRejectingPendingId] = useState<string | null>(null);
  const [approvingPendingId, setApprovingPendingId] = useState<string | null>(null);

  async function handleSynthesize() {
    setSynthesizing(true);
    try {
      await onSynthesizePlans();
      addToast("Action plans synthesized successfully.", "success");
    } catch (e: any) {
      addToast(e.message || "Failed to synthesize action plans.", "error");
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      await onApproveActionPlan(id);
      addToast("Action plan approved and staged to execution queue.", "success");
    } catch (e: any) {
      addToast(e.message || "Approval failed.", "error");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDefer(id: string) {
    setApprovingId(id);
    try {
      await onDeferActionPlan(id);
      addToast("Action plan deferred.", "info");
    } catch (e: any) {
      addToast(e.message || "Defer failed.", "error");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectDialog) return;
    const id = rejectDialog.id;
    setRejectDialog(null);
    setApprovingId(id);
    try {
      await onRejectActionPlan(id, reason);
      addToast("Action plan rejected.", "info");
    } catch (e: any) {
      addToast(e.message || "Rejection failed.", "error");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleApprovePending(id: string) {
    setApprovingPendingId(id);
    try {
      await onApprovePendingAction(id);
      addToast("Action approved. Executing now.", "success");
    } catch (e: any) {
      addToast(e.message || "Approval failed.", "error");
    } finally {
      setApprovingPendingId(null);
    }
  }

  async function handleRejectPending(id: string) {
    setRejectingPendingId(id);
    try {
      await onRejectPendingAction(id);
      addToast("Action rejected.", "info");
    } catch (e: any) {
      addToast(e.message || "Rejection failed.", "error");
    } finally {
      setRejectingPendingId(null);
    }
  }

  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <SectionError message={error} />;

  const DECIDED_STATUSES = ["APPROVED", "REJECTED", "DEFERRED", "EXECUTING", "COMPLETED", "CANCELLED"];

  return (
    <section aria-label="Recommended Actions" className="space-y-6">
      {/* Pending Action Execution Queue (human gate) */}
      {pendingActions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800 p-6 shadow-sm space-y-4">
          <SectionHeading
            title="Governed Actions Awaiting Approval"
            subtitle="These actions cannot execute without explicit human approval. No execution has occurred."
            badge={
              <div className="flex items-center gap-1.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {pendingActions.length} Pending
                </span>
              </div>
            }
          />

          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-200/70 bg-white dark:bg-amber-950/20 p-4 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={action.riskLevel ?? "MEDIUM"} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase font-mono">
                      {action.actionName}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {action.humanDescription}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprovePending(action.id)}
                    disabled={approvingPendingId === action.id}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
                  >
                    {approvingPendingId === action.id ? "Approving..." : "Approve & Execute"}
                  </button>
                  <button
                    onClick={() => handleRejectPending(action.id)}
                    disabled={rejectingPendingId === action.id}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive Action Plans */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <SectionHeading
          title="Recommended Actions"
          subtitle="AI-synthesized plans, governance-checked, pending human approval before any execution"
          badge={
            actionSummary && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
                {(actionSummary.priorityBreakdown?.critical ?? 0) > 0 && (
                  <span className="text-red-700">
                    {actionSummary.priorityBreakdown!.critical} Critical
                  </span>
                )}
                <span className="text-muted-foreground">|</span>
                <span className="text-violet-700">
                  {actionSummary.pendingApprovalCount ?? 0} Awaiting Approval
                </span>
                {(actionSummary.blockedCount ?? 0) > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">
                      {actionSummary.blockedCount} Governance Blocked
                    </span>
                  </>
                )}
              </div>
            )
          }
          action={
            <button
              onClick={handleSynthesize}
              disabled={synthesizing}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
            >
              {synthesizing ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  Synthesizing...
                </>
              ) : (
                <>⚡ Synthesize Action Plans</>
              )}
            </button>
          }
        />

        {actionPlans.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No active action plans"
            description="Click 'Synthesize Action Plans' to analyze current telemetry, forecasts, and risks to generate prioritized recommendations."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actionPlans.map((plan) => {
              const isBlocked = plan.governanceVerdict === "BLOCKED";
              const isDecided = DECIDED_STATUSES.includes(plan.status);
              const loading = approvingId === plan.id;

              return (
                <article
                  key={plan.id}
                  className={`rounded-xl border p-4 space-y-3 shadow-sm transition flex flex-col justify-between ${
                    plan.status === "APPROVED"
                      ? "border-emerald-200 bg-emerald-50/20"
                      : isBlocked
                      ? "border-red-200 bg-red-50/20 opacity-80"
                      : "border-border bg-card hover:border-violet-200"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={plan.priority} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                          {plan.domain}
                        </span>
                      </div>
                      <GovernanceBadge verdict={plan.governanceVerdict} />
                    </div>

                    <div>
                      <h3 className="text-sm font-extrabold text-foreground leading-snug">
                        {plan.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5 border border-border space-y-1">
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">
                        ⏳ Why Now
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {plan.whyNow}
                      </p>
                    </div>

                    <div className="text-[11px] space-y-1 pt-1">
                      <div className="flex items-start justify-between text-muted-foreground">
                        <span className="font-semibold text-foreground">Expected Impact:</span>
                        <span className="font-medium text-right text-foreground ml-2">
                          {plan.expectedImpact}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Required Authority:</span>
                        <span className="font-bold text-foreground">{plan.requiredAuthority}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Priority Score:</span>
                        <span className="font-mono font-bold text-foreground">
                          {plan.priorityScore} pts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Decision controls */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    {isDecided ? (
                      <div className="w-full flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Status:</span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={plan.status} />
                          {plan.pendingActionId && (
                            <span className="text-[10px] text-muted-foreground">
                              (Staged to ActionEngine)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : isBlocked ? (
                      <div className="w-full text-center text-xs font-bold text-red-700 dark:text-red-400 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                        🔒 Blocked by Governance Policy
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(plan.id)}
                          disabled={loading}
                          className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                        >
                          {loading ? "Approving..." : "Approve & Stage"}
                        </button>
                        <button
                          onClick={() => handleDefer(plan.id)}
                          disabled={loading}
                          className="rounded-lg bg-muted px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50 transition"
                        >
                          Defer
                        </button>
                        <button
                          onClick={() => setRejectDialog({ id: plan.id, title: plan.title })}
                          disabled={loading}
                          className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Rejection dialog — replaces prompt() */}
      <ConfirmDialog
        open={!!rejectDialog}
        title={`Reject: ${rejectDialog?.title ?? ""}`}
        description="Provide a reason for rejecting this action plan. This will be recorded in the executive memory for learning."
        reasonLabel="Rejection Reason"
        confirmLabel="Reject Action Plan"
        cancelLabel="Cancel"
        destructive
        onConfirm={(reason) => handleRejectConfirm(reason ?? "")}
        onCancel={() => setRejectDialog(null)}
      />
    </section>
  );
}
