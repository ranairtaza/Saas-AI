import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { logAudit } from '@/audit/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const insight = await prisma.businessInsight.findUnique({
      where: { id }
    });

    if (!insight || insight.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    return NextResponse.json({ insight });
  } catch (error: any) {
    console.error('Insight GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json(); // action = 'ACKNOWLEDGE' | 'DISMISS' | 'RESOLVE'

    if (!['ACKNOWLEDGE', 'DISMISS', 'RESOLVE'].includes(action)) {
       return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const insight = await prisma.businessInsight.findUnique({
      where: { id }
    });

    if (!insight || insight.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    const targetStatus = action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';

    const updatedInsight = await prisma.businessInsight.update({
      where: { id },
      data: { status: targetStatus }
    });

    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: `BUSINESS_INSIGHT_${targetStatus}` as any, // Legacy action
      resource: 'business_insight',
      resourceId: id,
      status: 'SUCCESS'
    });

    return NextResponse.json({ insight: updatedInsight });
  } catch (error: any) {
    console.error('Insight POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
