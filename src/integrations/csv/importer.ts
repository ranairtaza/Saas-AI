import prisma from '@/lib/db';
import { METRIC_DEFINITIONS } from '../../business/metrics/definitions';

export interface CSVRow {
  date: string;
  metric: string;
  value: string;
}

export class CSVImporter {
  /**
   * Parses and validates raw CSV content.
   * Returns a sanitized array of rows.
   */
  static parse(csvContent: string): CSVRow[] {
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("CSV file is empty.");

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Validate headers
    if (!headers.includes('date') || !headers.includes('metric') || !headers.includes('value')) {
      throw new Error("CSV must contain 'date', 'metric', and 'value' columns.");
    }

    const dateIdx = headers.indexOf('date');
    const metricIdx = headers.indexOf('metric');
    const valueIdx = headers.indexOf('value');

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) continue; // Skip malformed rows

      rows.push({
        date: cols[dateIdx],
        metric: cols[metricIdx],
        value: cols[valueIdx]
      });
    }

    return rows;
  }

  /**
   * Imports valid CSV rows into MetricSnapshots, strictly scoped to the organization.
   */
  static async import(organizationId: string, csvContent: string): Promise<number> {
    if (!organizationId) throw new Error("Organization ID is required.");
    
    const rows = this.parse(csvContent);
    let recordsProcessed = 0;

    for (const row of rows) {
      // Validate Date
      const timestamp = new Date(row.date);
      if (isNaN(timestamp.getTime())) continue;

      // Validate Metric
      const metricKey = row.metric.toLowerCase();
      const metricDef = METRIC_DEFINITIONS[metricKey];
      if (!metricDef) continue; // Skip unknown metrics

      // Validate Value
      const numericValue = parseFloat(row.value.replace(/[^0-9.-]+/g, ""));
      if (isNaN(numericValue)) continue;

      // Ensure Metric Exists in DB
      const metricRecord = await prisma.businessMetric.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: metricDef.key
          }
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

      // Insert Snapshot
      await prisma.metricSnapshot.create({
        data: {
          organizationId,
          metricId: metricRecord.id,
          timestamp,
          value: numericValue,
          source: 'csv_import'
        }
      });

      recordsProcessed++;
    }

    return recordsProcessed;
  }
}
