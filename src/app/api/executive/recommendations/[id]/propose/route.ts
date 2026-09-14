import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ExecutiveService } from '@/ai/executive/service';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

/**
 * POST /api/executive/recommendations/[id]/propose
 * Bridges an executive recommendation into an ActionEngine PendingAction.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const result = await ExecutiveService.proposeRecommendationAction(
      user.organizationId,
      id,
      user.id,
      body.conversationId
    );

    return NextResponse.json({
      success: true,
      recommendation: result.recommendation,
      pendingActionId: result.pendingActionId,
      message: 'Executive recommendation successfully staged as a governed pending action.',
    });
  } catch (error: any) {
    console.error('[API /api/executive/recommendations/[id]/propose] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to propose executive action' },
      { status: 500 }
    );
  }
}
