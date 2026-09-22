import prisma from '@/lib/db';
import { IntegrationProvider } from './types';
import { inngest } from '../../lib/inngest/client';

export class SyncManager {
  private providers: Map<string, IntegrationProvider> = new Map();

  registerProvider(provider: IntegrationProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): IntegrationProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Starts a sync job for a given integration connection.
   * Updates connection status and tracks sync job results.
   */
  async startSync(organizationId: string, connectionId: string, trigger: string = 'SYSTEM'): Promise<string> {
    if (!organizationId) throw new Error("Organization ID is required.");

    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      include: { integration: true }
    });

    if (!connection) throw new Error("Integration connection not found.");
    if (connection.organizationId !== organizationId) throw new Error("Unauthorized connection access.");

    const provider = this.getProvider(connection.integration.provider);
    if (!provider) throw new Error(`Provider ${connection.integration.provider} not registered.`);

    // Create SyncJob
    const syncJob = await prisma.syncJob.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        status: 'QUEUED',
        trigger,
        startedAt: null
      }
    });

    // Execute sync via Inngest (Durable background job)
    await inngest.send({
      name: 'integrations/sync.requested',
      data: {
        organizationId,
        connectionId,
        jobId: syncJob.id,
        provider: connection.integration.provider,
        trigger
      }
    });

    return syncJob.id;
  }

  private async executeSync(organizationId: string, connectionId: string, jobId: string, provider: IntegrationProvider) {
    try {
      const result = await provider.sync(organizationId, connectionId);

      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          completedAt: new Date(),
          recordsProcessed: result.recordsProcessed,
          errorMessage: result.errorMessage
        }
      });

      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
          status: result.success ? 'ACTIVE' : 'FAILING',
          ...(result.success && { lastSyncAt: new Date() }), // Phase 50: Only update lastSyncAt on success
          lastError: result.errorMessage
        }
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown sync error";
      
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: errorMessage
        }
      });

      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
          status: 'FAILING',
          lastError: errorMessage
        }
      });
    }
  }
}

import { stripeAdapter } from '../providers/stripe/adapter';

// Singleton instance
export const syncManager = new SyncManager();
syncManager.registerProvider(stripeAdapter);

// Strictly quarantine mock provider: never registered in production runtime
if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_INTEGRATION_TESTS === 'true') {
  try {
    const { mockProvider } = require('../providers/mock/adapter');
    syncManager.registerProvider(mockProvider);
  } catch (e) {
    // Quarantined
  }
}

