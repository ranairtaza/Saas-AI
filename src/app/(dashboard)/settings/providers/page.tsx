"use client";

import { useState, useEffect } from "react";
import { Loader2, Key, CheckCircle2, Trash2 } from "lucide-react";

export default function ProvidersSettingsPage() {
  const [providers, setProviders] = useState<{ provider: string; configured: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [apolloKey, setApolloKey] = useState("");
  const [isSavingApollo, setIsSavingApollo] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/settings/providers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch providers');
      setProviders(data.providers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isApolloConfigured = providers.some(p => p.provider === 'apollo' && p.configured);

  const saveApollo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apolloKey) return;
    
    setIsSavingApollo(true);
    try {
      const res = await fetch('/api/settings/providers/apollo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apolloKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save provider');
      
      setApolloKey("");
      fetchProviders();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingApollo(false);
    }
  };

  const removeApollo = async () => {
    if (!confirm("Are you sure you want to remove the Apollo API key?")) return;
    
    setIsSavingApollo(true);
    try {
      const res = await fetch('/api/settings/providers/apollo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove provider');
      
      fetchProviders();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingApollo(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Providers</h1>
        <p className="text-muted-foreground mt-2">
          Configure external integrations for real-time lead discovery.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Apollo.io
                {isApolloConfigured && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Configured
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Used for B2B company discovery and contact enrichment.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-muted/30">
          <form onSubmit={saveApollo} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Key size={16} className="text-muted-foreground" />
                API Key
              </label>
              <input
                type="password"
                placeholder={isApolloConfigured ? "Enter new API key to replace existing" : "sk_..."}
                value={apolloKey}
                onChange={(e) => setApolloKey(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              {isApolloConfigured ? (
                <button
                  type="button"
                  onClick={removeApollo}
                  disabled={isSavingApollo}
                  className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
                >
                  <Trash2 size={16} /> Remove Configuration
                </button>
              ) : <div></div>}
              
              <button
                type="submit"
                disabled={isSavingApollo || !apolloKey}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSavingApollo ? <Loader2 size={16} className="animate-spin" /> : 'Save Key'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
