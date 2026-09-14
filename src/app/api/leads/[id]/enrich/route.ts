import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enrichmentService } from '@/lib/leads/enrichment/service';
import { DeterministicScoringEngine } from '@/lib/leads/scoring/engine';
import { AIQualificationService } from '@/ai/qualification';
import { getCurrentUser } from '@/lib/session';
import { getDatabaseWriteSafetyStatus } from '@/lib/db-guard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Authorize & Tenant ownership check
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 3. Normalize & Enrich
    const enrichmentData = await enrichmentService.enrichLead(lead.domain, lead.companyName);

    // 4. Score Deterministically
    const scoreResult = DeterministicScoringEngine.score(
      {
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        phone: lead.phone,
        industry: null, // Will fallback to enrichment industry
      },
      enrichmentData
    );

    // 5. AI Qualification (Structured summary)
    const aiQualification = await AIQualificationService.qualifyLead(
      lead,
      enrichmentData,
      scoreResult
    );

    // 6. Database write guard
    const writeSafety = getDatabaseWriteSafetyStatus();

    let updatedLead = lead;
    let persisted = false;

    // 7. Persist (only if database writes are explicitly permitted for LeadMachine)
    if (writeSafety.allowed) {
      updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          enrichmentData: enrichmentData ? JSON.stringify(enrichmentData) : null,
          score: scoreResult.score,
          scoreType: 'DETERMINISTIC',
          aiScore: scoreResult.score, // Storing identical to score to show AI didn't override it
          aiSummary: JSON.stringify(aiQualification),
        },
      });
      persisted = true;
    } else {
      console.info(`[DB Write Guard] Lead enrichment persistence blocked/disabled: ${writeSafety.reason}`);
      // In-memory updated representation for client display without database mutation
      updatedLead = {
        ...lead,
        enrichmentData: enrichmentData ? JSON.stringify(enrichmentData) : null,
        score: scoreResult.score,
        scoreType: 'DETERMINISTIC',
        aiScore: scoreResult.score,
        aiSummary: JSON.stringify(aiQualification),
      };
    }

    return NextResponse.json({
      success: true,
      persisted,
      lead: updatedLead,
      score: scoreResult,
      qualification: aiQualification,
      message: persisted
        ? 'Lead enrichment and qualification successfully persisted.'
        : 'Qualification computed, but persistence is disabled until the LeadMachine database is configured.'
    });
  } catch (error: any) {
    console.error('Error enriching lead:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
