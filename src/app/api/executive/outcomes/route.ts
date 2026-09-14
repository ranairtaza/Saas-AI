import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveOutcomeService } from '@/ai/executive/outcomes/outcome-service';

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
    const domain = searchParams.get('domain') || undefined;
    const resultStatus = searchParams.get('resultStatus') || undefined;

    const outcomes = await ExecutiveOutcomeService.listOutcomes(user.organizationId, {
      status,
      domain,
      resultStatus,
    });

    return NextResponse.json({ outcomes }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/outcomes GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
