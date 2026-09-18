import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = 'UNKNOWN';
  let dbLatency = 0;

  // 1. Check PostgreSQL Database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
    dbStatus = 'HEALTHY';
  } catch (err: unknown) {
    dbStatus = 'UNAVAILABLE';
    console.error('[HealthCheck] DB check failed:', err);
  }

  // 2. Check Gemini AI Provider
  const hasGemini = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
  const geminiStatus = hasGemini ? 'HEALTHY' : 'NOT_CONFIGURED';

  // 3. Check Stripe
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const stripeStatus = hasStripe ? 'HEALTHY' : 'NOT_CONFIGURED';

  // 4. Check Upstash Redis
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const upstashStatus = hasUpstash ? 'HEALTHY' : 'NOT_CONFIGURED';

  // 5. Check Inngest
  const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY);
  const inngestStatus = hasInngest ? 'HEALTHY' : 'NOT_CONFIGURED';

  const overallStatus = dbStatus === 'HEALTHY'
    ? (hasGemini && hasStripe ? 'HEALTHY' : 'DEGRADED')
    : 'UNAVAILABLE';

  const statusCode = overallStatus === 'UNAVAILABLE' ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      dependencies: {
        database: { status: dbStatus, latencyMs: dbLatency },
        ai: { status: geminiStatus },
        billing: { status: stripeStatus },
        cache: { status: upstashStatus },
        jobs: { status: inngestStatus },
      },
    },
    { status: statusCode }
  );
}
