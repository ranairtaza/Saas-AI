import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const whereClause: any = {
      organizationId: user.organizationId,
    };

    if (status) {
      whereClause.status = status;
    }

    const actions = await prisma.pendingAction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        actionName: true,
        actionType: true,
        humanDescription: true,
        riskLevel: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        requestingUserId: true,
        approvingUserId: true,
        failureReason: true,
      }
    });

    return NextResponse.json({ actions });
  } catch (error: any) {
    console.error('Error fetching actions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
