import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BusinessDataRepository {
  /**
   * Retrieves a metric definition by key for a specific organization.
   */
  static async getMetric(organizationId: string, key: string) {
    if (!organizationId) throw new Error("Organization ID is required.");
    return await prisma.businessMetric.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key
        }
      }
    });
  }

  /**
   * Retrieves all metric definitions for a specific organization.
   */
  static async getMetrics(organizationId: string) {
    if (!organizationId) throw new Error("Organization ID is required.");
    return await prisma.businessMetric.findMany({
      where: { organizationId }
    });
  }

  /**
   * Retrieves the latest snapshot for a specific metric.
   */
  static async getLatestSnapshot(organizationId: string, metricId: string) {
    if (!organizationId) throw new Error("Organization ID is required.");
    return await prisma.metricSnapshot.findFirst({
      where: { organizationId, metricId },
      orderBy: { timestamp: 'desc' }
    });
  }

  /**
   * Retrieves snapshots for a specific metric within a time range.
   */
  static async getSnapshots(organizationId: string, metricId: string, fromDate?: Date, toDate?: Date) {
    if (!organizationId) throw new Error("Organization ID is required.");
    
    return await prisma.metricSnapshot.findMany({
      where: {
        organizationId,
        metricId,
        ...(fromDate || toDate ? {
          timestamp: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {})
          }
        } : {})
      },
      orderBy: { timestamp: 'asc' }
    });
  }

  /**
   * Retrieves a high-level summary of a metric's current and previous state.
   */
  static async getMetricSummary(organizationId: string, metricKey: string) {
    if (!organizationId) throw new Error("Organization ID is required.");
    const metric = await this.getMetric(organizationId, metricKey);
    if (!metric) return null;

    const snapshots = await prisma.metricSnapshot.findMany({
      where: { organizationId, metricId: metric.id },
      orderBy: { timestamp: 'desc' },
      take: 2
    });

    const current = snapshots[0]?.value || 0;
    const previous = snapshots[1]?.value || 0;

    return {
      metric,
      current,
      previous,
      lastUpdated: snapshots[0]?.timestamp || null
    };
  }
}
