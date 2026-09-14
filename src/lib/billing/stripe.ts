import Stripe from 'stripe';
import prisma from '@/lib/db';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  throw new Error('P0 BLOCKER: STRIPE_SECRET_KEY is required in production environments.');
}

export const stripe = new Stripe(stripeSecretKey || 'sk_test_mock', {
  apiVersion: '2026-08-26.dahlia' as any, // Best practice is to lock apiVersion
  appInfo: {
    name: 'LeadMachine',
    version: '0.1.0',
  }
});

/**
 * Creates or retrieves a Stripe Customer ID for an organization
 */
export async function getOrCreateStripeCustomer(organizationId: string, email: string, name: string): Promise<string> {
  let billing = await prisma.organizationBilling.findUnique({ where: { organizationId } });
  
  if (billing?.stripeCustomerId) {
    return billing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      organizationId
    }
  });

  if (billing) {
    await prisma.organizationBilling.update({
      where: { organizationId },
      data: { stripeCustomerId: customer.id }
    });
  }

  return customer.id;
}

/**
 * Creates a Stripe Checkout session for a given Plan
 */
export async function createCheckoutSession(
  organizationId: string, 
  stripeCustomerId: string, 
  priceId: string, 
  successUrl: string, 
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        organizationId
      }
    },
    client_reference_id: organizationId
  });

  return session.url;
}

/**
 * Creates a Customer Portal session for billing management
 */
export async function createPortalSession(stripeCustomerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}
