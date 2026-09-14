import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

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
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id, organizationId: user.organizationId }
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const activity = await prisma.leadActivity.create({
      data: {
        organizationId: user.organizationId,
        leadId: id,
        userId: user.id,
        type: 'NOTE',
        content
      }
    });

    return NextResponse.json({ success: true, activity });
  } catch (error: any) {
    console.error('Add activity error:', error);
    return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
  }
}
