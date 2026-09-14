import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { GovernancePolicyService } from '@/ai/executive/governance/policy-service';
import { ExecutiveGovernanceEngine } from '@/ai/executive/governance/governance-engine';
import { GovernanceEvaluationInputSchema } from '@/ai/executive/governance/types';

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
    const parsedInput = GovernanceEvaluationInputSchema.parse(body);

    const policy = await GovernancePolicyService.getPolicy(user.organizationId);
    const evaluation = ExecutiveGovernanceEngine.evaluateStrategy(parsedInput, policy);

    return NextResponse.json({ evaluation }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/governance/evaluate POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Invalid governance evaluation request' }, { status: 400 });
  }
}
