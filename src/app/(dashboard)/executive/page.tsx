"use client";

import { useState, useEffect, useCallback } from "react";
import { ExecutivePageSkeleton } from "@/components/executive/ExecutiveSkeleton";
import { SectionError } from "@/components/executive/ExecutiveShared";
import { ExecutiveSnapshot } from "@/components/executive/ExecutiveSnapshot";
import { ValueScorecard } from "@/components/executive/ValueScorecard";
import { AttentionPanel } from "@/components/executive/AttentionPanel";
import { ActionQueue } from "@/components/executive/ActionQueue";
import { DecisionQueue } from "@/components/executive/DecisionQueue";
import { ForecastPanel } from "@/components/executive/ForecastPanel";
import { OutcomesPanel } from "@/components/executive/OutcomesPanel";
import { GoalsPanel } from "@/components/executive/GoalsPanel";
import { useToast } from "@/components/ui/Toast";

import type { BusinessContext, ExecutiveRecommendationData, BusinessGoalData } from "@/ai/executive/types";
import type { ExecutiveBriefing, ExecutiveEventData } from "@/ai/executive/events/types";
import type { ExecutiveOutcomeData, HistoricalDecisionSummary } from "@/ai/executive/outcomes/types";

/**
 * Executive Command Center — Phase 36
 *
 * This is the shell page. It:
 * 1. Fetches all executive data via a single primary call to /api/executive/operating-state
 *    plus targeted supplemental calls for data not in the aggregate.
 * 2. Delegates all rendering to focused section components.
 * 3. Passes handlers down as props — no component makes its own mutations silently.
 * 4. Uses toast notifications (not alert()) for all user feedback.
 * 5. Never bypasses the human approval gate.
 */
