import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, ownerId } = body;

    // Verify lead belongs to organization
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId }
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify ownerId belongs to organization
    if (ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: ownerId, organizationId: user.organizationId }
      });
      if (!owner) {
        return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (ownerId !== undefined) updateData.ownerId = ownerId;

    if (!isDatabaseWritesAllowed()) {
      return NextResponse.json({
        success: true,
        persisted: false,
        lead: {
          ...lead,
          ...updateData
        },
        message: 'Lead updated in-memory. Database writes are disabled until the LeadMachine database is configured.'
      });
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: updateData
      });

      // Log activity
      if (status && status !== lead.status) {
        await tx.leadActivity.create({
          data: {
            organizationId: user.organizationId,
            leadId: id,
            userId: user.id,
            type: 'STATUS_CHANGE',
            content: `Status changed to ${status}`,
            oldValue: lead.status,
            newValue: status
          }
        });
      }

      if (ownerId !== undefined && ownerId !== lead.ownerId) {
        await tx.leadActivity.create({
          data: {
            organizationId: user.organizationId,
            leadId: id,
            userId: user.id,
            type: 'ASSIGNMENT',
            content: ownerId ? 'Lead assigned' : 'Lead unassigned',
            oldValue: lead.ownerId || '',
            newValue: ownerId || ''
          }
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, persisted: true, lead: updatedLead });
  } catch (error: any) {
    console.error('Update lead error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(
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
      where: { id, organizationId: user.organizationId }
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!isDatabaseWritesAllowed()) {
      return NextResponse.json({
        success: true,
        persisted: false,
        message: 'Lead deleted in-memory. Database writes are disabled until the LeadMachine database is configured.'
      });
    }

    await prisma.lead.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, persisted: true });
  } catch (error: any) {
    console.error('Delete lead error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
