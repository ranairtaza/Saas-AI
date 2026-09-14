import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ActionEngine } from '@/ai/security/action-engine';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize Redis and Rate limiting defensively
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const redis = (redisUrl && redisToken && redisUrl.startsWith('https://') && !redisUrl.includes('...'))
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
}) : null;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ratelimit) {
      const { success, limit, reset, remaining } = await ratelimit.limit(`ai_action_approve_${user.id}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }
    }

    const { id } = await params;

    const context = {
      organizationId: user.organizationId,
      userId: user.id,
      role: user.role,
    };

    const resultApprove = await ActionEngine.approveAction(context, id);
    const result = await ActionEngine.executeApprovedAction(context, id);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error approving action:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
