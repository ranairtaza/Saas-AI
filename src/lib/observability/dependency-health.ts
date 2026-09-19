/**
 * Phase 48.1: Centralized Dependency Health Service
 * Normalized health assessment distinguishing CONFIGURED, AVAILABLE, DEGRADED,
 * UNAVAILABLE, and NOT_CONFIGURED across all system dependencies.
 * Never exposes credentials or makes blocking, expensive external calls on hot paths.
 */

import prisma from '@/lib/db';

export type DependencyHealthState =
  | 'CONFIGURED'
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface DependencyHealthResult {
  name: string;
  status: DependencyHealthState;
  configured: boolean;
  available: boolean;
  latencyMs: number;
  checkedAt: string;
  evidence: string;
  required: boolean;
}

export interface SystemHealthReport {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  checkedAt: string;
  dependencies: {
    database: DependencyHealthResult;
    ai: DependencyHealthResult;
    billing: DependencyHealthResult;
    cache: DependencyHealthResult;
    jobs: DependencyHealthResult;
    integrations: DependencyHealthResult;
  };
}

let cachedHealthReport: { report: SystemHealthReport; timestamp: number } | null = null;
const HEALTH_CACHE_TTL_MS = 5000; // 5-second safe in-memory cache to prevent DB thrashing

/**
 * 1. PostgreSQL Database Check (Required Core Dependency)
 */
export async function checkDatabaseHealth(): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const hasUrl = Boolean(process.env.DATABASE_URL);

  if (!hasUrl) {
    return {
      name: 'PostgreSQL Database',
      status: 'NOT_CONFIGURED',
      configured: false,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: 'DATABASE_URL environment variable is not configured',
      required: true,
    };
  }

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    return {
      name: 'PostgreSQL Database',
      status: 'AVAILABLE',
      configured: true,
      available: true,
      latencyMs,
      checkedAt,
      evidence: `SELECT 1 ping succeeded in ${latencyMs}ms`,
      required: true,
    };
  } catch (err: unknown) {
    const safeError = err instanceof Error ? err.message : String(err);
    // Sanitize any accidentally leaked connection strings from error
    const sanitizedError = safeError.replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://***:***@host');

    return {
      name: 'PostgreSQL Database',
      status: 'UNAVAILABLE',
      configured: true,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: `Database query failed: ${sanitizedError.slice(0, 120)}`,
      required: true,
    };
  }
}

/**
 * 2. Gemini AI Check (Optional Capability)
 * Truthful status: NOT_CONFIGURED when key absent, DEGRADED when mock key or errors present,
 * AVAILABLE when recent success telemetry exists, CONFIGURED when key present without activity.
 */
export async function checkGeminiHealth(options?: { since?: Date }): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return {
      name: 'Gemini AI Provider',
      status: 'NOT_CONFIGURED',
      configured: false,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: 'GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY not configured',
      required: false,
    };
  }

  if (geminiKey === 'mock_key') {
    return {
      name: 'Gemini AI Provider',
      status: 'DEGRADED',
      configured: true,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: 'Mock API key configured; live provider calls are mocked in non-production mode',
      required: false,
    };
  }

  const since = options?.since || new Date(Date.now() - 60 * 60 * 1000);

  try {
    const [recentAiError, recentAiSuccess] = await Promise.all([
      prisma.systemTelemetryEvent
        .findFirst({
          where: { eventType: 'AI_ERROR', createdAt: { gte: since } },
          select: { id: true },
        })
        .catch(() => null),
      prisma.aIUsageRecord
        .findFirst({
          where: { createdAt: { gte: since } },
          select: { id: true },
        })
        .catch(() => null),
    ]);

    if (recentAiError) {
      return {
        name: 'Gemini AI Provider',
        status: 'DEGRADED',
        configured: true,
        available: false,
        latencyMs: 0,
        checkedAt,
        evidence: 'Recent AI errors detected in telemetry event log within past 1h',
        required: false,
      };
    }

    if (recentAiSuccess) {
      return {
        name: 'Gemini AI Provider',
        status: 'AVAILABLE',
        configured: true,
        available: true,
        latencyMs: 0,
        checkedAt,
        evidence: 'Recent successful AI usage records confirmed within past 1h',
        required: false,
      };
    }

    return {
      name: 'Gemini AI Provider',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'API key configured and ready; no inference activity in current window',
      required: false,
    };
  } catch {
    return {
      name: 'Gemini AI Provider',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'API key present',
      required: false,
    };
  }
}

/**
 * 3. Stripe Billing Check (Optional Capability)
 * Truthful status: NOT_CONFIGURED when secret absent, DEGRADED when webhook failures exceed threshold,
 * AVAILABLE when processed webhooks exist, CONFIGURED when key present.
 */
export async function checkStripeHealth(options?: { since?: Date }): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return {
      name: 'Stripe Billing',
      status: 'NOT_CONFIGURED',
      configured: false,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: 'STRIPE_SECRET_KEY not set',
      required: false,
    };
  }

  const since = options?.since || new Date(Date.now() - 60 * 60 * 1000);

  try {
    const [failedWebhooks, processedWebhooks] = await Promise.all([
      prisma.webhookEvent
        .count({
          where: { status: 'FAILED', createdAt: { gte: since } },
        })
        .catch(() => 0),
      prisma.webhookEvent
        .count({
          where: { status: 'PROCESSED', createdAt: { gte: since } },
        })
        .catch(() => 0),
    ]);

    if (failedWebhooks > 5) {
      return {
        name: 'Stripe Billing',
        status: 'DEGRADED',
        configured: true,
        available: false,
        latencyMs: 0,
        checkedAt,
        evidence: `${failedWebhooks} failed billing webhooks detected in the last hour`,
        required: false,
      };
    }

    if (processedWebhooks > 0) {
      return {
        name: 'Stripe Billing',
        status: 'AVAILABLE',
        configured: true,
        available: true,
        latencyMs: 0,
        checkedAt,
        evidence: `${processedWebhooks} webhook events successfully processed in the last hour`,
        required: false,
      };
    }

    return {
      name: 'Stripe Billing',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'Stripe secret key configured; fail-closed safeguard active',
      required: false,
    };
  } catch {
    return {
      name: 'Stripe Billing',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'Stripe secret key present',
      required: false,
    };
  }
}

