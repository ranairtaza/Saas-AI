import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createPortalSession } from '@/lib/billing/stripe';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Customer billing portal is unavailable because Stripe is not configured on this deployment.' },
        { status: 503 }
      );
    }

    const billing = await prisma.organizationBilling.findUnique({
      where: { organizationId: user.organizationId }
    });

    if (!billing || !billing.stripeCustomerId) {
      return NextResponse.json({ error: 'No active Stripe customer found' }, { status: 400 });
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const returnUrl = `${protocol}://${host}/billing`;

    const url = await createPortalSession(billing.stripeCustomerId, returnUrl);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Portal Error:', error.message);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
