import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { hasPermission } from '@/permissions/rbac';
import {
  GenerateDraftRequestSchema,
  UpdateDraftRequestSchema,
  OutreachDraftPayload,
  OutreachIntelligence,
} from '@/lib/leads/outreach/types';
import { buildOutreachContext, computeOutreachContextHash } from '@/lib/leads/outreach/context-builder';
import { AIOutreachService } from '@/lib/leads/outreach/service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'lead:read')) {
      return NextResponse.json({ error: 'Permission denied: Missing lead:read' }, { status: 403 });
    }

    const resolvedParams = await params;
    const leadId = resolvedParams.id;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
    }

    // Load draft if DB writes allowed
    if (isDatabaseWritesAllowed()) {
      const draft = await prisma.outreachDraft.findFirst({
        where: { leadId, organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (draft) {
        const currentContextHash = computeOutreachContextHash({
          leadId: lead.id,
          companyName: lead.companyName,
          domain: lead.domain,
          contactTitle: lead.contactTitle,
          score: lead.score,
          scoreCategory: lead.score ? (lead.score >= 75 ? 'HIGH' : lead.score >= 50 ? 'MEDIUM' : 'LOW') : null,
          enrichmentDataString: lead.enrichmentData,
        });

        const isStale = draft.contextHash !== currentContextHash;
        let parsedIntelligence: OutreachIntelligence;
        try {
          parsedIntelligence = JSON.parse(draft.intelligence);
        } catch {
          parsedIntelligence = {
            leadId,
            verifiedEvidence: [],
            observations: [],
            opportunityHypotheses: [],
            valueProposition: '',
            recommendedAngle: '',
            recommendedCTA: '',
            confidence: 'MEDIUM',
            confidenceRationale: '',
          };
        }

        const payload: OutreachDraftPayload = {
          id: draft.id,
          organizationId: draft.organizationId,
          leadId: draft.leadId,
          subject: draft.subject,
          body: draft.body,
          tone: draft.tone as any,
          intelligence: parsedIntelligence,
          generationMode: draft.generationMode as any,
          contextHash: draft.contextHash,
          isStale,
          version: draft.version,
          status: (isStale && draft.status !== 'APPROVED' ? 'STALE' : draft.status) as any,
          createdBy: draft.createdBy,
          approvedBy: draft.approvedBy,
          rejectedBy: draft.rejectedBy,
          rejectionReason: draft.rejectionReason,
          pendingActionId: draft.pendingActionId,
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
          approvedAt: draft.approvedAt ? draft.approvedAt.toISOString() : null,
        };

        return NextResponse.json({ success: true, draft: payload });
      }
    }

    return NextResponse.json({ success: true, draft: null });
  } catch (error: any) {
    console.error('[Outreach GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'lead:read')) {
      return NextResponse.json({ error: 'Permission denied: Missing lead:read' }, { status: 403 });
    }

    const resolvedParams = await params;
    const leadId = resolvedParams.id;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = GenerateDraftRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parseResult.error.format() }, { status: 400 });
    }

    const { tone, customAngle, forceRegenerate } = parseResult.data;

    // Load lead with organization isolation
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
    }

    // Build authoritative context & hash
    const context = buildOutreachContext(lead);

    // If draft already exists and is fresh and not forcing regeneration, return cached
    if (isDatabaseWritesAllowed() && !forceRegenerate) {
      const existing = await prisma.outreachDraft.findFirst({
        where: { leadId, organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (existing && existing.contextHash === context.contextHash && existing.status !== 'REJECTED') {
        let parsedIntelligence: OutreachIntelligence;
        try {
          parsedIntelligence = JSON.parse(existing.intelligence);
        } catch {
          parsedIntelligence = {
            leadId,
            verifiedEvidence: [],
            observations: [],
            opportunityHypotheses: [],
            valueProposition: '',
            recommendedAngle: '',
            recommendedCTA: '',
            confidence: 'MEDIUM',
            confidenceRationale: '',
          };
        }

        const payload: OutreachDraftPayload = {
          id: existing.id,
          organizationId: existing.organizationId,
          leadId: existing.leadId,
          subject: existing.subject,
          body: existing.body,
          tone: existing.tone as any,
          intelligence: parsedIntelligence,
          generationMode: existing.generationMode as any,
          contextHash: existing.contextHash,
          isStale: false,
          version: existing.version,
          status: existing.status as any,
          createdBy: existing.createdBy,
          approvedBy: existing.approvedBy,
          rejectedBy: existing.rejectedBy,
          rejectionReason: existing.rejectionReason,
          pendingActionId: existing.pendingActionId,
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
          approvedAt: existing.approvedAt ? existing.approvedAt.toISOString() : null,
        };

        return NextResponse.json({ success: true, persisted: true, draft: payload });
      }
    }

    // Generate fresh intelligence & draft
    const generated = await AIOutreachService.generateDraft(context, { tone, customAngle });

    // Database persistence if writes are enabled
    if (isDatabaseWritesAllowed()) {
      const existing = await prisma.outreachDraft.findFirst({
        where: { leadId, organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      let savedDraft;
      if (existing) {
        savedDraft = await prisma.outreachDraft.update({
          where: { id: existing.id },
          data: {
            subject: generated.draft.subject,
            body: generated.draft.body,
            tone: generated.draft.tone,
            intelligence: JSON.stringify(generated.intelligence),
            generationMode: generated.generationMode,
            contextHash: context.contextHash,
            version: existing.version + 1,
            status: 'DRAFT',
            rejectedBy: null,
            rejectionReason: null,
            pendingActionId: null,
          },
        });

        const { logAudit } = await import('@/audit/logger');
        await logAudit({
          organizationId: user.organizationId,
          userId: user.id,
          action: 'OUTREACH_DRAFT_REGENERATED',
          resource: `outreachDraft:${savedDraft.id}`,
          status: 'SUCCESS',
          details: {
            version: savedDraft.version,
            generationMode: savedDraft.generationMode,
            contextHash: context.contextHash,
          },
        });
      } else {
        savedDraft = await prisma.outreachDraft.create({
          data: {
            organizationId: user.organizationId,
            leadId,
            subject: generated.draft.subject,
            body: generated.draft.body,
            tone: generated.draft.tone,
            intelligence: JSON.stringify(generated.intelligence),
            generationMode: generated.generationMode,
            contextHash: context.contextHash,
            version: 1,
            status: 'DRAFT',
            createdBy: user.id,
          },
        });

        const { logAudit } = await import('@/audit/logger');
        await logAudit({
          organizationId: user.organizationId,
          userId: user.id,
          action: 'OUTREACH_DRAFT_GENERATED',
          resource: `outreachDraft:${savedDraft.id}`,
          status: 'SUCCESS',
          details: {
            version: 1,
            generationMode: savedDraft.generationMode,
            contextHash: context.contextHash,
          },
        });
      }

      const payload: OutreachDraftPayload = {
        id: savedDraft.id,
        organizationId: savedDraft.organizationId,
        leadId: savedDraft.leadId,
        subject: savedDraft.subject,
        body: savedDraft.body,
        tone: savedDraft.tone as any,
        intelligence: generated.intelligence,
        generationMode: savedDraft.generationMode as any,
        contextHash: savedDraft.contextHash,
        isStale: false,
        version: savedDraft.version,
        status: savedDraft.status as any,
        createdBy: savedDraft.createdBy,
        approvedBy: savedDraft.approvedBy,
        rejectedBy: savedDraft.rejectedBy,
        rejectionReason: savedDraft.rejectionReason,
        pendingActionId: savedDraft.pendingActionId,
        createdAt: savedDraft.createdAt.toISOString(),
        updatedAt: savedDraft.updatedAt.toISOString(),
        approvedAt: savedDraft.approvedAt ? savedDraft.approvedAt.toISOString() : null,
      };

      return NextResponse.json({ success: true, persisted: true, draft: payload });
    }

    // In-memory fallback if writes are disabled
    const mockPayload: OutreachDraftPayload = {
      id: `draft-mock-${Date.now()}`,
      organizationId: user.organizationId,
      leadId,
      subject: generated.draft.subject,
      body: generated.draft.body,
      tone: generated.draft.tone,
      intelligence: generated.intelligence,
      generationMode: generated.generationMode,
      contextHash: context.contextHash,
      isStale: false,
      version: 1,
      status: 'DRAFT',
      createdBy: user.id,
      approvedBy: null,
      rejectedBy: null,
      rejectionReason: null,
      pendingActionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
    };

    return NextResponse.json({ success: true, persisted: false, draft: mockPayload });
  } catch (error: any) {
    console.error('[Outreach POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'lead:update')) {
      return NextResponse.json({ error: 'Permission denied: Missing lead:update' }, { status: 403 });
    }

    const resolvedParams = await params;
    const leadId = resolvedParams.id;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = UpdateDraftRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: parseResult.error.format() }, { status: 400 });
    }

    const { subject, body } = parseResult.data;

    if (isDatabaseWritesAllowed()) {
      const draft = await prisma.outreachDraft.findFirst({
        where: { leadId, organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (!draft) {
        return NextResponse.json({ error: 'No active draft found to edit' }, { status: 404 });
      }

      if (draft.status === 'APPROVED') {
        return NextResponse.json({ error: 'Cannot edit an already approved outreach draft' }, { status: 400 });
      }

      const updatedDraft = await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: {
          subject,
          body,
          status: 'EDITED',
        },
      });

      const { logAudit } = await import('@/audit/logger');
      await logAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'OUTREACH_DRAFT_EDITED',
        resource: `outreachDraft:${updatedDraft.id}`,
        status: 'SUCCESS',
        details: {
          version: updatedDraft.version,
          newSubject: subject,
        },
      });

      return NextResponse.json({ success: true, persisted: true, status: 'EDITED', draft: updatedDraft });
    }

    return NextResponse.json({ success: true, persisted: false, status: 'EDITED', message: 'Edited in-memory (DB writes disabled)' });
  } catch (error: any) {
    console.error('[Outreach PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
