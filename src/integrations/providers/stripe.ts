import { IntegrationProvider, SyncResult } from '../core/types';
import { MetricsRepository } from '../../business/metrics/repository';
import prisma from '@/lib/db';

export class StripeProvider implements IntegrationProvider {
  id = 'stripe';
  name = 'Stripe';
  type = 'FINANCIAL';

  async connect(organizationId: string, credentials: any): Promise<boolean> {
    // Mock connection
    return true;
  }

  async disconnect(organizationId: string): Promise<boolean> {
    // Mock disconnection
    return true;
  }

  async validateConnection(organizationId: string): Promise<boolean> {
    // Mock validation
    return true;
  }

  async sync(organizationId: string, connectionId: string): Promise<SyncResult> {
    try {
      // 1. Ensure the revenue metric exists
      const revenueMetric = await MetricsRepository.upsertMetric(organizationId, {
        key: 'revenue',
        name: 'Revenue',
        description: 'Total revenue from Stripe',
        unit: 'currency',
        category: 'financial'
      });

      // 2. Generate some deterministic mock data for the last 30 days
      let recordsProcessed = 0;
      const today = new Date();
      
      // We will generate stable data based on the organization ID length/chars so it doesn't wildly fluctuate on every run
      const seed = organizationId.charCodeAt(0) * 10;
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        // Base revenue grows slightly over time
        const baseRevenue = 1000 + seed + ((30 - i) * 50);
        const randomFluctuation = (Math.sin(i) * 200); // stable fluctuation
        const finalValue = Math.max(0, baseRevenue + randomFluctuation);

        // Check if snapshot exists for this day
        const existing = await prisma.metricSnapshot.findFirst({
          where: {
            organizationId,
            metricId: revenueMetric.id,
            timestamp: date
          }
        });

        if (!existing) {
          await MetricsRepository.addSnapshot(organizationId, {
            metricId: revenueMetric.id,
            timestamp: date,
            value: parseFloat(finalValue.toFixed(2)),
            source: 'stripe'
          });
          recordsProcessed++;
        }
      }

      return {
        success: true,
        recordsProcessed
      };
    } catch (error: any) {
      console.error('Stripe sync failed:', error);
      return {
        success: false,
        recordsProcessed: 0,
        errorMessage: error.message
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
