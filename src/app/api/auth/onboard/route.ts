import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = await request.json();
    } catch (e) {
      // Body may be empty, which is fine for backward compatibility
    }

    // Wrap in a transaction to ensure both user and profile update together
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { onboarded: true }
      });

      if (payload.businessName) {
        await tx.businessProfile.upsert({
          where: { organizationId: user.organizationId },
          create: {
            organizationId: user.organizationId,
            businessName: payload.businessName,
            industry: payload.industry,
            businessModel: payload.businessModel,
            targetMarket: payload.targetMarket,
            operatingPriorities: payload.operatingPriorities
          },
          update: {
            businessName: payload.businessName,
            industry: payload.industry,
            businessModel: payload.businessModel,
            targetMarket: payload.targetMarket,
            operatingPriorities: payload.operatingPriorities
          }
        });
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Onboarding Error:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
