import Stripe from 'stripe';
import prisma from '@/lib/db';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        // Build-time static analysis placeholder only
        return new Stripe('sk_test_placeholder_for_build', {
          apiVersion: '2026-08-26.dahlia' as any,
          appInfo: {
            name: 'LeadMachine',
            version: '1.0.0',
          },
        });
      }
      throw new Error(
        '[Stripe Configuration Error] STRIPE_SECRET_KEY is not configured. Billing operations are strictly fail-closed.'
      );
    }

    stripeInstance = new Stripe(key, {
      apiVersion: '2026-08-26.dahlia' as any,
      appInfo: {
        name: 'LeadMachine',
        version: '1.0.0',
      },
    });
  }
  return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
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
