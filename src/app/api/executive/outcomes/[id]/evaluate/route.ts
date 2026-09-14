import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveOutcomeService } from '@/ai/executive/outcomes/outcome-service';

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
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to evaluate executive outcomes' },
        { status: 403 }
      );
    }

    const { id } = await params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is valid
    }

    const evaluated = await ExecutiveOutcomeService.evaluateOutcome(
      user.organizationId,
      id,
      { isEarly: body.forceEarly, userId: user.id }
    );

    return NextResponse.json({ success: true, outcome: evaluated }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/outcomes/[id]/evaluate POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
