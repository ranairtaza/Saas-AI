"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Server,
  Database,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  Terminal,
  Zap,
  Copy,
  Check,
  HelpCircle,
  FileText,
  AlertCircle,
  BarChart3,
  GitBranch,
  Search,
} from "lucide-react";

interface SnapshotData {
  timestamp: string;
  timeRange: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  deployment: {
    environment: string;
    gitSha: string;
    branch: string;
    buildVersion: string;
    runtimeVersion: string;
    nextVersion: string;
    nodeEnv: string;
  };
  database: {
    status: string;
    latencyMs: number;
    writeGate: string;
    databaseId: string;
    migrations: {
      status: "SYNCHRONIZED" | "PENDING_MIGRATIONS" | "INCONSISTENT" | "UNKNOWN";
      appliedCount: number;
      localCount: number;
      lastAppliedMigration: string | null;
      details: string;
    };
  };
  performance: {
    totalRequests: number;
    errors4xx: number;
    errors5xx: number;
    slowRequests: number;
    avgLatencyMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    topSlowRoutes: Array<{ route: string; avgMs: number; count: number }>;
    topFailingRoutes: Array<{ route: string; count: number }>;
  };
  ai: {
    status: "LIVE" | "TEST/MOCK" | "NOT_CONFIGURED" | "UNAVAILABLE";
    provider: string;
    model: string;
    requests: number;
  };
  integrations: {
    total: number;
    active: number;
    failing: number;
    connections: Array<{
      id: string;
      status: string;
      lastSyncAt: string | null;
      lastError: string | null;
      integration?: { provider: string };
    }>;
  };
  jobs: {
    running: number;
    failed: number;
    completed: number;
    stale: number;
    total: number;
  };
  billing: {
    status: string;
    failedWebhooks: number;
  };
  security: {
    recentEvents: Array<{
      id: string;
      action: string;
      resource: string | null;
      status: string;
      riskLevel: string;
      createdAt: string;
      ipAddress: string | null;
    }>;
  };
  dataQuality: {
    status: "VALID" | "WARNING" | "INVALID" | "INSUFFICIENT_DATA" | "UNKNOWN";
    warningsCount: number;
    checks: Array<{
      category: string;
      check: string;
      status: "VALID" | "WARNING" | "INVALID" | "INSUFFICIENT_DATA" | "UNKNOWN";
      details: string;
    }>;
  };
  configuration: Array<{
    key: string;
    category: string;
    required: boolean;
    status: "CONFIGURED" | "MISSING" | "INVALID" | "NOT_REQUIRED";
    description: string;
    details?: string;
  }>;
  alerts: Array<{
    id: string;
    severity: "CRITICAL" | "WARNING";
    type: string;
    message: string;
    createdAt: string;
    status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  }>;
  observabilityPipeline: {
    status: string;
    storage: string;
    bufferedEvents: number;
    droppedEvents: number;
    lastFlushTimestamp: string | null;
  };
}

interface TelemetryErrorItem {
  id: string;
  organizationId: string | null;
  userId: string | null;
  eventType: string;
  severity: string;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  requestId: string | null;
  traceId: string | null;
  service: string;
  message: string | null;
  metadata: string | null;
  createdAt: string;
}

