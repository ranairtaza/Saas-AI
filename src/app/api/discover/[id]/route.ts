import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await prisma.discoveryJob.findUnique({
      where: { id: id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      processed: job.processed,
      total: job.total,
      progress: job.progress,
      error: job.error
    }, { status: 200 });

  } catch (error) {
    console.error(`Status API Error:`, error);
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}
