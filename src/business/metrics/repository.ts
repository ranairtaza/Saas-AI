import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateMetricData {
  key: string;
  name: string;
  description?: string;
  unit: string;
  category: string;
}

export interface MetricSnapshotData {
  metricId: string;
  timestamp: Date;
  value: number;
  source: string;
}

export class MetricsRepository {
  /**
   * Ensures a BusinessMetric exists for the organization.
   */
  static async upsertMetric(organizationId: string, data: CreateMetricData) {
    if (!organizationId) throw new Error("Organization ID is required.");
    return await prisma.businessMetric.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: data.key
        }
      },
      update: {
        name: data.name,
        description: data.description,
        unit: data.unit,
        category: data.category,
      },
      create: {
        organizationId,
        key: data.key,
        name: data.name,
        description: data.description,
        unit: data.unit,
        category: data.category,
      }
    });
  }

  /**
   * Adds a snapshot for a specific metric.
   */
  static async addSnapshot(organizationId: string, data: MetricSnapshotData) {
    return await prisma.metricSnapshot.create({
      data: {
        organizationId,
        metricId: data.metricId,
        timestamp: data.timestamp,
        value: data.value,
        source: data.source,
      }
    });
  }

  /**
   * Retrieves snapshots for a given metric within a date range.
   */
  static async getSnapshots(
    organizationId: string,
    metricId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await prisma.metricSnapshot.findMany({
      where: {
        organizationId,
        metricId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });
  }

  /**
   * Get all metrics for an organization
   */
  static async getMetrics(organizationId: string) {
    return await prisma.businessMetric.findMany({
      where: { organizationId }
    });
  }
}
