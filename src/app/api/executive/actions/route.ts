import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveActionPlanner } from '@/ai/executive/actions/action-planner';

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
    const domain = searchParams.get('domain') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const actions = await ExecutiveActionPlanner.listActionPlans(user.organizationId, {
      status,
      priority,
      domain,
      limit,
    });

    return NextResponse.json({ actions }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/actions GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list action plans' }, { status: 500 });
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

    const actions = await ExecutiveActionPlanner.planActions(user.organizationId, user.id);

    return NextResponse.json({ actions, count: actions.length }, { status: 201 });
  } catch (error: any) {
    console.error('[API /api/executive/actions POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to plan actions' }, { status: 500 });
  }
}
