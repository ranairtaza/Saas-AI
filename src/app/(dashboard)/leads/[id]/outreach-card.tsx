'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, CheckCircle2, AlertTriangle, RefreshCw, Edit3, XCircle, Send, ShieldAlert } from 'lucide-react';
import { OutreachDraftPayload, OutreachTone } from '@/lib/leads/outreach/types';

interface OutreachCardProps {
  leadId: string;
  initialScore?: number | null;
  onRefreshLead?: () => void;
}

export function OutreachCard({ leadId, initialScore, onRefreshLead }: OutreachCardProps) {
  const [draft, setDraft] = useState<OutreachDraftPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [selectedTone, setSelectedTone] = useState<OutreachTone>('CONSULTATIVE_VALUE');
  const [customAngle, setCustomAngle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch active draft on mount
  useEffect(() => {
    fetchDraft();
  }, [leadId]);

  const fetchDraft = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/outreach/draft`);
      if (!res.ok) {
        throw new Error('Failed to load outreach draft');
      }
      const data = await res.json();
      if (data.draft) {
        setDraft(data.draft);
        setEditedSubject(data.draft.subject);
        setEditedBody(data.draft.body);
        if (data.draft.tone) setSelectedTone(data.draft.tone);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading draft');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (forceRegenerate = false) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch(`/api/leads/${leadId}/outreach/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone: selectedTone,
          customAngle: customAngle || undefined,
          forceRegenerate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate outreach draft');
      }

      setDraft(data.draft);
      setEditedSubject(data.draft.subject);
      setEditedBody(data.draft.body);
      setIsEditing(false);
      setSuccessMsg(forceRegenerate ? 'Draft regenerated successfully.' : 'Outreach intelligence & draft generated.');
      if (onRefreshLead) onRefreshLead();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/outreach/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save edits');
      }

      if (draft) {
        setDraft({
          ...draft,
          subject: editedSubject,
          body: editedBody,
          status: 'EDITED',
        });
      }
      setIsEditing(false);
      setSuccessMsg('Edits saved successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save edits');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestApproval = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/outreach/draft/request-approval`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request approval');
      }

      if (draft) {
        setDraft({
          ...draft,
          status: 'PENDING_APPROVAL',
          pendingActionId: data.pendingAction?.id,
        });
      }
      setSuccessMsg('Approval requested! Action staged in Governance Center for Manager/Admin review.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Approval request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this outreach draft?')) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/outreach/draft/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by sales rep' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject draft');
      }

      if (draft) {
        setDraft({
          ...draft,
          status: 'REJECTED',
        });
      }
      setSuccessMsg('Draft rejected.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Rejection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Outreach Intelligence & Draft Staging
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                Phase 21
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic grounding • Tripartite reasoning • Human-governed staging (0 emails sent)
            </p>
          </div>
        </div>

        {/* Mode & Status Badges */}
        {draft && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                draft.generationMode === 'LIVE_AI'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {draft.generationMode === 'LIVE_AI' ? '⚡ LIVE_AI' : '🛡️ MOCK MODE'}
            </span>

            {draft.isStale ? (
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> STALE CONTEXT
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                ✓ FRESH
              </span>
            )}

            <span
              className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                draft.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : draft.status === 'PENDING_APPROVAL'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                  : draft.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              STATUS: {draft.status} (v{draft.version})
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 text-sm bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stale Context Warning */}
      {draft?.isStale && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Context Mismatch Detected:</strong> Lead score or enrichment data has changed since this draft was generated. Please regenerate to incorporate the latest verified facts.
          </div>
        </div>
      )}

      {/* Main Body */}
      {!draft ? (
        <div className="text-center py-8 space-y-4">
          <div className="inline-flex p-3 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">No Outreach Draft Staged</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Synthesize verified company evidence and deterministic score factors into a structured outreach angle and personalized cold email.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <select
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value as OutreachTone)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="CONSULTATIVE_VALUE">Tone: Consultative Value</option>
              <option value="DIRECT_EXECUTIVE">Tone: Direct Executive</option>
              <option value="BRIEF_TECHNICAL">Tone: Brief Technical</option>
            </select>

            <button
              onClick={() => handleGenerate(false)}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 transition"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Outreach Draft
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Outreach Intelligence Reasoning */}
          {draft.intelligence && (
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Tripartite Outreach Intelligence
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Verified Facts */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>📌 Verified Facts (Evidence)</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                    {draft.intelligence.verifiedEvidence?.map((fact, idx) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>
                </div>

                {/* Observations */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <span>🔍 Observations (Deductions)</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                    {draft.intelligence.observations?.map((obs, idx) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>

                {/* Hypotheses */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <span>💡 Opportunity Hypotheses</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                    {draft.intelligence.opportunityHypotheses?.map((hyp, idx) => (
                      <li key={idx}>{hyp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Strategy Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">Recommended Angle:</strong> {draft.intelligence.recommendedAngle}
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">Confidence:</strong>{' '}
                  <span className="font-mono uppercase text-indigo-600 dark:text-indigo-400">{draft.intelligence.confidence}</span> ({draft.intelligence.confidenceRationale})
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Email Draft Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-indigo-500" /> Staged Cold Email Draft
              </h4>

              <div className="flex items-center gap-2">
                {!isEditing && draft.status !== 'APPROVED' && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Draft
                  </button>
                )}

                <button
                  onClick={() => handleGenerate(true)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate
                </button>
              </div>
            </div>

            {/* Subject Line */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject Line</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full text-sm font-medium px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              ) : (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
                  {draft.subject}
                </div>
              )}
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email Body</label>
              {isEditing ? (
                <textarea
                  rows={7}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="w-full text-sm font-sans px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-sm font-sans text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200 dark:border-slate-700 leading-relaxed">
                  {draft.body}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditedSubject(draft.subject);
                      setEditedBody(draft.body);
                      setIsEditing(false);
                    }}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {draft.status !== 'APPROVED' && draft.status !== 'REJECTED' && (
                    <button
                      onClick={handleReject}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Draft
                    </button>
                  )}
                </div>
              )}

              {/* Approval Buttons based on State */}
              <div>
                {draft.status === 'APPROVED' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> APPROVED — Staged for Future Phase 23 Dispatch
                  </div>
                ) : draft.status === 'PENDING_APPROVAL' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pending Manager/Admin Approval (Action Center)
                  </div>
                ) : (
                  <button
                    onClick={handleRequestApproval}
                    disabled={saving || draft.isStale}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 transition"
                  >
                    <Send className="w-3.5 h-3.5" /> Request Approval (Manager)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
