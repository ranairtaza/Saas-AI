import { IntegrationProvider, SyncResult } from '../../core/types';
import { PrismaClient } from '@prisma/client';
import { StripeTelemetryProvider } from '../../../lib/providers/stripe-provider';
import { decrypt } from '../../../lib/encryption';

const prisma = new PrismaClient();

export const stripeAdapter: IntegrationProvider = {
  id: 'stripe',
  name: 'Stripe',
  type: 'BILLING',

  async connect(organizationId: string, credentials: any): Promise<boolean> {
    const provider = new StripeTelemetryProvider(credentials.apiKey);
    return await provider.testConnection();
  },

  async disconnect(organizationId: string): Promise<boolean> {
    // Handled by generic connection deletion in route
    return true;
  },

  async validateConnection(organizationId: string): Promise<boolean> {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'stripe'
        }
      }
    });

    if (!cred) return false;
    
    try {
      const apiKey = decrypt(cred.encryptedKey);
      const provider = new StripeTelemetryProvider(apiKey);
      return await provider.testConnection();
    } catch {
      return false;
    }
  },

  async sync(organizationId: string, connectionId: string): Promise<SyncResult> {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'stripe'
        }
      }
    });

    if (!cred) {
      return { success: false, recordsProcessed: 0, errorMessage: 'Missing credentials' };
    }

    try {
      const apiKey = decrypt(cred.encryptedKey);
      const provider = new StripeTelemetryProvider(apiKey);
      
      const metricsToSync = [
        { key: 'REVENUE_MTD', name: 'Revenue (MTD)', unit: 'CURRENCY', category: 'FINANCIAL', fetcher: () => provider.calculateRevenueMTD('usd') },
        { key: 'REVENUE_LAST_MONTH', name: 'Revenue (Last Month)', unit: 'CURRENCY', category: 'FINANCIAL', fetcher: () => provider.calculateRevenueLastMonth('usd') },
        { key: 'TRANSACTIONS_MTD', name: 'Transactions (MTD)', unit: 'COUNT', category: 'FINANCIAL', fetcher: () => provider.calculateTransactionsMTD() },
        { key: 'NEW_CUSTOMERS_MTD', name: 'New Customers (MTD)', unit: 'COUNT', category: 'SALES', fetcher: () => provider.calculateNewCustomersMTD() },
        { key: 'ACTIVE_SUBSCRIPTIONS', name: 'Active Subscriptions', unit: 'COUNT', category: 'FINANCIAL', fetcher: () => provider.calculateActiveSubscriptions() }
      ];

      let recordsProcessed = 0;
      let firstError: string | null = null;

      const now = new Date();

      for (const m of metricsToSync) {
        const telemetry = await m.fetcher();

        if (telemetry.quality === 'UNAVAILABLE') {
          if (!firstError) firstError = telemetry.errorDetail || `Failed to sync ${m.key}`;
          continue;
        }

        const metric = await prisma.businessMetric.upsert({
          where: { organizationId_key: { organizationId, key: m.key } },
          update: {},
          create: {
            organizationId,
            key: m.key,
            name: m.name,
            description: `Auto-synced ${m.name} from Stripe`,
            unit: m.unit,
            category: m.category
          }
        });

        await prisma.metricSnapshot.create({
          data: {
            organizationId,
            metricId: metric.id,
            timestamp: now,
            value: telemetry.value,
            source: 'stripe'
          }
        });

        recordsProcessed++;
      }

      if (recordsProcessed === 0 && firstError) {
        return { success: false, recordsProcessed: 0, errorMessage: firstError };
      }

      return { success: true, recordsProcessed };
    } catch (err: any) {
      console.error('Stripe sync failed:', err);
      return { success: false, recordsProcessed: 0, errorMessage: err.message };
    }
  },

  async healthCheck(): Promise<boolean> {
    return true;
  }
};
