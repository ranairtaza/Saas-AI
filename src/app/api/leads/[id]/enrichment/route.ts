import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getDatabaseWriteSafetyStatus } from '@/lib/db-guard';
import { logAudit } from '@/audit/logger';
import { enrichmentOrchestrator } from '@/lib/leads/enrichment/orchestrator';
import { DeterministicScoringEngine } from '@/lib/leads/scoring/engine';
import { AIQualificationService } from '@/ai/qualification';
import { computeOutreachContextHash } from '@/lib/leads/outreach/context-builder';
import { TriggerEnrichmentRequestSchema } from '@/lib/leads/enrichment/types';

/**
 * GET /api/leads/[id]/enrichment
 * Retrieves the latest consolidated enrichment intelligence, evidence items, and conflicts.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        enrichmentRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { evidence: true },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let parsedSnapshot: any = null;
    if (lead.enrichmentData) {
      try {
        parsedSnapshot = JSON.parse(lead.enrichmentData);
      } catch {
        parsedSnapshot = null;
      }
    }

    const latestRun = lead.enrichmentRuns[0];

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      isFresh: true,
      lastEnrichedAt: parsedSnapshot?.enrichedAt || lead.updatedAt,
      snapshot: parsedSnapshot,
      evidence: latestRun?.evidence || parsedSnapshot?.evidence || [],
      conflicts: parsedSnapshot?.conflicts || [],
      providersCompleted: parsedSnapshot?.providersCompleted || [parsedSnapshot?.sourceProvider || 'mock-enrichment'],
    });
  } catch (error: any) {
    console.error('[Enrichment GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id]/enrichment
 * Triggers an on-demand multi-source lead enrichment run with provenance tracking and stale outreach invalidation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        outreachDrafts: {
          where: { status: { in: ['DRAFT', 'EDITED', 'PENDING_APPROVAL', 'APPROVED'] } },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parseResult = TriggerEnrichmentRequestSchema.safeParse(body);
    const options = parseResult.success ? parseResult.data : { forceRefresh: false };

    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'ENRICHMENT_REQUESTED',
      resource: `lead:${lead.id}`,
      status: 'SUCCESS',
      details: {
        requestedProviders: options.providers || 'ALL_APPLICABLE',
        forceRefresh: options.forceRefresh,
      },
    });

    // 1. Run Multi-Source Orchestration
    const snapshot = await enrichmentOrchestrator.enrichLead(
      {
        leadId: lead.id,
        companyName: lead.companyName,
        domain: lead.domain,
        contactName: lead.contactName,
        contactTitle: lead.contactTitle,
        location: lead.location,
      },
      options.providers
    );

    // 2. Score Deterministically (Authoritative score invariant)
    const scoreResult = DeterministicScoringEngine.score(
      {
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        phone: lead.phone,
        industry: null,
      },
      snapshot
    );

    // 3. AI Qualification Summary
    const aiQualification = await AIQualificationService.qualifyLead(
      lead,
      snapshot,
      scoreResult
    );

    // 4. Compute context hash to check if outreach drafts become STALE
    const newContextHash = computeOutreachContextHash({
      leadId: lead.id,
      companyName: lead.companyName,
      domain: lead.domain,
      contactTitle: lead.contactTitle,
      score: scoreResult.score,
      scoreCategory: scoreResult.category,
      enrichmentDataString: JSON.stringify(snapshot),
    });

    const writeSafety = getDatabaseWriteSafetyStatus();
    let staleOutreachTriggered = false;

    if (writeSafety.allowed) {
      // 5. Create EnrichmentRun record
      const run = await prisma.enrichmentRun.create({
        data: {
          organizationId: user.organizationId,
          leadId: lead.id,
          status: 'COMPLETED',
          providersRequested: JSON.stringify(options.providers || enrichmentOrchestrator.getRegisteredProviders()),
          providersCompleted: JSON.stringify(snapshot.providersCompleted),
          requestedBy: user.id,
          completedAt: new Date(),
        },
      });

      // 6. Create relational evidence items
      if (snapshot.evidence && snapshot.evidence.length > 0) {
        await prisma.enrichmentEvidence.createMany({
          data: snapshot.evidence.map((item) => ({
            organizationId: user.organizationId,
            leadId: lead.id,
            runId: run.id,
            field: item.field,
            value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
            sourceType: item.sourceType,
            sourceUrl: item.sourceUrl || null,
            provider: item.provider,
            confidence: item.confidence,
            verificationStatus: item.verificationStatus,
            observedAt: new Date(item.observedAt),
            expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          })),
        });
      }

      // 7. Update Lead with consolidated snapshot and score
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          enrichmentData: JSON.stringify(snapshot),
          score: scoreResult.score,
          scoreType: 'DETERMINISTIC',
          aiScore: scoreResult.score,
          aiSummary: JSON.stringify(aiQualification),
        },
      });

      // 8. LeadActivity history
      await prisma.leadActivity.create({
        data: {
          organizationId: user.organizationId,
          leadId: lead.id,
          userId: user.id,
          type: 'SYSTEM',
          content: `Lead enriched via multi-source intelligence (${snapshot.providersCompleted.join(', ')}). Score: ${scoreResult.score}/100.`,
        },
      });

      // 9. Stale draft detection
      for (const draft of lead.outreachDrafts) {
        if (draft.contextHash !== newContextHash) {
          staleOutreachTriggered = true;
          await prisma.outreachDraft.update({
            where: { id: draft.id },
            data: { status: 'STALE' },
          });

          await logAudit({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'OUTREACH_DRAFT_STALE',
            resource: `outreachDraft:${draft.id}`,
            status: 'SUCCESS',
            details: { reason: 'Lead enrichment updated' },
          });
        }
      }

      await logAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'ENRICHMENT_COMPLETED',
        resource: `lead:${lead.id}`,
        status: 'SUCCESS',
        details: {
          runId: run.id,
          providers: snapshot.providersCompleted,
          evidenceCount: snapshot.evidence.length,
          conflictsCount: snapshot.conflicts.length,
          score: scoreResult.score,
        },
      });

      return NextResponse.json({
        success: true,
        persisted: true,
        runId: run.id,
        status: 'COMPLETED',
        snapshot,
        score: scoreResult,
        qualification: aiQualification,
        staleOutreachTriggered,
      });
    }

    // In-memory mock response when writes are disabled
    for (const draft of lead.outreachDrafts) {
      if (draft.contextHash !== newContextHash) {
        staleOutreachTriggered = true;
      }
    }

    return NextResponse.json({
      success: true,
      persisted: false,
      runId: 'mock-run-id',
      status: 'COMPLETED',
      snapshot,
      score: scoreResult,
      qualification: aiQualification,
      staleOutreachTriggered,
      message: 'Enrichment computed successfully (in-memory mode).',
    });
  } catch (error: any) {
    console.error('[Enrichment POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
