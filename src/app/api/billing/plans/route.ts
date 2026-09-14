import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const plans = await prisma.plan.findMany({
      where: { active: true }
    });

    return NextResponse.json({ plans });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve plans' }, { status: 500 });
  }
}
