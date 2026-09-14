import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { stripe } from '@/lib/billing/stripe';
import { grantCredits } from '@/lib/billing/credits';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Webhook signature missing or not configured' }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Signature Verification Failed: ${err.message}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Idempotency check
    const existingEvent = await prisma.webhookEvent.findUnique({ where: { stripeEventId: event.id } });
    if (existingEvent) {
      return NextResponse.json({ received: true, ignored: true, reason: 'Already processed' });
    }

    // Process event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const organizationId = subscription.metadata?.organizationId;
          
          if (!organizationId) {
            console.warn(`Subscription ${subscription.id} missing organizationId metadata`);
            break;
          }

          const priceId = subscription.items.data[0]?.price.id;
          if (!priceId) break;

          const plan = await prisma.plan.findUnique({ where: { stripePriceId: priceId } });
          if (!plan) break;

          await prisma.organizationBilling.upsert({
            where: { organizationId },
            create: {
              organizationId,
              planId: plan.id,
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            update: {
              planId: plan.id,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            }
          });

          // If active and just created or renewed, grant credits (using idempotency key of the period start to prevent duplicate grants)
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            const grantRefId = `${subscription.id}-${subscription.current_period_start}`;
            await grantCredits(organizationId, plan.monthlyCredits, 'SUBSCRIPTION_GRANT', grantRefId, `Monthly grant for ${plan.name}`);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const organizationId = subscription.metadata?.organizationId;
          
          if (organizationId) {
            await prisma.organizationBilling.update({
              where: { organizationId },
              data: { subscriptionStatus: 'canceled' }
            });
          }
          break;
        }
      }

      await prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          status: 'PROCESSED'
        }
      });

    } catch (processError: any) {
      console.error(`Webhook processing error for ${event.id}:`, processError);
      await prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          status: 'FAILED',
          error: processError.message
        }
      });
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook Error:', error.message);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
