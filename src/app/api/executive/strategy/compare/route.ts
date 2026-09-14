import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { StrategyScoringEngine } from '@/ai/executive/strategy/strategy-score';
import { StrategicOptionSchema } from '@/ai/executive/strategy/types';
import { z } from 'zod';

const CompareRequestSchema = z.object({
  options: z.array(StrategicOptionSchema).min(1),
  historicalInsights: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CompareRequestSchema.parse(body);

    const comparison = StrategyScoringEngine.compareStrategies(
      user.organizationId,
      parsed.options,
      parsed.historicalInsights
    );

    return NextResponse.json({ comparison }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/strategy/compare POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Invalid strategy comparison request' }, { status: 400 });
  }
}