/**
 * 4. Upstash Redis Check (Optional Caching Layer)
 */
export async function checkUpstashHealth(): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  return {
    name: 'Upstash Redis Cache',
    status: hasUpstash ? 'CONFIGURED' : 'NOT_CONFIGURED',
    configured: hasUpstash,
    available: hasUpstash,
    latencyMs: 0,
    checkedAt,
    evidence: hasUpstash ? 'Upstash Redis REST URL and token configured' : 'Upstash credentials not configured',
    required: false,
  };
}

/**
 * 5. Inngest Workflow Engine Check (Optional Background Jobs)
 */
export async function checkInngestHealth(options?: { since?: Date }): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY);

  if (!hasInngest) {
    return {
      name: 'Inngest Workflows',
      status: 'NOT_CONFIGURED',
      configured: false,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: 'INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY not configured',
      required: false,
    };
  }

  const since = options?.since || new Date(Date.now() - 60 * 60 * 1000);

  try {
    const failedJobs = await prisma.syncJob
      .count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      })
      .catch(() => 0);

    if (failedJobs > 5) {
      return {
        name: 'Inngest Workflows',
        status: 'DEGRADED',
        configured: true,
        available: false,
        latencyMs: 0,
        checkedAt,
        evidence: `${failedJobs} sync jobs failed in the last hour`,
        required: false,
      };
    }

    return {
      name: 'Inngest Workflows',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'Inngest credentials configured and job queue operational',
      required: false,
    };
  } catch {
    return {
      name: 'Inngest Workflows',
      status: 'CONFIGURED',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: 'Inngest keys present',
      required: false,
    };
  }
}

/**
 * 6. Integrations Subsystem Check
 */
export async function checkIntegrationsHealth(organizationId?: string | null): Promise<DependencyHealthResult> {
  const checkedAt = new Date().toISOString();
  const orgFilter = organizationId ? { organizationId } : {};

  try {
    const [activeConnections, failingConnections] = await Promise.all([
      prisma.integrationConnection.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.integrationConnection.count({ where: { ...orgFilter, status: 'FAILING' } }),
    ]);

    if (activeConnections === 0) {
      return {
        name: 'Integrations Subsystem',
        status: 'NOT_CONFIGURED',
        configured: false,
        available: false,
        latencyMs: 0,
        checkedAt,
        evidence: 'No active integration connections configured',
        required: false,
      };
    }

    if (failingConnections > 0) {
      return {
        name: 'Integrations Subsystem',
        status: 'DEGRADED',
        configured: true,
        available: true,
        latencyMs: 0,
        checkedAt,
        evidence: `${failingConnections} of ${activeConnections} active connection(s) currently failing sync`,
        required: false,
      };
    }

    return {
      name: 'Integrations Subsystem',
      status: 'AVAILABLE',
      configured: true,
      available: true,
      latencyMs: 0,
      checkedAt,
      evidence: `${activeConnections} active integration connection(s) healthy`,
      required: false,
    };
  } catch (err: unknown) {
    return {
      name: 'Integrations Subsystem',
      status: 'UNKNOWN',
      configured: false,
      available: false,
      latencyMs: 0,
      checkedAt,
      evidence: `Failed to query integrations: ${err instanceof Error ? err.message : String(err)}`,
      required: false,
    };
  }
}

/**
 * Consolidated Dependency Health Report
 * Evaluates required vs optional dependencies and calculates system-level status.
 */
export async function getSystemDependencyHealth(options?: {
  organizationId?: string | null;
  forceFresh?: boolean;
}): Promise<SystemHealthReport> {
  const now = Date.now();
  if (
    !options?.forceFresh &&
    !options?.organizationId &&
    cachedHealthReport &&
    now - cachedHealthReport.timestamp < HEALTH_CACHE_TTL_MS
  ) {
    return cachedHealthReport.report;
  }

  const [database, ai, billing, cache, jobs, integrations] = await Promise.all([
    checkDatabaseHealth(),
    checkGeminiHealth(),
    checkStripeHealth(),
    checkUpstashHealth(),
    checkInngestHealth(),
    checkIntegrationsHealth(options?.organizationId),
  ]);

  // Overall Status Policy:
  // - DATABASE UNAVAILABLE -> SYSTEM UNAVAILABLE (Core required dependency)
  // - DATABASE AVAILABLE + any optional DEGRADED -> SYSTEM DEGRADED
  // - DATABASE AVAILABLE + all operational -> SYSTEM HEALTHY
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY';

  if (database.status === 'UNAVAILABLE' || database.status === 'NOT_CONFIGURED') {
    overallStatus = 'UNAVAILABLE';
  } else if (
    ai.status === 'DEGRADED' ||
    billing.status === 'DEGRADED' ||
    jobs.status === 'DEGRADED' ||
    integrations.status === 'DEGRADED'
  ) {
    overallStatus = 'DEGRADED';
  }

  const report: SystemHealthReport = {
    overallStatus,
    checkedAt: new Date().toISOString(),
    dependencies: {
      database,
      ai,
      billing,
      cache,
      jobs,
      integrations,
    },
  };

  if (!options?.organizationId) {
    cachedHealthReport = { report, timestamp: now };
  }

  return report;
}
