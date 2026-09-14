import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { DecisionOrchestrator } from '@/ai/executive/decisions/decision-orchestrator';
import { CreateDecisionInputSchema } from '@/ai/executive/decisions/types';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const decisions = await DecisionOrchestrator.listDecisions(user.organizationId, {
      status,
      priority,
      limit,
    });

    return NextResponse.json({ decisions }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/decisions GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsedInput = CreateDecisionInputSchema.parse({
      ...body,
      organizationId: user.organizationId,
      requestedByUserId: user.id,
    });

    const decision = await DecisionOrchestrator.createDecision(parsedInput);
    return NextResponse.json({ decision }, { status: 201 });
  } catch (error: any) {
    console.error('[API /api/executive/decisions POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create decision' }, { status: 400 });
  }
}
