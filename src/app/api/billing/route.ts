import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getCreditBalance } from '@/lib/billing/credits';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const billing = await prisma.organizationBilling.findUnique({
      where: { organizationId: user.organizationId },
      include: { plan: true }
    });

    const balance = await getCreditBalance(user.organizationId);

    const transactions = await prisma.creditTransaction.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      billing: billing ? {
        planName: billing.plan.name,
        monthlyCredits: billing.plan.monthlyCredits,
        subscriptionStatus: billing.subscriptionStatus,
        stripeCustomerId: billing.stripeCustomerId
      } : null,
      balance,
      transactions
    });
  } catch (error: any) {
    console.error('Billing GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to retrieve billing info' }, { status: 500 });
  }
}