export default function ExecutivePage() {
  const { addToast } = useToast();

  // ── Primary data state ──────────────────────────────────────────────────
  const [operatingState, setOperatingState] = useState<any>(null);
  const [valueSynthesis, setValueSynthesis] = useState<any>(null);
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [context, setContext] = useState<BusinessContext | null>(null);

  // ── Section data state ──────────────────────────────────────────────────
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [actionSummary, setActionSummary] = useState<any | null>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [forecastSummary, setForecastSummary] = useState<any | null>(null);
  const [outcomes, setOutcomes] = useState<ExecutiveOutcomeData[]>([]);
  const [performance, setPerformance] = useState<HistoricalDecisionSummary | null>(null);
  const [goals, setGoals] = useState<BusinessGoalData[]>([]);
  const [recommendations, setRecommendations] = useState<ExecutiveRecommendationData[]>([]);
  const [events, setEvents] = useState<ExecutiveEventData[]>([]);

  // ── UI state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [reasoningLoading, setReasoningLoading] = useState(false);

  // ── AI Chat ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    setLoading(true);
    setError(null);

    // 1. Primary Unified Aggregate: Single aggregated call containing complete executive read model
    const url = forceRefresh ? "/api/executive/dashboard?refresh=true" : "/api/executive/dashboard";

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const state = data.operatingState ?? null;
        setOperatingState(state);
        setValueSynthesis(data.valueSynthesis ?? null);

        if (data.briefing) setBriefing(data.briefing);
        if (data.outcomes) setOutcomes(data.outcomes);
        if (data.recommendations) setRecommendations(data.recommendations);
        if (data.events) setEvents(data.events);

        if (state) {
          // Hydrate core panels directly from primary operating state
          if (state.businessContext) {
            setContext(state.businessContext);
            setGoals(state.businessContext.goals ?? []);
            if (state.businessContext.historicalPerformance) {
              setPerformance(state.businessContext.historicalPerformance);
            }
          }
          if (state.activeDecisions) {
            setDecisions(state.activeDecisions);
          }
          if (state.actionPlans) {
            setActionPlans(state.actionPlans);
            setActionSummary({
              total: state.actionPlans.length,
              proposed: state.actionPlans.filter((a: any) => a.status === "PROPOSED").length,
              approved: state.actionPlans.filter((a: any) => a.status === "APPROVED").length,
              executing: state.actionPlans.filter((a: any) => a.status === "EXECUTING").length,
            });
          }
          if (state.pendingActions) {
            setPendingActions(state.pendingActions);
          }
          if (state.activeForecasts) {
            setForecastSummary({
              total: state.activeForecasts.length,
              forecasts: state.activeForecasts,
            });
          }
        }

        // Drop global skeleton immediately with all data loaded
        setLoading(false);
      })
      .catch((e: any) => {
        console.error("[Dashboard] Primary load failed:", e);
        setError(e.message || "Failed to load executive dashboard data");
        setLoading(false);
      });
  }, []);

  // Selective refresh: pending actions only (for the human gate queue)
  const refreshPendingActions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/actions?status=WAITING");
      if (res.ok) {
        const { data } = await res.json();
        setPendingActions(data ?? []);
      }
    } catch {
      // silent — non-critical background refresh
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Polling only runs when there are known pending actions to watch
  useEffect(() => {
    if (pendingActions.length === 0) return;
    const interval = setInterval(refreshPendingActions, 10000);
    return () => clearInterval(interval);
  }, [pendingActions.length, refreshPendingActions]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleRefreshBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch("/api/executive/briefing", { method: "POST" });
      if (res.ok) {
        const { briefing: b } = await res.json();
        setBriefing(b);
        addToast("Executive briefing refreshed.", "success");
        await fetchDashboardData();
      } else {
        const err = await res.json();
        addToast(err.error ?? "Failed to refresh briefing.", "error");
      }
    } catch (e: any) {
      addToast(e.message ?? "Briefing refresh failed.", "error");
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleRunDecisionEngine = async () => {
    setReasoningLoading(true);
    try {
      const res = await fetch("/api/executive/recommendations", { method: "POST" });
      if (res.ok) {
        addToast("Decision engine analysis complete.", "success");
        await fetchDashboardData();
      } else {
        const err = await res.json();
        addToast(err.error ?? "Decision engine run failed.", "error");
      }
    } catch (e: any) {
      addToast(e.message ?? "Decision engine failed.", "error");
    } finally {
      setReasoningLoading(false);
    }
  };

  // Action plan handlers
  const handleSynthesizePlans = async () => {
    const res = await fetch("/api/executive/actions", { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to synthesize action plans");
    }
    await fetchDashboardData();
  };

  const handleApproveActionPlan = async (id: string) => {
    const res = await fetch(`/api/executive/actions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stagePendingAction: true }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Approval failed");
    }
    await fetchDashboardData();
  };

  const handleDeferActionPlan = async (id: string) => {
    const res = await fetch(`/api/executive/actions/${id}/defer`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Defer failed");
    }
    await fetchDashboardData();
  };

  const handleRejectActionPlan = async (id: string, reason: string) => {
    const res = await fetch(`/api/executive/actions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Rejection failed");
    }
    await fetchDashboardData();
  };

  const handleApprovePendingAction = async (id: string) => {
    const res = await fetch(`/api/ai/actions/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Approval failed");
    }
    await fetchDashboardData();
  };

  const handleRejectPendingAction = async (id: string) => {
    const res = await fetch(`/api/ai/actions/${id}/reject`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Rejection failed");
    }
    await fetchDashboardData();
  };

  // Decision handlers
  const handleApproveDecision = async (id: string) => {
    const res = await fetch(`/api/executive/decisions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionReason: "Approved from Executive Command Center.",
        conversationId,
        stagePendingAction: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Approval failed");
    }
    await fetchDashboardData();
  };

  const handleDeferDecision = async (id: string) => {
    const res = await fetch(`/api/executive/decisions/${id}/defer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deferralReason: "Deferred from Executive Command Center." }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Defer failed");
    }
    await fetchDashboardData();
  };

  const handleRejectDecision = async (id: string, reason: string) => {
    const res = await fetch(`/api/executive/decisions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Rejection failed");
    }
    await fetchDashboardData();
  };

  // Forecast refresh
  const handleRefreshForecasts = async () => {
    const res = await fetch("/api/executive/forecasts", { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Forecast generation failed");
    }
    const data = await res.json();
    setForecastSummary(data.summary ?? null);
  };

  // Outcome evaluation
  const handleEvaluateOutcome = async (outcomeId: string) => {
    const res = await fetch(`/api/executive/outcomes/${outcomeId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceEarly: true }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Evaluation failed");
    }
    await fetchDashboardData();
  };

  // Stage governed action from recommendation
  const handleProposeAction = async (recId: string) => {
    const res = await fetch(`/api/executive/recommendations/${recId}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    if (!res.ok) {
      const err = await res.json();
      addToast(err.error ?? "Failed to stage action.", "error");
      return;
    }
    addToast("Governed action staged for approval.", "success");
    await fetchDashboardData();
  };

  // AI Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = { role: "user", content: chatInput };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, conversationId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply ?? "Analysis completed." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Apologies, I encountered an issue accessing the executive reasoning framework.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection lost to executive intelligence service." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const measuringOutcomes = outcomes.filter((o) => o.status === "MEASURING");
  const completedOutcomes = outcomes.filter((o) => o.status === "MEASURED");
  const attentionItems = valueSynthesis?.attentionItems ?? [];
  const pendingDecisions = decisions.filter(
    (d) => d.status === "PENDING" || d.status === "DEFERRED" || d.status === "BLOCKED"
  );

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) return <ExecutivePageSkeleton />;

  return (
    <div className="space-y-8 pb-20">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Executive Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time business telemetry, decision intelligence & learning loop
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshBriefing}
            disabled={briefingLoading}
            id="btn-refresh-briefing"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm disabled:opacity-50 transition"
          >
            {briefingLoading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
            ) : (
              <span>⚡</span>
            )}
            Refresh Briefing
          </button>

          <button
            onClick={handleRunDecisionEngine}
            disabled={reasoningLoading}
            id="btn-run-decision-engine"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 shadow-sm disabled:opacity-50 transition"
          >
            {reasoningLoading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" />
            ) : (
              <span>🧠</span>
            )}
            Run Decision Engine
          </button>
        </div>
      </header>

      {/* ── Top-level error ──────────────────────────────────────────────── */}
      {error && <SectionError title="Executive data unavailable" message={error} onRetry={fetchDashboardData} />}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1: WHAT IS HAPPENING?
          Executive Snapshot — health, summary, top opportunity/risk/forecast
          ══════════════════════════════════════════════════════════════════ */}
      <ExecutiveSnapshot
        operatingState={operatingState}
        valueSynthesis={valueSynthesis}
        briefing={briefing}
        forecastSummary={forecastSummary}
        loading={false}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2: COMMERCIAL VALUE SCORECARD
          Activity counts vs. attributed value — evidence-gated
          ══════════════════════════════════════════════════════════════════ */}
      <ValueScorecard valueSynthesis={valueSynthesis} loading={false} />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3: WHAT DESERVES ATTENTION?
          Deterministic priority ranking from operating state synthesis
          ══════════════════════════════════════════════════════════════════ */}
      <AttentionPanel items={attentionItems} loading={false} />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4: WHAT ACTION SHOULD BE CONSIDERED?
          Action plans + pending actions (human approval gate)
          ══════════════════════════════════════════════════════════════════ */}
      <ActionQueue
        actionPlans={actionPlans}
        pendingActions={pendingActions}
        actionSummary={actionSummary}
        loading={false}
        onSynthesizePlans={handleSynthesizePlans}
        onApproveActionPlan={handleApproveActionPlan}
        onDeferActionPlan={handleDeferActionPlan}
        onRejectActionPlan={handleRejectActionPlan}
        onApprovePendingAction={handleApprovePendingAction}
        onRejectPendingAction={handleRejectPendingAction}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5: HUMAN DECISION QUEUE
          Decisions requiring explicit executive judgment
          BLOCKED decisions: governance message only, no approve button
          ══════════════════════════════════════════════════════════════════ */}
      <DecisionQueue
        decisions={decisions}
        loading={false}
        onApprove={handleApproveDecision}
        onDefer={handleDeferDecision}
        onReject={handleRejectDecision}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 6: WHAT IS LIKELY TO HAPPEN NEXT?
          Forecasts — explicitly labeled, uncertainty ranges shown
          ══════════════════════════════════════════════════════════════════ */}
      <ForecastPanel
        forecastSummary={forecastSummary}
        loading={false}
        onRefresh={handleRefreshForecasts}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 7: WHAT HAPPENED? (Outcomes & Learning)
          Phase 35 attribution semantics preserved
          CORRELATED ≠ ROI. DIRECT_CAUSAL only path for value attribution.
          ══════════════════════════════════════════════════════════════════ */}
      <OutcomesPanel
        measuringOutcomes={measuringOutcomes}
        completedOutcomes={completedOutcomes}
        performance={performance}
        loading={false}
        onEvaluateOutcome={handleEvaluateOutcome}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 8: GOALS & RANKED PRIORITIES
          Strategic goal pacing and priority recommendations
          ══════════════════════════════════════════════════════════════════ */}
      <GoalsPanel
        goals={goals}
        recommendations={recommendations}
        loading={false}
        onProposeAction={handleProposeAction}
      />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 9: PROACTIVE BUSINESS EVENTS
          Anomalies and detected events — dismiss individually
          ══════════════════════════════════════════════════════════════════ */}
      {events.length > 0 && (
        <section aria-label="Business Events" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Business Events</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {events.length} active
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Deterministic event detection & deduplication
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {events.map((ev) => (
              <div
                key={ev.id ?? ev.fingerprint}
                className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        ev.severity === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : ev.severity === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {ev.severity} · {ev.domain}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ev.occurredAt ? new Date(ev.occurredAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-foreground">{ev.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ev.summary}</p>
                </div>
                {ev.id && (
                  <div className="flex justify-end pt-2 border-t border-border">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/executive/events/${ev.id}/resolve`, {
                            method: "POST",
                          });
                          if (res.ok) {
                            setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                            addToast("Event dismissed.", "info");
                          }
                        } catch {
                          addToast("Failed to dismiss event.", "error");
                        }
                      }}
                      className="rounded-md bg-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 10: EXECUTIVE AI ASSISTANT
          Grounded in business context — at the bottom, not the top
          ══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Executive AI Assistant" className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">Executive AI Assistant</h2>
          <span className="text-xs text-muted-foreground">Grounded in your business context</span>
        </div>

        <div
          className="h-64 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4 space-y-3"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
              Ask strategic business questions — e.g. &ldquo;What is causing our pipeline lag?&rdquo;
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-none"
                      : "bg-card text-foreground border border-border rounded-bl-none shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a strategic executive question..."
            aria-label="Executive AI chat input"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/80 disabled:opacity-50 transition"
          >
            {chatLoading ? "Reasoning..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
