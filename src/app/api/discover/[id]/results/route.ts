import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { z } from 'zod';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const skip = (Math.max(1, page) - 1) * limit;

    const job = await prisma.discoveryJob.findUnique({
      where: { id: id },
      select: { organizationId: true }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [results, total] = await Promise.all([
      prisma.discoveryResult.findMany({
        where: { discoveryJobId: id },
        skip,
        take: limit,
        orderBy: { score: 'desc' }
      }),
      prisma.discoveryResult.count({
        where: { discoveryJobId: id }
      })
    ]);

    return NextResponse.json({
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });

  } catch (error) {
    console.error(`Results API Error:`, error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
