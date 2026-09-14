import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, leadIds, status, ownerId } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Missing leadIds' }, { status: 400 });
    }

    // Verify ownership of all leads
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        organizationId: user.organizationId
      }
    });

    if (leads.length !== leadIds.length) {
      return NextResponse.json({ error: 'Some leads not found or access denied' }, { status: 404 });
    }

    if (action === 'DELETE') {
      await prisma.lead.deleteMany({
        where: { id: { in: leadIds } }
      });
      return NextResponse.json({ success: true, count: leads.length });
    }

    if (action === 'UPDATE_STATUS') {
      if (!status) return NextResponse.json({ error: 'Status required' }, { status: 400 });
      
      await prisma.$transaction(async (tx) => {
        await tx.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { status }
        });

        const activities = leads
          .filter(l => l.status !== status)
          .map(l => ({
            organizationId: user.organizationId,
            leadId: l.id,
            userId: user.id,
            type: 'STATUS_CHANGE',
            content: `Status bulk changed to ${status}`,
            oldValue: l.status,
            newValue: status
          }));
        
        if (activities.length > 0) {
          await tx.leadActivity.createMany({ data: activities });
        }
      });
      return NextResponse.json({ success: true, count: leads.length });
    }

    if (action === 'ASSIGN') {
      if (ownerId !== null) {
        const owner = await prisma.user.findUnique({
          where: { id: ownerId, organizationId: user.organizationId }
        });
        if (!owner) return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { ownerId }
        });

        const activities = leads
          .filter(l => l.ownerId !== ownerId)
          .map(l => ({
            organizationId: user.organizationId,
            leadId: l.id,
            userId: user.id,
            type: 'ASSIGNMENT',
            content: ownerId ? 'Lead bulk assigned' : 'Lead bulk unassigned',
            oldValue: l.ownerId || '',
            newValue: ownerId || ''
          }));
        
        if (activities.length > 0) {
          await tx.leadActivity.createMany({ data: activities });
        }
      });
      return NextResponse.json({ success: true, count: leads.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 });
  }
}
