import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { calculateFreshness, calculateIntegrationHealth, ProviderHealth } from '../../../../lib/integrations/health';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = user.organizationId;

    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId },
      include: {
        integration: true,
      }
    });

    const healthStatuses: ProviderHealth[] = [];

    for (const connection of connections) {
      // In a real app we might fetch the latest SyncJob for consecutive failures
      // But for Phase 39 we can use standard logic:
      const recentJobs = await prisma.syncJob.findMany({
        where: { integrationConnectionId: connection.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });

      let consecutiveFailures = 0;
      for (const job of recentJobs) {
        if (job.status === 'FAILED') consecutiveFailures++;
        else break;
      }

      // To find the last successful sync, we could rely on connection.lastSyncAt, 
      // but let's confirm with recent jobs or fallback to lastSyncAt if status is ACTIVE
      let lastSuccessfulSyncAt = connection.lastSyncAt;
      if (!lastSuccessfulSyncAt && recentJobs.find(j => j.status === 'COMPLETED')) {
        lastSuccessfulSyncAt = recentJobs.find(j => j.status === 'COMPLETED')?.completedAt || null;
      }

      const lastSyncAttemptAt = recentJobs.length > 0 ? recentJobs[0].createdAt : null;

      healthStatuses.push({
        provider: connection.integration.provider,
        status: calculateIntegrationHealth(connection.status, lastSuccessfulSyncAt, consecutiveFailures),
        freshness: calculateFreshness(lastSuccessfulSyncAt),
        lastSuccessfulSyncAt,
        lastSyncAttemptAt,
        consecutiveFailures
      });
    }

    return NextResponse.json({ data: healthStatuses });
  } catch (error) {
    console.error("Error fetching integration health:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
