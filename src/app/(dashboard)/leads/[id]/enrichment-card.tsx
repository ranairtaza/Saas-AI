'use client';

import { useState } from 'react';
import { Sparkles, Globe, Layers, ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, Server } from 'lucide-react';

interface DiscoveredEvidence {
  field: string;
  value: any;
  sourceType: string;
  sourceUrl?: string | null;
  provider: string;
  confidence: string;
  verificationStatus: string;
  observedAt: string;
}

interface ConflictingEvidence {
  field: string;
  values: Array<{
    value: any;
    provider: string;
    confidence: string;
    sourceUrl?: string | null;
  }>;
  resolvedValue: any;
  resolutionRationale: string;
}

interface EnrichmentCardProps {
  leadId: string;
  domain?: string | null;
  companyName: string;
  initialSnapshot?: {
    industry?: string;
    companySize?: string;
    estimatedRevenue?: string;
    location?: string;
    technologies?: string[];
    decisionMakerIdentified?: boolean;
    contactRole?: string;
    sourceProvider?: string;
    enrichedAt?: string;
    evidence?: DiscoveredEvidence[];
    conflicts?: ConflictingEvidence[];
    providersCompleted?: string[];
  } | null;
  onEnrichmentComplete?: () => void;
}

export function EnrichmentCard({
  leadId,
  domain,
  companyName,
  initialSnapshot,
  onEnrichmentComplete,
}: EnrichmentCardProps) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [evidenceList, setEvidenceList] = useState<DiscoveredEvidence[]>(initialSnapshot?.evidence || []);
  const [conflicts, setConflicts] = useState<ConflictingEvidence[]>(initialSnapshot?.conflicts || []);
  const [showSources, setShowSources] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleEnrich = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });

      const data = await res.json();
      if (data.success && data.snapshot) {
        setSnapshot(data.snapshot);
        setEvidenceList(data.snapshot.evidence || []);
        setConflicts(data.snapshot.conflicts || []);
        if (data.staleOutreachTriggered) {
          setMessage('Enrichment updated! Linked outreach draft was flagged STALE to reflect new context.');
        } else {
          setMessage('Multi-source lead enrichment completed successfully.');
        }
        if (onEnrichmentComplete) onEnrichmentComplete();
      } else {
        setMessage(data.error || 'Failed to enrich lead.');
      }
    } catch (err: any) {
      setMessage(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'HIGH':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">High Confidence</span>;
      case 'MEDIUM':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Medium Confidence</span>;
      default:
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">Unverified</span>;
    }
  };

  const technologies = snapshot?.technologies || [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              Live Multi-Source Lead Enrichment & Evidence
            </h3>
            <p className="text-xs text-zinc-400">
              Verified real-world signals, web technologies, and source provenance
            </p>
          </div>
        </div>

        <button
          onClick={handleEnrich}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Enriching Signals...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{snapshot ? 'Refresh Enrichment' : 'Enrich Lead'}</span>
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Conflicts Banner */}
      {conflicts.length > 0 && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1 text-xs">
          <div className="font-semibold flex items-center gap-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Conflicting Provider Signals Detected ({conflicts.length})</span>
          </div>
          {conflicts.map((c, i) => (
            <p key={i} className="text-zinc-300 pl-5 text-[11px]">
              • <strong className="text-amber-300 capitalize">{c.field}</strong>: {c.resolutionRationale}
            </p>
          ))}
        </div>
      )}

      {/* Snapshot Content */}
      {snapshot ? (
        <div className="space-y-6">
          {/* Company Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 space-y-1">
              <div className="text-[11px] font-medium text-zinc-400">Industry</div>
              <div className="text-sm font-semibold text-zinc-100">{snapshot.industry || 'Unknown'}</div>
              <div>{getConfidenceBadge('HIGH')}</div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 space-y-1">
              <div className="text-[11px] font-medium text-zinc-400">Company Size</div>
              <div className="text-sm font-semibold text-zinc-100">{snapshot.companySize || 'Unknown'} Employees</div>
              <div>{getConfidenceBadge('MEDIUM')}</div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 space-y-1">
              <div className="text-[11px] font-medium text-zinc-400">Estimated Revenue</div>
              <div className="text-sm font-semibold text-zinc-100">{snapshot.estimatedRevenue || 'Unknown'}</div>
              <div>{getConfidenceBadge('MEDIUM')}</div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 space-y-1">
              <div className="text-[11px] font-medium text-zinc-400">Location</div>
              <div className="text-sm font-semibold text-zinc-100 truncate">{snapshot.location || 'Unknown'}</div>
              <div>{getConfidenceBadge('HIGH')}</div>
            </div>
          </div>

          {/* Verified Technologies Section */}
          <div className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Detected Technology Stack ({technologies.length})
              </span>
              <span className="text-[10px] text-zinc-500">Source: Safe Web Headers & Signatures</span>
            </div>

            {technologies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {technologies.map((tech, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20"
                  >
                    <Server className="w-3 h-3 text-purple-400" />
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No specific technologies discovered yet.</p>
            )}
          </div>

          {/* Provenance & Sources Toggle */}
          <div className="space-y-3">
            <button
              onClick={() => setShowSources(!showSources)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{showSources ? 'Hide Evidence Provenance' : `View Verified Sources & Evidence (${evidenceList.length})`}</span>
            </button>

            {showSources && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Raw Discovered Evidence Items
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {evidenceList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200 capitalize">{item.field}:</span>
                          <span className="text-zinc-400">
                            {Array.isArray(item.value) ? item.value.join(', ') : String(item.value)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Provider: <strong className="text-zinc-400">{item.provider}</strong> ({item.sourceType})
                          {item.sourceUrl && ` • ${item.sourceUrl}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {getConfidenceBadge(item.confidence)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 space-y-3">
          <Globe className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-sm font-medium text-zinc-300">No live enrichment data collected yet.</div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Click "Enrich Lead" to inspect web signals, detect technologies, and gather verified evidence across multi-source adapters.
          </p>
        </div>
      )}
    </div>
  );
}
