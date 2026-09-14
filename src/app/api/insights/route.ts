import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause: any = { organizationId: user.organizationId };
    
    if (status) {
      whereClause.status = status;
    } else {
      // Default: fetch active insights
      whereClause.status = { in: ['NEW', 'ACKNOWLEDGED'] };
    }

    const insights = await prisma.businessInsight.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('Insights GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
