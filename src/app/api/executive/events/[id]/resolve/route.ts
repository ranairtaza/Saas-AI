import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveEventService } from '@/ai/executive/events/event-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to resolve executive events' }, { status: 403 });
    }

    const { id } = await params;

    await ExecutiveEventService.resolveEvent(
      user.organizationId,
      id,
      user.id
    );

    return NextResponse.json({ success: true, resolvedId: id }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/events/[id]/resolve POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
