"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

interface SystemOverviewData {
  timestamp: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  system: {
    environment: string;
    version: string;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  database: {
    status: string;
    latencyMs: number;
    migrations: string;
    totalModels: number;
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
  };
  ai: {
    status: string;
    provider: string;
    model: string;
    requests24h: number;
  };
  integrations: {
    totalConnections: number;
    active: number;
    failing: number;
  };
  jobs: {
    running: number;
    failed: number;
    completed: number;
    total: number;
  };
  billing: {
    status: string;
    failedWebhooks24h: number;
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
    message: string;
    timestamp: string;
  }>;
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
  const [data, setData] = useState<SystemOverviewData | null>(null);
  const [errors, setErrors] = useState<TelemetryErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"overview" | "performance" | "database" | "ai" | "config" | "errors">("overview");
  const [unauthorized, setUnauthorized] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryErrorItem | null>(null);

  const fetchSystemData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/system/overview");
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load system overview");
      const json: SystemOverviewData = await res.json();
      setData(json);

      // Also fetch recent errors
      const errRes = await fetch("/api/system/errors?limit=30");
      if (errRes.ok) {
        const errJson = await errRes.json();
        setErrors(errJson.events || []);
      }
    } catch (err) {
      console.error("System command center load failure:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSystemData();
  }, [fetchSystemData]);

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Access Restricted</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          The System Command Center is restricted exclusively to verified Owner and System Administrator roles.
        </p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Gathering system diagnostics...</p>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hrs}h ${mins}m`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
      case "CONFIGURED":
      case "SYNCHRONIZED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "DEGRADED":
      case "WARNING":
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
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

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
                Technical observability, infrastructure diagnostics, and operational health
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-foreground">Env: {data.system.environment.toUpperCase()}</div>
            <div className="text-[11px] text-muted-foreground">Uptime: {formatUptime(data.system.uptimeSeconds)}</div>
          </div>
          <button
            onClick={() => void fetchSystemData()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Deterministic Alerts Banner */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium ${
                alert.severity === "CRITICAL"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{alert.message}</span>
              <span className="text-xs opacity-75">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Health Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Application */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">App</span>
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground truncate">v{data.system.version}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Node {data.system.nodeVersion}</div>
          </div>
        </div>

        {/* Database */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Database</span>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${data.database.status === "HEALTHY" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-sm font-bold text-foreground">{data.database.status}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.database.latencyMs}ms latency</div>
          </div>
        </div>

        {/* API Performance */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">API Latency</span>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.performance.p95Ms}ms</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">p95 (24h)</div>
          </div>
        </div>

        {/* AI Engine */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Gemini</span>
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${data.ai.status === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="text-sm font-bold text-foreground">{data.ai.status === "HEALTHY" ? "LIVE" : "UNCONFIG"}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.ai.requests24h} calls</div>
          </div>
        </div>

        {/* Integrations */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Integrations</span>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.integrations.active}/{data.integrations.totalConnections}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.integrations.failing} failing</div>
          </div>
        </div>

        {/* Jobs */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Sync Jobs</span>
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.jobs.completed} Done</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.jobs.failed} Failed</div>
          </div>
        </div>

        {/* Billing */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Stripe</span>
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{data.billing.status}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.billing.failedWebhooks24h} Err Hooks</div>
          </div>
        </div>

        {/* Security */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Security</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">ENFORCED</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{data.security.recentEvents.length} events</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview & Performance" },
          { id: "database", label: "Database & Models" },
          { id: "ai", label: "AI Center" },
          { id: "config", label: "Configuration" },
          { id: "errors", label: `Error Log (${errors.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              selectedTab === tab.id
                ? "border-primary text-primary bg-primary/5"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Total Monitored Requests (24h)</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.performance.totalRequests}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Average Latency</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.performance.avgLatencyMs} ms</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">p99 Latency</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.performance.p99Ms} ms</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">5xx Server Errors</div>
              <div className={`text-2xl font-extrabold mt-1 ${data.performance.errors5xx > 0 ? "text-destructive" : "text-foreground"}`}>
                {data.performance.errors5xx}
              </div>
            </div>
          </div>

          {/* Slowest Routes */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>Top Slow Routes (avg ms)</span>
              <span className="text-xs font-normal text-muted-foreground">Threshold: 750ms</span>
            </h2>
            {data.performance.topSlowRoutes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No slow routes recorded in telemetry window.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.performance.topSlowRoutes.map((r, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="font-mono text-foreground font-medium">{r.route}</div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{r.count} calls</span>
                      <span className="font-bold text-foreground">{r.avgMs} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Database */}
      {selectedTab === "database" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">PostgreSQL Connection</div>
              <div className="flex items-center gap-2 mt-2">
                {statusBadge(data.database.status)}
                <span className="text-xs text-muted-foreground">({data.database.latencyMs}ms ping)</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Migration History</div>
              <div className="flex items-center gap-2 mt-2">
                {statusBadge(data.database.migrations)}
                <span className="text-xs text-muted-foreground">4 applied</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Prisma Schema Models</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.database.totalModels} Models</div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-3">
            <h2 className="text-sm font-bold text-foreground">Database Safety Verification</h2>
            <p className="text-xs text-muted-foreground">
              Direct connection URL is wired via <code className="font-mono text-primary">DIRECT_URL</code> for migrations.
              Database reset scripts are strictly gated behind production environment checks.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: AI Center */}
      {selectedTab === "ai" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Provider Status</div>
              <div className="mt-2">{statusBadge(data.ai.status)}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Active Production Model</div>
              <div className="text-lg font-bold font-mono text-foreground mt-1">{data.ai.model}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Total AI Invocations (24h)</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{data.ai.requests24h}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Configuration Validation */}
      {selectedTab === "config" && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Production Configuration Health</h2>
            <p className="text-xs text-muted-foreground">
              Verification of required environment variables. Secrets are verified for presence and format, but values are strictly hidden.
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

      {/* Tab 5: Error & Telemetry Log */}
      {selectedTab === "errors" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground">Recent Server & Telemetry Events</h2>
            {errors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No errors or slow requests recorded in the active buffer.</p>
            ) : (
              <div className="divide-y divide-border">
                {errors.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="py-3 flex items-center justify-between text-xs hover:bg-muted/40 p-2 rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        evt.statusCode && evt.statusCode >= 500
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {evt.statusCode || evt.severity}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-foreground truncate font-medium">
                          {evt.method || "SYS"} {evt.route || evt.service}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{evt.message || "No error message"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right flex-shrink-0">
                      {evt.durationMs && <span className="text-muted-foreground">{Math.round(evt.durationMs)}ms</span>}
                      <span className="text-[11px] text-muted-foreground">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Detail Modal / Panel */}
          {selectedEvent && (
            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Event Detail: {selectedEvent.id}
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Route:</span> <span className="font-mono font-medium">{selectedEvent.route || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-mono font-medium">{selectedEvent.statusCode || selectedEvent.severity}</span></div>
                <div><span className="text-muted-foreground">Duration:</span> <span className="font-mono font-medium">{selectedEvent.durationMs ? `${selectedEvent.durationMs}ms` : "N/A"}</span></div>
                <div><span className="text-muted-foreground">Timestamp:</span> <span className="font-mono font-medium">{new Date(selectedEvent.createdAt).toISOString()}</span></div>
              </div>
              {selectedEvent.metadata && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Sanitized Metadata:</span>
                  <pre className="text-[11px] p-3 rounded-lg bg-muted font-mono overflow-x-auto text-foreground">
                    {selectedEvent.metadata}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
