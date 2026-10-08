import prisma from '@/lib/db';
import { TelemetrySnapshotService } from '../../ai/executive/outcomes/snapshot-service';
import { MetricsRepository } from './repository';

export interface BaselineMetricData {
  metricName: string;
  key: string;
  value: number;
  source: string;
  measurementPeriod?: string;
  dataQuality?: string;
}

export class PilotBaselineService {
  /**
   * Records a formal Pilot Baseline for the organization.
   * Leverages the existing BusinessMetric and MetricSnapshot infrastructure.
   */
  static async recordBaseline(organizationId: string, metrics: BaselineMetricData[]) {
    const timestamp = new Date();
    
    for (const data of metrics) {
      const metric = await MetricsRepository.upsertMetric(organizationId, {
        key: `baseline_${data.key}`,
        name: data.metricName,
        description: `Baseline - Period: ${data.measurementPeriod || 'N/A'} - Quality: ${data.dataQuality || 'UNKNOWN'}`,
        unit: 'auto',
        category: 'baseline'
      });

      await MetricsRepository.addSnapshot(organizationId, {
        metricId: metric.id,
        timestamp,
        value: data.value,
        source: data.source
      });
    }

    return true;
  }
}
