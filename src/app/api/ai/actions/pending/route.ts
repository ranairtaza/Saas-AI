import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingActions = await prisma.pendingAction.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'WAITING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ data: pendingActions });
  } catch (error: any) {
    console.error('Fetch Pending Actions Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
