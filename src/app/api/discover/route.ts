import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { z } from 'zod';
import { reserveCredits } from '@/lib/billing/credits';
import { discoveryRatelimit } from '@/lib/rate-limit';
import { inngest } from '@/lib/inngest/client';

const discoverSchema = z.object({
  industry: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  jobTitles: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(500).default(50),
  provider: z.string().default('apollo'),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = discoverSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input data', details: result.error.format() }, { status: 400 });
    }

    // Upstash Redis Rate Limiting
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        if (discoveryRatelimit) {
          const { success } = await discoveryRatelimit.limit(`discover:${user.organizationId}`);
          if (!success) {
            return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
          }
        }
      } catch (redisError) {
        console.error('Redis Rate Limit Error:', redisError);
        // Fail open if redis is down in development, but in production we might want to fail closed.
        // For phase 10 MVP, failing open on network error allows testing if redis is misconfigured, 
        // but let's log it.
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server misconfiguration: UPSTASH_REDIS_REST_URL is missing.' }, { status: 500 });
    }

    const limit = result.data.limit || 10;
    
    // Create a Discovery Job
    let job = await prisma.discoveryJob.create({
      data: {
        organizationId: user.organizationId,
        status: 'QUEUED',
        criteria: JSON.stringify(result.data),
        total: limit
      }
    });

    // Credit System: Attempt to reserve credits before spawning processing
    try {
      await reserveCredits(user.organizationId, limit, 'DISCOVERY_JOB', job.id, `Reservation for ${limit} leads`);
    } catch (err: any) {
      // Mark job failed if reserve fails
      await prisma.discoveryJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: 'Insufficient credits' }
      });
      return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan or wait for the next billing cycle.' }, { status: 402 });
    }

    // Trigger Inngest background processing asynchronously
    await inngest.send({
      name: 'discovery.job.process',
      data: {
        jobId: job.id,
        organizationId: user.organizationId
      }
    });

    return NextResponse.json({ 
      jobId: job.id,
      status: 'QUEUED'
    }, { status: 200 });

  } catch (error) {
    console.error('Discovery Queue Error:', error);
    return NextResponse.json({ error: 'Failed to queue discovery job' }, { status: 500 });
  }
}