export default function SystemCommandCenterPage() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [errors, setErrors] = useState<TelemetryErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d" | "30d">("24h");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // in seconds, 0 = off
  const [selectedTab, setSelectedTab] = useState<
    | "overview"
    | "performance"
    | "errors"
    | "database"
    | "ai"
    | "integrations"
    | "security"
    | "data-quality"
    | "config"
    | "deployment"
  >("overview");
  const [unauthorized, setUnauthorized] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryErrorItem | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [searchErrorText, setSearchErrorText] = useState("");

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSystemSnapshot = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        const url = `/api/system/snapshot?timeRange=${timeRange}${isManualRefresh ? "&refresh=true" : ""}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
          setUnauthorized(true);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load system snapshot");
        const json: SnapshotData = await res.json();
        setData(json);

        // Fetch errors concurrently
        const errRes = await fetch("/api/system/errors?limit=50");
        if (errRes.ok) {
          const errJson = await errRes.json();
          setErrors(errJson.events || []);
        }
      } catch (err) {
        console.error("System Command Center load failure:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeRange]
  );

  useEffect(() => {
    void fetchSystemSnapshot();
  }, [fetchSystemSnapshot]);

  // Handle Auto-Refresh
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (autoRefreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        void fetchSystemSnapshot(false);
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefreshInterval, fetchSystemSnapshot]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRequestId(true);
    setTimeout(() => setCopiedRequestId(false), 2000);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
      case "AVAILABLE":
      case "LIVE":
      case "CONFIGURED":
      case "SYNCHRONIZED":
      case "VALID":
      case "ACTIVE":
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "DEGRADED":
      case "WARNING":
      case "INSUFFICIENT_DATA":
      case "STALE":
      case "TEST/MOCK":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "UNAVAILABLE":
      case "CRITICAL":
      case "MISSING":
      case "INVALID":
      case "FAILING":
      case "FAILED":
      case "INCONSISTENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "NOT_CONFIGURED":
      case "NOT_REQUIRED":
      case "DISCONNECTED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Access Restricted</h1>
        <p className="text-muted-foreground max-w-md mb-6 text-sm">
          The System Command Center is restricted exclusively to verified OWNER and ADMIN roles. Server-side authorization has declined access for this session.
        </p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Aggregating real-time system diagnostics...</p>
      </div>
    );
  }

  const filteredErrors = errors.filter((err) => {
    if (!searchErrorText) return true;
    const query = searchErrorText.toLowerCase();
    return (
      (err.route && err.route.toLowerCase().includes(query)) ||
      (err.message && err.message.toLowerCase().includes(query)) ||
      (err.requestId && err.requestId.toLowerCase().includes(query)) ||
      (err.service && err.service.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">System Command Center</h1>
                {statusBadge(data.overallStatus)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Technical observability, infrastructure health, database consistency, and operational metrics
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter */}
          <div className="flex items-center bg-muted rounded-lg p-1 text-xs font-semibold">
            {(["1h", "6h", "24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  timeRange === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Auto Refresh Select */}
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="bg-card border border-border rounded-lg text-xs px-2.5 py-1.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={0}>Auto-refresh: Off</option>
            <option value={15}>Auto-refresh: 15s</option>
            <option value={30}>Auto-refresh: 30s</option>
            <option value={60}>Auto-refresh: 60s</option>
            <option value={300}>Auto-refresh: 5m</option>
          </select>

          {/* Manual Refresh Button */}
          <button
            onClick={() => void fetchSystemSnapshot(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Env: <strong className="text-foreground font-semibold">{data.deployment.environment.toUpperCase()}</strong></span>
          <span>Git: <strong className="text-foreground font-mono">{data.deployment.gitSha.slice(0, 7)}</strong> ({data.deployment.branch})</span>
          <span>Next.js: <strong className="text-foreground">{data.deployment.nextVersion}</strong></span>
          <span>Runtime: <strong className="text-foreground">{data.deployment.runtimeVersion}</strong></span>
        </div>
        <div>
          Last Checked: <span className="font-mono text-foreground">{new Date(data.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Deterministic System Alerts Banner (Part 16) */}
      {data.alerts.length > 0 ? (
        <div className="space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm font-medium ${
                alert.severity === "CRITICAL"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px]">{alert.type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 border font-mono">
                    {alert.status}
                  </span>
                </div>
                <div className="text-xs mt-0.5">{alert.message}</div>
              </div>
              <span className="text-[11px] opacity-75 font-mono">
                {new Date(alert.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>All deterministic system assertions passed. No active alerts or operational warnings in {timeRange}.</span>
        </div>
      )}

      {/* Core Health Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* App */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">App</span>
            <Server className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">v{data.deployment.buildVersion}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.deployment.nodeEnv}</div>
          </div>
        </div>

        {/* Database */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Database</span>
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${data.database.status === "HEALTHY" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-sm font-bold text-foreground">{data.database.status}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.database.latencyMs}ms ping</div>
          </div>
        </div>

        {/* API Latency */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">API p95</span>
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.performance.p95Ms}ms</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">p99: {data.performance.p99Ms}ms</div>
          </div>
        </div>

        {/* AI Gemini */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Gemini</span>
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  data.ai.status === "LIVE" ? "bg-emerald-500" : data.ai.status === "TEST/MOCK" ? "bg-amber-500" : "bg-muted"
                }`}
              />
              <span className="text-sm font-bold text-foreground">{data.ai.status}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.ai.requests} calls</div>
          </div>
        </div>

        {/* Integrations */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Integrations</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.integrations.active}/{data.integrations.total} Active</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.integrations.failing} failing</div>
          </div>
        </div>

        {/* Background Jobs */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Jobs</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.jobs.completed} Done</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.jobs.failed} Failed · {data.jobs.stale} Stale</div>
          </div>
        </div>

        {/* Billing */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Billing</span>
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.billing.status}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.billing.failedWebhooks} Err Hooks</div>
          </div>
        </div>

        {/* Data Quality */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Data Quality</span>
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.dataQuality.status}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.dataQuality.warningsCount} warnings</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview & Performance" },
          { id: "errors", label: `Error Center (${errors.length})` },
          { id: "database", label: "Database & Migrations" },
          { id: "ai", label: "AI Center" },
          { id: "integrations", label: `Integrations & Jobs (${data.integrations.total})` },
          { id: "security", label: "Security Center" },
          { id: "data-quality", label: "Data Quality" },
          { id: "config", label: "Configuration Health" },
          { id: "deployment", label: "Deployment & Pipeline" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              selectedTab === tab.id
                ? "border-primary text-primary bg-primary/5 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Performance */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          {/* Performance Overview KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Observed Requests (Sampled, {timeRange})</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {data.performance.totalRequests > 0 ? data.performance.totalRequests : "—"}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Observed Avg Latency</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {data.performance.avgLatencyMs > 0 ? `${data.performance.avgLatencyMs} ms` : "—"}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Observed p50 / p95 (Sampled)</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {data.performance.p50Ms > 0 ? data.performance.p50Ms : "—"}{" "}
                <span className="text-xs font-normal text-muted-foreground">/</span>{" "}
                {data.performance.p95Ms > 0 ? `${data.performance.p95Ms} ms` : "—"}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Client 4xx Errors</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.performance.errors4xx}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Server 5xx Errors</div>
              <div className={`text-2xl font-extrabold mt-1 ${data.performance.errors5xx > 0 ? "text-destructive" : "text-foreground"}`}>
                {data.performance.errors5xx}
              </div>
            </div>
          </div>

          {/* Route Performance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Slow Routes */}
            <div className="p-5 rounded-xl border border-border bg-card space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>Top Slow Routes</span>
                <span className="text-xs font-normal text-muted-foreground">Slow Threshold: 750ms</span>
              </h2>
              {data.performance.topSlowRoutes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No slow requests detected in this timeframe.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.performance.topSlowRoutes.map((r, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="font-mono text-foreground font-medium truncate max-w-[280px]">{r.route}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{r.count} hits</span>
                        <span className="font-bold text-foreground">{r.avgMs} ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Failing Routes */}
            <div className="p-5 rounded-xl border border-border bg-card space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>Top Failing Routes</span>
                <span className="text-xs font-normal text-muted-foreground">4xx & 5xx</span>
              </h2>
              {data.performance.topFailingRoutes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No failing routes recorded in this timeframe.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.performance.topFailingRoutes.map((r, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="font-mono text-foreground font-medium truncate max-w-[280px]">{r.route}</div>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-destructive/10 text-destructive text-[11px]">
                        {r.count} errs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Error Center */}
      {selectedTab === "errors" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Error Center & Critical Incidents</h2>
                <p className="text-xs text-muted-foreground">
                  Individual telemetry entries captured at 100% resolution for failures and slow requests.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by route, msg, request ID..."
                  value={searchErrorText}
                  onChange={(e) => setSearchErrorText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {filteredErrors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No error events match the active filter criteria.</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredErrors.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="py-3 px-2 flex items-center justify-between text-xs hover:bg-muted/40 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] flex-shrink-0 ${
                          evt.statusCode && evt.statusCode >= 500
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {evt.statusCode || evt.severity}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-foreground truncate font-medium">
                          {evt.method || "SYS"} {evt.route || evt.service}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{evt.message || "No error message provided"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right flex-shrink-0 ml-2">
                      {evt.durationMs && <span className="text-muted-foreground">{Math.round(evt.durationMs)}ms</span>}
                      <span className="text-[11px] text-muted-foreground font-mono">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drill-down Details Modal / Panel (Part 18) */}
          {selectedEvent && (
            <div className="p-5 rounded-xl border border-primary/20 bg-card shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Telemetry Event Detail</h3>
                  <span className="text-xs font-mono text-muted-foreground">({selectedEvent.id})</span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-xs px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold"
                >
                  Close Panel
                </button>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Route</span>
                  <span className="font-mono font-medium text-foreground">{selectedEvent.route || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">HTTP Method / Status</span>
                  <span className="font-mono font-medium text-foreground">
                    {selectedEvent.method || "SYS"} · {selectedEvent.statusCode || selectedEvent.severity}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Execution Latency</span>
                  <span className="font-mono font-medium text-foreground">
                    {selectedEvent.durationMs ? `${selectedEvent.durationMs}ms` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                  <span className="font-mono font-medium text-foreground">{new Date(selectedEvent.createdAt).toISOString()}</span>
                </div>
              </div>

              {/* Request ID & Trace ID Correlation (Part 8) */}
              <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/40 text-xs border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Request ID:</span>
                  <span className="font-mono font-bold text-foreground">{selectedEvent.requestId || "req_unspecified"}</span>
                  {selectedEvent.requestId && (
                    <button
                      onClick={() => copyToClipboard(selectedEvent.requestId!)}
                      className="text-primary hover:text-primary/80"
                      title="Copy Request ID"
                    >
                      {copiedRequestId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                {selectedEvent.traceId && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Trace ID:</span>
                    <span className="font-mono text-foreground">{selectedEvent.traceId}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Service:</span> <span className="font-bold">{selectedEvent.service}</span>
                </div>
              </div>

              {/* Message */}
              {selectedEvent.message && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Sanitized Error Message</span>
                  <div className="p-3 rounded-lg bg-destructive/5 text-destructive font-mono text-xs border border-destructive/10">
                    {selectedEvent.message}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedEvent.metadata && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Sanitized Event Metadata</span>
                  <pre className="text-[11px] p-3 rounded-lg bg-muted font-mono overflow-x-auto text-foreground border border-border">
                    {selectedEvent.metadata}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Database & Migrations */}
      {selectedTab === "database" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">PostgreSQL Connection</div>
              <div className="flex items-center gap-2 mt-2">
                {statusBadge(data.database.status)}
                <span className="text-xs text-muted-foreground">({data.database.latencyMs}ms ping)</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Migration Status</div>
              <div className="mt-2">{statusBadge(data.database.migrations.status)}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">DB Write Guard</div>
              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {data.database.writeGate}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Database Identifier</div>
              <div className="text-sm font-mono font-bold text-foreground mt-2 truncate">{data.database.databaseId}</div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Migration Consistency Verification (Part 5)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Applied Migrations (DB)</span>
                <span className="text-lg font-bold font-mono text-foreground">{data.database.migrations.appliedCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Local Migration Files</span>
                <span className="text-lg font-bold font-mono text-foreground">{data.database.migrations.localCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Latest Applied Migration</span>
                <span className="text-xs font-mono text-foreground truncate block mt-1">
                  {data.database.migrations.lastAppliedMigration || "None"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{data.database.migrations.details}</p>
          </div>
        </div>
      )}

      {/* Tab 4: AI Center */}
      {selectedTab === "ai" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Provider Status</div>
              <div className="mt-2">{statusBadge(data.ai.status)}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Provider Engine</div>
              <div className="text-base font-bold text-foreground mt-2 uppercase">{data.ai.provider}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Configured Model</div>
              <div className="text-base font-mono font-bold text-foreground mt-2">{data.ai.model}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Invocations ({timeRange})</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.ai.requests}</div>
            </div>
          </div>
          <div className="p-5 rounded-xl border border-border bg-card text-xs text-muted-foreground space-y-2">
            <h2 className="text-sm font-bold text-foreground">AI Integration Protocol</h2>
            <p>
              LeadMachine utilizes Google Generative AI (Gemini). Mocked providers are strictly labeled as <code className="font-mono text-amber-500">TEST/MOCK</code> and are never displayed as LIVE in production.
            </p>
          </div>
        </div>
      )}

      {/* Tab 5: Integrations & Background Jobs */}
      {selectedTab === "integrations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Total Connections</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.integrations.total}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Running Jobs</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.jobs.running}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Completed Jobs</div>
              <div className="text-2xl font-extrabold text-emerald-500 mt-1">{data.jobs.completed}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Failed Jobs</div>
              <div className={`text-2xl font-extrabold mt-1 ${data.jobs.failed > 0 ? "text-destructive" : "text-foreground"}`}>
                {data.jobs.failed}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Stale Jobs (&gt;30m)</div>
              <div className={`text-2xl font-extrabold mt-1 ${data.jobs.stale > 0 ? "text-amber-500" : "text-foreground"}`}>
                {data.jobs.stale}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Active Integration Connections</h2>
            {data.integrations.connections.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No third-party integrations configured.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.integrations.connections.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground capitalize">{c.integration?.provider || "Custom Connection"}</span>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        Last sync: {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "Never"}
                      </div>
                      {c.lastError && <div className="text-[11px] text-destructive mt-0.5 font-mono">{c.lastError}</div>}
                    </div>
                    <div>{statusBadge(c.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Security Center */}
      {selectedTab === "security" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Security Audit Events & Privilege Tracking</h2>
            <p className="text-xs text-muted-foreground">
              Tracking authentication failures, unauthorized API attempts, and high-risk administrative mutations.
            </p>
            {data.security.recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No security anomalies or authorization failures recorded in {timeRange}.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.security.recentEvents.map((evt) => (
                  <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{evt.action}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            evt.riskLevel === "SENSITIVE" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {evt.riskLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Target: {evt.resource || "Global"} · IP: {evt.ipAddress || "Internal"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-[11px] block">{evt.status}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Data Quality Center */}
      {selectedTab === "data-quality" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">Data Quality & Telemetry Integrity</h2>
                <p className="text-xs text-muted-foreground">
                  Continuous validation of business KPIs, metric completeness, integration freshness, and migration consistency.
                </p>
              </div>
              <div>{statusBadge(data.dataQuality.status)}</div>
            </div>

            <div className="divide-y divide-border">
              {data.dataQuality.checks.map((chk, idx) => (
                <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{chk.check}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {chk.category}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{chk.details}</div>
                  </div>
                  <div>{statusBadge(chk.status)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Configuration Health */}
      {selectedTab === "config" && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Configuration & Environment Variables</h2>
            <p className="text-xs text-muted-foreground">
              Presence and format validation for required infrastructure credentials. Secret values are never displayed.
            </p>
          </div>
          <div className="divide-y divide-border">
            {data.configuration.map((c) => (
              <div key={c.key} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{c.key}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {c.category}
                    </span>
                    {c.required && <span className="text-[10px] text-destructive font-bold">REQUIRED</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                  {c.details && <div className="text-[11px] text-amber-500 mt-0.5 font-medium">{c.details}</div>}
                </div>
                <div>{statusBadge(c.status)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 9: Deployment & Observability Pipeline */}
      {selectedTab === "deployment" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Deployment Runtime Metadata (Part 20)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Git Commit SHA</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">{data.deployment.gitSha}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Git Branch</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">{data.deployment.branch}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Next.js Framework</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">{data.deployment.nextVersion}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Node.js Runtime</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">{data.deployment.runtimeVersion}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Observability Self-Monitoring (Part 26)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Pipeline Status</span>
                <span className="mt-1 block">{statusBadge(data.observabilityPipeline.status)}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Storage Backend</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{data.observabilityPipeline.storage}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Buffered Events</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{data.observabilityPipeline.bufferedEvents}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px]">Dropped Events</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{data.observabilityPipeline.droppedEvents}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
