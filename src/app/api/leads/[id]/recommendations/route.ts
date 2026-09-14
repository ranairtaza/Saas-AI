import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { WorkflowRoutingEngine } from '@/lib/leads/workflow/routing-engine';
import { DeterministicScoringEngine } from '@/lib/leads/scoring/engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate session
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Authorize & Verify lead belongs to organization
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 3. Load organization members for assignment target resolution
    const organizationUsers = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, email: true, role: true },
    });

    // 4. Parse enrichment and scoring context if available
    let enrichmentData = null;
    if (lead.enrichmentData) {
      try {
        enrichmentData = JSON.parse(lead.enrichmentData);
      } catch (e) {
        // Safe fallback for invalid JSON
      }
    }

    let aiQualification = null;
    if (lead.aiSummary) {
      try {
        aiQualification = JSON.parse(lead.aiSummary);
      } catch (e) {
        // Safe fallback for invalid JSON
      }
    }

    // Calculate scoreResult if enrichment data exists or score exists
    let scoreResult = null;
    if (enrichmentData || lead.score !== null) {
      scoreResult = DeterministicScoringEngine.score(
        {
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          phone: lead.phone,
          industry: null,
        },
        enrichmentData
      );
    }

    // 5. Generate deterministic recommendations (0 DB mutations)
    const recommendations = WorkflowRoutingEngine.generateRecommendations({
      lead: {
        id: lead.id,
        companyName: lead.companyName,
        domain: lead.domain,
        status: lead.status,
        ownerId: lead.ownerId,
        score: lead.score,
        scoreType: lead.scoreType,
        enrichmentData: lead.enrichmentData,
        aiSummary: lead.aiSummary,
      },
      scoreResult,
      aiQualification,
      organizationUsers,
    });

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error('Error fetching lead workflow recommendations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
