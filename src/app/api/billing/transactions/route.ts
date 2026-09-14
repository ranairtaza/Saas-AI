import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const skip = parseInt(url.searchParams.get('skip') || '0');

    const transactions = await prisma.creditTransaction.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve transactions' }, { status: 500 });
  }
}
