import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { BusinessContextBuilder } from '@/ai/executive/context-builder';

/**
 * GET /api/executive/context
 * Assembles and returns the authoritative BusinessContext for the caller's organization.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const context = await BusinessContextBuilder.buildBusinessContext(user.organizationId);

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (error: any) {
    console.error('[API /api/executive/context] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assemble business context' },
      { status: 500 }
    );
  }
}
