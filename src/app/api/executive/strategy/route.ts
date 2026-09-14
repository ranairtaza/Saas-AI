import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { BusinessContextBuilder } from '@/ai/executive/context-builder';
import { MultiDomainStrategyEngine } from '@/ai/executive/strategy/strategy-engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const context = await BusinessContextBuilder.buildBusinessContext(user.organizationId);
    const { GovernancePolicyService } = await import('@/ai/executive/governance/policy-service');
    const policy = await GovernancePolicyService.getPolicy(user.organizationId);
    const strategyAnalysis = MultiDomainStrategyEngine.synthesizeStrategy(context, policy);

    return NextResponse.json({ strategy: strategyAnalysis }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/strategy GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
