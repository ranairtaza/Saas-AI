import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export type DependencyHealthState =
  | 'CONFIGURED'
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export async function GET() {
  const timestamp = new Date().toISOString();
  const since = new Date(Date.now() - 60 * 60 * 1000); // 1-hour operational window

  // 1. Database Check (Required core dependency)
  let dbStatus: DependencyHealthState = 'UNKNOWN';
  let dbLatency = 0;
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
    dbStatus = 'AVAILABLE';
  } catch (err: unknown) {
    dbStatus = 'UNAVAILABLE';
    console.error('[HealthCheck] DB query failed:', err);
  }

  // 2. Gemini AI Provider (Optional capability)
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  let geminiStatus: DependencyHealthState = 'NOT_CONFIGURED';
  if (geminiKey) {
    if (geminiKey === 'mock_key') {
      geminiStatus = 'DEGRADED';
    } else {
      try {
        const [recentAiError, recentAiSuccess] = await Promise.all([
          prisma.systemTelemetryEvent.findFirst({
            where: { eventType: 'AI_ERROR', createdAt: { gte: since } },
            select: { id: true },
          }).catch(() => null),
          prisma.aIUsageRecord.findFirst({
            where: { createdAt: { gte: since } },
            select: { id: true },
          }).catch(() => null),
        ]);

        if (recentAiError) {
          geminiStatus = 'DEGRADED';
        } else if (recentAiSuccess) {
          geminiStatus = 'AVAILABLE';
        } else {
          geminiStatus = 'CONFIGURED';
        }
      } catch {
        geminiStatus = 'CONFIGURED';
      }
    }
  }

  // 3. Stripe Billing Provider (Optional capability)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  let stripeStatus: DependencyHealthState = 'NOT_CONFIGURED';
  if (stripeKey) {
    try {
      const [failedWebhooks, processedWebhooks] = await Promise.all([
        prisma.webhookEvent.count({
          where: { status: 'FAILED', createdAt: { gte: since } },
        }).catch(() => 0),
        prisma.webhookEvent.count({
          where: { status: 'PROCESSED', createdAt: { gte: since } },
        }).catch(() => 0),
      ]);

      if (failedWebhooks > 5) {
        stripeStatus = 'DEGRADED';
      } else if (processedWebhooks > 0) {
        stripeStatus = 'AVAILABLE';
      } else {
        stripeStatus = 'CONFIGURED';
      }
    } catch {
      stripeStatus = 'CONFIGURED';
    }
  }

  // 4. Upstash Redis (Optional caching layer)
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const upstashStatus: DependencyHealthState = hasUpstash ? 'CONFIGURED' : 'NOT_CONFIGURED';

  // 5. Inngest Workflow Engine (Optional background processing)
  const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY);
  let inngestStatus: DependencyHealthState = 'NOT_CONFIGURED';
  if (hasInngest) {
    try {
      const failedJobs = await prisma.syncJob.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }).catch(() => 0);
      inngestStatus = failedJobs > 5 ? 'DEGRADED' : 'CONFIGURED';
    } catch {
      inngestStatus = 'CONFIGURED';
    }
  }

  // Application core readiness vs Optional integrations
  const applicationReadiness = dbStatus === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE';
  const hasDegradedOptional =
    geminiStatus === 'DEGRADED' ||
    stripeStatus === 'DEGRADED' ||
    inngestStatus === 'DEGRADED';

  const overallStatus =
    applicationReadiness === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : hasDegradedOptional
      ? 'DEGRADED'
      : 'AVAILABLE';

  const statusCode = overallStatus === 'UNAVAILABLE' ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      readiness: {
        application: applicationReadiness,
        requiredServicesOperational: dbStatus === 'AVAILABLE',
      },
      dependencies: {
        database: { status: dbStatus, latencyMs: dbLatency, required: true },
        ai: { status: geminiStatus, required: false },
        billing: { status: stripeStatus, required: false },
        cache: { status: upstashStatus, required: false },
        jobs: { status: inngestStatus, required: false },
      },
    },
    { status: statusCode }
  );
}
