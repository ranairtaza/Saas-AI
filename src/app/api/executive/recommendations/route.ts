import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ExecutiveService } from '@/ai/executive/service';

/**
 * GET /api/executive/recommendations
 * Retrieves active executive recommendations for the organization.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 5;

    const recommendations = await ExecutiveService.getRecommendations(user.organizationId, {
      limit,
    });

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error('[API /api/executive/recommendations GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve executive recommendations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/executive/recommendations
 * Triggers on-demand executive reasoning to generate fresh recommendations.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recommendations = await ExecutiveService.generateAndStoreRecommendations(
      user.organizationId,
      user.id
    );

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error('[API /api/executive/recommendations POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate executive recommendations' },
      { status: 500 }
    );
  }
}
