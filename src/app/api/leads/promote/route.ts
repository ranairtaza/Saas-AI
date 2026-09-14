import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resultIds } = await request.json();

    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty resultIds array' }, { status: 400 });
    }

    // Fetch the DiscoveryResults to ensure they belong to the user's organization
    const results = await prisma.discoveryResult.findMany({
      where: {
        id: { in: resultIds },
        organizationId: user.organizationId
      }
    });

    if (results.length === 0) {
      return NextResponse.json({ error: 'No valid results found' }, { status: 404 });
    }

    let promotedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const result of results) {
        // Double check duplication to avoid unique constraint violations
        const orConditions: any[] = [];
          
        if (result.contactEmail) {
          orConditions.push({ contactEmail: result.contactEmail });
        } else if (result.domain) {
          if (result.contactName) {
              orConditions.push({ domain: result.domain, contactName: result.contactName });
          } else {
              orConditions.push({ domain: result.domain, contactEmail: null, contactName: null });
          }
        }

        let isExisting = false;
        if (orConditions.length > 0) {
          const existing = await tx.lead.findFirst({
            where: {
              organizationId: user.organizationId,
              OR: orConditions
            }
          });
          if (existing) isExisting = true;
        }

        if (!isExisting) {
          await tx.lead.create({
            data: {
              organizationId: result.organizationId,
              companyName: result.companyName,
              domain: result.domain,
              contactName: result.contactName,
              contactEmail: result.contactEmail,
              contactTitle: result.contactTitle,
              phone: result.phone,
              location: result.location,
              enrichmentData: result.metadata,
              score: result.score,
              source: result.provider
            }
          });
          promotedCount++;
        }
        
        // Remove the staging result regardless of duplication so it doesn't clutter the UI
        await tx.discoveryResult.delete({
          where: { id: result.id }
        });
      }
    });

    return NextResponse.json({ success: true, promoted: promotedCount, total: results.length }, { status: 200 });

  } catch (error: any) {
    console.error(`Promotion API Error:`, error);
    return NextResponse.json({ error: 'Failed to promote leads' }, { status: 500 });
  }
}
