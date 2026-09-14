"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  MessageSquare, 
  RefreshCw, 
  Zap, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  UserCheck, 
  FileText, 
  Activity 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DeterministicScoringEngine } from "@/lib/leads/scoring/engine";
import { WorkflowRecommendation } from "@/lib/leads/workflow/types";
import { OutreachCard } from "./outreach-card";
import { EnrichmentCard } from "./enrichment-card";

export function LeadDetailClient({ lead, users, activities }: { lead: any; users: any[]; activities: any[] }) {
  const router = useRouter();
  const [currentLead, setCurrentLead] = useState(lead);
  const [isUpdating, setIsUpdating] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [persistenceNotice, setPersistenceNotice] = useState<string | null>(null);

  // Workflow Recommendations State
  const [recommendations, setRecommendations] = useState<WorkflowRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [isProposingAction, setIsProposingAction] = useState(false);
  const [proposalSuccessMessage, setProposalSuccessMessage] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsLoadingRecs(true);
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (e) {
      console.error('Failed to load recommendations:', e);
    } finally {
      setIsLoadingRecs(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [currentLead.id, currentLead.score, currentLead.status, currentLead.ownerId]);

  const updateLead = async (field: string, value: string | null) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${currentLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        setCurrentLead((prev: any) => ({ ...prev, [field]: value }));
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent })
      });
      if (res.ok) {
        setNoteContent("");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const enrichLead = async () => {
    setIsUpdating(true);
    setPersistenceNotice(null);
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/enrich`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        if (data.lead) {
          setCurrentLead(data.lead);
        }
        if (data.persisted) {
          setPersistenceNotice("Persisted: Changes successfully saved to database.");
          router.refresh();
        } else {
          setPersistenceNotice(data.message || "Qualification computed, but persistence is disabled until the LeadMachine database is configured.");
        }
      } else {
        alert(data.error || "Enrichment failed");
      }
    } catch (e) {
      console.error(e);
      alert("Enrichment error");
    } finally {
      setIsUpdating(false);
    }
  };

  const proposeAction = async (rec: WorkflowRecommendation) => {
    setIsProposingAction(true);
    setProposalSuccessMessage(null);
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionName: rec.actionName,
          parameters: rec.parameters,
          conversationId: 'workflow-recommendation'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProposalSuccessMessage(
          data.persisted
            ? `Action proposed for human approval: "${rec.title}". View in Actions tab to approve.`
            : `Action simulated in-memory: "${rec.title}" (database writes disabled).`
        );
        // Remove proposed recommendation from current list
        setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      } else {
        alert(data.error || "Failed to propose action");
      }
    } catch (e) {
      console.error("Error proposing action:", e);
      alert("Error proposing action");
    } finally {
      setIsProposingAction(false);
    }
  };

  // Parse AI Summary JSON
  let aiData = null;
  if (currentLead.aiSummary) {
    try {
      aiData = JSON.parse(currentLead.aiSummary);
    } catch (e) {
      // old format or invalid
    }
  }

  return (
    <div className="space-y-6">
      {/* Sidebar - Controls */}
      <div className="glass rounded-2xl shadow-sm border border-border p-6 space-y-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Pipeline Status</label>
          <select 
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none cursor-pointer"
            value={currentLead.status}
            onChange={(e) => updateLead('status', e.target.value)}
            disabled={isUpdating}
          >
            <option value="DISCOVERED">DISCOVERED</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="PROPOSAL">PROPOSAL</option>
            <option value="WON">WON</option>
            <option value="LOST">LOST</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Assigned Owner</label>
          <select 
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none cursor-pointer"
            value={currentLead.ownerId || ""}
            onChange={(e) => updateLead('ownerId', e.target.value || null)}
            disabled={isUpdating}
          >
            <option value="">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Workflow Recommendations Section (Phase 19 MVP) */}
      <div className="glass rounded-2xl shadow-sm border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Activity className="text-primary" size={18} />
            Workflow Recommendations
          </h3>
          <button 
            onClick={fetchRecommendations}
            disabled={isLoadingRecs}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
            title="Refresh recommendations"
          >
            <RefreshCw size={14} className={isLoadingRecs ? "animate-spin" : ""} />
          </button>
        </div>

        {proposalSuccessMessage && (
          <div className="p-3 rounded-lg border text-xs flex items-start gap-2 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{proposalSuccessMessage}</span>
          </div>
        )}

        {isLoadingRecs ? (
          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Evaluating deterministic workflow rules...
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No active workflow recommendations for current lead state.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div 
                key={rec.id} 
                className="p-3.5 rounded-xl border border-border bg-background/50 hover:border-primary/30 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{rec.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                        rec.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-600' :
                        rec.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-blue-500/10 text-blue-600'
                      }`}>
                        {rec.riskLevel} RISK
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="italic truncate max-w-[280px]">Rationale: {rec.rationale}</span>
                  <button
                    onClick={() => proposeAction(rec)}
                    disabled={isProposingAction}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium text-xs transition-colors shrink-0 disabled:opacity-50"
                  >
                    <span>Propose Action</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar - Score */}
      <div className="glass rounded-2xl shadow-sm border border-border p-6 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="text-primary" size={18} />
            Lead Score
          </h3>
          <button 
            onClick={enrichLead}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-md transition-colors"
          >
            <RefreshCw size={12} className={isUpdating ? "animate-spin" : ""} /> 
            Enrich & Score
          </button>
        </div>

        {persistenceNotice && (
          <div className="mb-4 p-2.5 rounded-lg border text-xs flex items-start gap-2 bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>{persistenceNotice}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-3xl font-bold">{currentLead.score || 0}</span>
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-background border border-border">/ 100</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full bg-primary" style={{ width: `${currentLead.score || 0}%` }} />
        </div>
        {currentLead.score > 0 && (
          <div className="mb-4">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">
              Category: {DeterministicScoringEngine.categorize(currentLead.score)}
            </span>
          </div>
        )}
        
        {/* Score Breakdown (if available) */}
        {currentLead.enrichmentData && (
          <div className="space-y-2 mb-4 pt-2 border-t border-border/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score Breakdown</span>
            {(() => {
              try {
                const parsedEnrich = JSON.parse(currentLead.enrichmentData);
                const scoreResult = DeterministicScoringEngine.score(currentLead, parsedEnrich);
                return scoreResult.factors.map((f, i) => (
                  <div key={i} className="flex flex-col gap-0.5 mb-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted-foreground">{f.points}/{f.maxPoints}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{f.reason}</span>
                  </div>
                ));
              } catch (e) {
                return <span className="text-xs text-muted-foreground">Error loading breakdown.</span>;
              }
            })()}
          </div>
        )}

        {aiData ? (
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Zap size={14} className="text-yellow-500" /> AI Qualification</span>
              {aiData.confidence && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  aiData.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-600' :
                  aiData.confidence === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  {aiData.confidence} CONFIDENCE
                </span>
              )}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aiData.summary}
            </p>
            {aiData.strengths && aiData.strengths.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-emerald-600">Strengths:</span>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  {aiData.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {aiData.weaknesses && aiData.weaknesses.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-red-600">Weaknesses:</span>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  {aiData.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {aiData.missingInformation && aiData.missingInformation.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-orange-500">Missing Information:</span>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  {aiData.missingInformation.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {aiData.recommendedAction && (
              <div className="mt-2 p-2 bg-muted rounded-md border border-border/50">
                <span className="text-xs font-medium block mb-1">Recommended Action:</span>
                <span className="text-xs text-muted-foreground">{aiData.recommendedAction}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Lead not yet qualified by AI.</p>
        )}
      </div>

      {/* Phase 22 Live Multi-Source Lead Enrichment & Evidence Intelligence */}
      <EnrichmentCard
        leadId={currentLead.id}
        domain={currentLead.domain}
        companyName={currentLead.companyName}
        initialSnapshot={(() => {
          try {
            return currentLead.enrichmentData ? JSON.parse(currentLead.enrichmentData) : null;
          } catch {
            return null;
          }
        })()}
        onEnrichmentComplete={() => {
          router.refresh();
        }}
      />

      {/* Phase 21 Outreach Intelligence & Draft Staging */}
      <OutreachCard leadId={currentLead.id} initialScore={currentLead.score} />

      {/* Activity Feed */}
      <div className="glass rounded-2xl shadow-sm border border-border p-6 space-y-6">
        <h3 className="font-semibold text-lg">Activity History</h3>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add a note..." 
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
            disabled={isUpdating}
          />
          <button 
            onClick={addNote}
            disabled={isUpdating || !noteContent.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Save Note
          </button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">No activities logged yet.</p>
          ) : activities.map((act) => (
            <div key={act.id} className="flex gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                {act.type === 'NOTE' ? <MessageSquare size={14} className="text-blue-500" /> : 
                 act.type === 'STATUS_CHANGE' ? <Sparkles size={14} className="text-yellow-500" /> : 
                 <Sparkles size={14} className="text-gray-500" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{act.user?.name || act.user?.email || 'System'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-muted-foreground">
                  {act.type === 'NOTE' ? act.content : 
                   act.type === 'STATUS_CHANGE' ? `Changed status from ${act.oldValue} to ${act.newValue}` : 
                   act.type === 'ASSIGNMENT' ? (act.newValue ? 'Assigned lead' : 'Unassigned lead') : act.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
