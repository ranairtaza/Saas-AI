export enum MetricCategory {
  FINANCIAL = 'FINANCIAL',
  SALES = 'SALES',
  PRODUCTION = 'PRODUCTION',
  INVENTORY = 'INVENTORY'
}

export enum AggregationType {
  SUM = 'SUM',
  COUNT = 'COUNT',
  AVERAGE = 'AVERAGE',
  DERIVED = 'DERIVED' // Calculated from other metrics
}

export interface MetricDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  category: MetricCategory;
  aggregation: AggregationType;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  revenue: {
    key: 'revenue',
    name: 'Revenue',
    description: 'Total revenue generated.',
    unit: 'currency',
    category: MetricCategory.FINANCIAL,
    aggregation: AggregationType.SUM
  },
  expenses: {
    key: 'expenses',
    name: 'Expenses',
    description: 'Total business expenses.',
    unit: 'currency',
    category: MetricCategory.FINANCIAL,
    aggregation: AggregationType.SUM
  },
  profit: {
    key: 'profit',
    name: 'Profit',
    description: 'Calculated profit (revenue - expenses).',
    unit: 'currency',
    category: MetricCategory.FINANCIAL,
    aggregation: AggregationType.DERIVED
  },
  lead_count: {
    key: 'lead_count',
    name: 'Lead Count',
    description: 'Total number of leads generated.',
    unit: 'count',
    category: MetricCategory.SALES,
    aggregation: AggregationType.COUNT
  },
  discovery_count: {
    key: 'discovery_count',
    name: 'Discovery Count',
    description: 'Total number of discoveries performed.',
    unit: 'count',
    category: MetricCategory.SALES,
    aggregation: AggregationType.COUNT
  }
};
