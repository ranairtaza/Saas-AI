import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const action = await prisma.pendingAction.findUnique({
      where: {
        id,
        organizationId: user.organizationId,
      },
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
        executionResult: true,
      }
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    return NextResponse.json({ action });
  } catch (error: any) {
    console.error('Error fetching action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
