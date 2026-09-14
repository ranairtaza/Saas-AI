import { IntegrationProvider, SyncResult } from '../../core/types';
import { PrismaClient } from '@prisma/client';
import { METRIC_DEFINITIONS } from '../../../business/metrics/definitions';

const prisma = new PrismaClient();

export class MockIntegrationProvider implements IntegrationProvider {
  id = 'mock_provider';
  name = 'Mock Business ERP';
  type = 'ERP';

  async connect(organizationId: string, credentials: any): Promise<boolean> {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_INTEGRATION_TESTS !== 'true') {
      throw new Error('MockIntegrationProvider is permanently quarantined and cannot be connected in production environments.');
    }
    return true;
  }

  async disconnect(organizationId: string): Promise<boolean> {
    return true;
  }

  async validateConnection(organizationId: string): Promise<boolean> {
    return true;
  }

  async sync(organizationId: string, connectionId: string): Promise<SyncResult> {
    // Strictly prevent synthetic data fabrication in production to uphold deterministic data integrity
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_INTEGRATION_TESTS !== 'true') {
      return {
        success: false,
        recordsProcessed: 0,
        errorMessage: 'MockIntegrationProvider is quarantined from production. Randomized metrics cannot enter production telemetry.',
      };
    }

    try {
      let recordsProcessed = 0;
      const today = new Date();

      // Generate 30 days of mock history for revenue, expenses, leads
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Random realistic mock values
        const revenue = Math.floor(Math.random() * 5000) + 1000; // $1k - $6k
        const expenses = Math.floor(revenue * (Math.random() * 0.4 + 0.4)); // 40-80% of revenue
        const leads = Math.floor(Math.random() * 50) + 5; // 5 - 55 leads

        await this.importSnapshot(organizationId, 'revenue', date, revenue);
        await this.importSnapshot(organizationId, 'expenses', date, expenses);
        await this.importSnapshot(organizationId, 'lead_count', date, leads);
        
        recordsProcessed += 3;
      }

      return { success: true, recordsProcessed };
    } catch (error: any) {
      return { success: false, recordsProcessed: 0, errorMessage: error.message };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private async importSnapshot(organizationId: string, metricKey: string, timestamp: Date, value: number) {
    const metricDef = METRIC_DEFINITIONS[metricKey];
    if (!metricDef) return;

    const metricRecord = await prisma.businessMetric.upsert({
      where: {
        organizationId_key: { organizationId, key: metricDef.key }
      },
      update: {},
      create: {
        organizationId,
        key: metricDef.key,
        name: metricDef.name,
        description: metricDef.description,
        unit: metricDef.unit,
        category: metricDef.category
      }
    });

    await prisma.metricSnapshot.create({
      data: {
        organizationId,
        metricId: metricRecord.id,
        timestamp,
        value,
        source: 'mock_integration'
      }
    });
  }
}

export const mockProvider = new MockIntegrationProvider();
