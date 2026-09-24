import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/billing/stripe';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user.role, PERMISSIONS.BILLING_MANAGE)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { planId } = await request.json();
    if (!planId) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 });
    if (!plan.stripePriceId) return NextResponse.json({ error: 'Plan does not have a Stripe price configured' }, { status: 400 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe payments are not configured on this deployment. Please configure STRIPE_SECRET_KEY in environment variables.' },
        { status: 503 }
      );
    }

    const customerId = await getOrCreateStripeCustomer(user.organizationId, user.email, user.name || user.email);

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const successUrl = `${protocol}://${host}/billing?success=true`;
    const cancelUrl = `${protocol}://${host}/billing?canceled=true`;

    const url = await createCheckoutSession(
      user.organizationId,
      customerId,
      plan.stripePriceId,
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Checkout Error:', error.message);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
