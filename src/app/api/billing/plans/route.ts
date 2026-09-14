import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    if (plans.length === 0) {
      // Provide standard tiers if database is newly initialized
      const defaultTiers = [
        {
          name: 'Professional',
          slug: 'professional',
          description: 'Full AI Executive OS for growing companies and operators.',
          monthlyPrice: 4900,
          monthlyCredits: 500,
          active: true,
          stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL || null,
          features: JSON.stringify([
            'Executive Command Center',
            'Continuous Telemetry & Health Monitoring',
            'Human-Gated Decision Queue',
            'Outcome Attribution & Learning Signals',
            '500 Verified Lead Intelligence Credits/mo'
          ])
        },
        {
          name: 'Business',
          slug: 'business',
          description: 'Advanced intelligence, high-frequency monitoring, and extended governance.',
          monthlyPrice: 19900,
          monthlyCredits: 2500,
          active: true,
          stripePriceId: process.env.STRIPE_PRICE_BUSINESS || null,
          features: JSON.stringify([
            'Everything in Professional',
            'Multi-Integration Telemetry (Stripe + CRM)',
            'Custom Governance & Exposure Policies',
            'Scenario & Horizon Forecasting Engine',
            '2,500 Verified Lead Intelligence Credits/mo',
            'Priority Executive Support'
          ])
        }
      ];

      try {
        for (const tier of defaultTiers) {
          await prisma.plan.upsert({
            where: { slug: tier.slug },
            create: tier,
            update: {}
          });
        }
        plans = await prisma.plan.findMany({
          where: { active: true },
          orderBy: { monthlyPrice: 'asc' }
        });
      } catch (seedErr) {
        console.warn('Could not auto-seed plans:', seedErr);
      }
    }

    return NextResponse.json({ plans });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve plans' }, { status: 500 });
  }
}
