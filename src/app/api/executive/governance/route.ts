import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { GovernancePolicyService } from '@/ai/executive/governance/policy-service';
import { ExecutiveGovernancePolicySchema } from '@/ai/executive/governance/types';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const policy = await GovernancePolicyService.getPolicy(user.organizationId);
    return NextResponse.json({ policy }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/governance GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and OWNER can modify governance policies
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Insufficient governance authority' }, { status: 403 });
    }

    const body = await req.json();
    const parsedUpdates = ExecutiveGovernancePolicySchema.partial().parse(body);

    const updated = await GovernancePolicyService.updatePolicy(user.organizationId, parsedUpdates);
    return NextResponse.json({ policy: updated }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/governance PUT] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update governance policy' }, { status: 400 });
  }
}
