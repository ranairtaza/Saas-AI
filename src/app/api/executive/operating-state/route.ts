import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveOperatingSystemService } from '@/ai/executive/operating-state/service';
import { ExecutiveValueLayer } from '@/ai/executive/executive-value-layer';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const state = await ExecutiveOperatingSystemService.getOperatingState(user.organizationId);

    // Synthesize business value layer on top of operating state
    const valueSynthesis = ExecutiveValueLayer.synthesize(state);

    return NextResponse.json({
      operatingState: state,
      valueSynthesis,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/operating-state GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get operating state' }, { status: 500 });
  }
}
