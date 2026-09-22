import { inngest } from '../client';
import { syncManager } from '../../../integrations/core/manager';
import { prisma } from '../../db';
import { classifyError } from '../../../lib/integrations/errors';

export const syncIntegration = inngest.createFunction(
  {
    id: "sync-integration",
    name: "Sync Integration",
    concurrency: {
      limit: 1,
      key: "event.data.organizationId + '-' + event.data.provider",
    },
    retries: 3, // Bounded retries
    triggers: [{ event: "integrations/sync.requested" }]
  },
  async ({ event, step, attempt }) => {
    const { organizationId, connectionId, jobId } = event.data;

    if (!organizationId || !connectionId || !jobId) {
      throw new Error("Missing required event data.");
    }

    const jobStartedAt = new Date();

    // Wrap the internal logic in a step to ensure it executes safely
    const result = await step.run("execute-sync", async () => {
      // Mark as RUNNING or RETRYING
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: attempt > 0 ? 'RETRYING' : 'RUNNING',
          startedAt: jobStartedAt,
          retryCount: attempt
        }
      });

      const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId },
        include: { integration: true },
      });

      if (!connection) {
        throw new Error("Integration connection not found.");
      }

      if (connection.status === "DISCONNECTED") {
        throw new Error("Cannot sync disconnected integration.");
      }

      const provider = syncManager.getProvider(connection.integration.provider);
      if (!provider) {
        throw new Error(`Provider ${connection.integration.provider} not registered.`);
      }

      try {
        const syncResult = await provider.sync(organizationId, connectionId);

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - jobStartedAt.getTime();

        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: syncResult.success ? 'COMPLETED' : 'FAILED', // Or PARTIAL if we track it
            completedAt,
            durationMs,
            recordsProcessed: syncResult.recordsProcessed,
            errorMessage: syncResult.errorMessage,
          },
        });

        await prisma.integrationConnection.update({
          where: { id: connectionId },
          data: {
            status: syncResult.success ? 'ACTIVE' : 'FAILING',
            ...(syncResult.success && { lastSyncAt: new Date() }), // Phase 50: Only update on true success
            lastError: syncResult.errorMessage,
          },
        });

        return syncResult;
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown sync error";
        const errorCode = classifyError(error);
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - jobStartedAt.getTime();
        
        // Mark as FAILING in DB
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt,
            durationMs,
            errorMessage: errorMessage,
            errorCode: errorCode
          },
        });

        await prisma.integrationConnection.update({
          where: { id: connectionId },
          data: {
            status: 'FAILING',
            lastError: errorMessage,
          },
        });

        // Fail fast on credential errors
        if (errorCode === 'AUTH_ERROR' || errorMessage.includes("Invalid API Key") || errorMessage.includes("Unauthorized") || errorMessage.includes("Missing API Key")) {
          return { success: false, error: errorMessage, errorCode, retryable: false };
        }

        // Rethrow to trigger Inngest retry for transient network/DB errors
        throw error;
      }
    });

    return result;
  }
);

export const scheduleSyncIntegrations = inngest.createFunction(
  {
    id: "schedule-sync-integrations",
    name: "Schedule Sync Integrations",
    triggers: [{ cron: "0 2 * * *" }] // Run daily at 2 AM
  },
  async ({ step }) => {
    // 1. Fetch active integration connections
    const activeConnections = await step.run("fetch-active-connections", async () => {
      return await prisma.integrationConnection.findMany({
        where: {
          status: { in: ['ACTIVE', 'FAILING'] },
        },
        include: { integration: true },
      });
    });

    // 2. Dispatch a sync event for each (we need to create the job first)
    if (activeConnections.length > 0) {
      await step.run("dispatch-sync-jobs", async () => {
        for (const conn of activeConnections) {
          try {
            await syncManager.startSync(conn.organizationId, conn.id);
          } catch (e) {
            console.error(`Failed to schedule sync for connection ${conn.id}:`, e);
          }
        }
      });
    }

    return { scheduled: activeConnections.length };
  }
);
