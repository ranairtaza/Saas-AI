"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Target, CheckCircle2, AlertCircle, Clock, CheckSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DiscoverPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [jobTitles, setJobTitles] = useState("");
  const [limit, setLimit] = useState(50);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ available: number } | null>(null);
  const [isApolloConfigured, setIsApolloConfigured] = useState(true); // default true to avoid flash
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [isPromoting, setIsPromoting] = useState(false);

  useEffect(() => {
    fetch("/api/billing")
      .then(res => res.json())
      .then(data => {
        if (data.credits) setCredits({ available: data.credits.availableBalance });
      })
      .catch(console.error);
      
    fetch("/api/settings/providers")
      .then(res => res.json())
      .then(data => {
        if (data.providers) {
          const apollo = data.providers.find((p: any) => p.provider === 'apollo');
          setIsApolloConfigured(apollo?.configured || false);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      if (!jobId) return;
      try {
        const res = await fetch(`/api/discover/${jobId}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to check status');
        
        setJobStatus(data.status);
        setProgress(data.progress || 0);

        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          fetchResults(jobId);
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setError(data.error || 'Job failed');
        }
      } catch (err: any) {
        clearInterval(interval);
        setError(err.message);
      }
    };

    if (jobId && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED') {
      interval = setInterval(checkStatus, 2000);
    }

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const fetchResults = async (id: string) => {
    try {
      const res = await fetch(`/api/discover/${id}/results`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch results');
      setResults(data);
      setSelectedResultIds(new Set(data.results.map((r: any) => r.id)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (credits && limit > credits.available) return;
    if (!isApolloConfigured) {
      setError("Apollo API key is not configured. Please add it in Settings > Providers.");
      return;
    }

    setJobId(null);
    setJobStatus(null);
    setProgress(0);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, location, jobTitles, limit }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to discover leads");
      }

      setJobId(data.jobId);
      setJobStatus(data.status);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedResultIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedResultIds(next);
  };

  const handlePromote = async () => {
    if (selectedResultIds.size === 0) return;
    setIsPromoting(true);
    try {
      const res = await fetch("/api/leads/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultIds: Array.from(selectedResultIds) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to promote leads");
      
      router.push("/leads");
    } catch (err: any) {
      setError(err.message);
      setIsPromoting(false);
    }
  };

  const isInsufficientCredits = credits !== null && limit > credits.available;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Discovery</h1>
        <p className="text-muted-foreground mt-2">
          Find highly qualified B2B leads using our automated acquisition pipeline.
        </p>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Industry</label>
              <input
                type="text"
                placeholder="e.g. Technology, Real Estate, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <input
                type="text"
                placeholder="e.g. San Francisco, London, Global"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Titles</label>
              <input
                type="text"
                placeholder="e.g. CEO, Marketing Director"
                value={jobTitles}
                onChange={(e) => setJobTitles(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                <span>Requested Lead Count</span>
                {credits && (
                  <span className="text-muted-foreground text-xs">Available: {credits.available}</span>
                )}
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className={`w-full px-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  isInsufficientCredits ? 'border-destructive/50 ring-destructive/20 focus:ring-destructive/50' : 'border-border'
                }`}
                required
              />
              {isInsufficientCredits && (
                <p className="text-xs text-destructive">
                  Not enough credits for this discovery. <Link href="/billing" className="underline">Get more</Link>.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={!!jobId && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED' || isInsufficientCredits || !isApolloConfigured}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {jobId && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED' ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Discovering...
                </>
              ) : (
                <>
                  <Search size={18} /> Run Discovery
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {jobStatus && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED' && (
        <div className="glass p-6 rounded-2xl border border-border text-center space-y-4">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto animate-pulse" />
          <div>
            <h3 className="font-semibold text-lg">{jobStatus === 'QUEUED' ? 'Job Queued...' : 'Discovering Leads...'}</h3>
            <p className="text-sm text-muted-foreground mt-1">Please wait while we gather data from our providers.</p>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 mt-4 max-w-md mx-auto overflow-hidden">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {results && results.results?.length > 0 && (
        <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Target size={16} className="text-primary" /> Staged Discovery Results
              <span className="text-muted-foreground font-normal ml-2">({results.results.length} found)</span>
            </h3>
            <button
              onClick={handlePromote}
              disabled={selectedResultIds.size === 0 || isPromoting}
              className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPromoting ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
              Promote {selectedResultIds.size} Leads
            </button>
          </div>
          <div className="divide-y divide-border">
            {results.results.map((lead: any) => (
              <div key={lead.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/50 transition-colors gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedResultIds.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {lead.companyName}
                      <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">{lead.provider}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lead.contactName ? `${lead.contactName} • ` : ''}{lead.contactEmail || lead.domain || 'No contact info'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0">
                  {lead.verificationStatus === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={14} /> Verified
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-full">
                    Score: {lead.score || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {results && results.results?.length === 0 && (
        <div className="p-8 text-center glass rounded-2xl border border-border">
          <p className="text-muted-foreground">No new leads discovered for this criteria.</p>
        </div>
      )}
    </div>
  );
}
