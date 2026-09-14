import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { BusinessContextBuilder } from '@/ai/executive/context-builder';
import { ScenarioSimulationEngine } from '@/ai/executive/strategy/scenario-engine';
import { ScenarioSimulationRequestSchema } from '@/ai/executive/strategy/types';

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
    const parsedRequest = ScenarioSimulationRequestSchema.parse({
      ...body,
      organizationId: user.organizationId,
    });

    const context = await BusinessContextBuilder.buildBusinessContext(user.organizationId);
    const result = ScenarioSimulationEngine.simulate(context, parsedRequest);

    return NextResponse.json({ simulation: result }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/strategy/simulate POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Invalid simulation request' }, { status: 400 });
  }
}
