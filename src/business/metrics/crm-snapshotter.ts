import { prisma } from '../../lib/db';

export class CrmSnapshotter {
  static async snapshotOrganization(organizationId: string): Promise<void> {
    const now = new Date();
    const source = 'crm';

    // Calculate metrics
    const [totalLeads, qualifiedLeads] = await Promise.all([
      prisma.lead.count({ where: { organizationId } }),
      prisma.lead.count({ where: { organizationId, score: { gte: 75 } } }),
    ]);

    const metricsToSync = [
      { key: 'TOTAL_LEADS', name: 'Total Leads', unit: 'COUNT', category: 'SALES', value: totalLeads },
      { key: 'QUALIFIED_LEADS', name: 'Qualified Leads', unit: 'COUNT', category: 'SALES', value: qualifiedLeads }
    ];

    for (const m of metricsToSync) {
      const metric = await prisma.businessMetric.upsert({
        where: { organizationId_key: { organizationId, key: m.key } },
        update: {},
        create: {
          organizationId,
          key: m.key,
          name: m.name,
          description: `Internal CRM ${m.name}`,
          unit: m.unit,
          category: m.category
        }
      });

      await prisma.metricSnapshot.create({
        data: {
          organizationId,
          metricId: metric.id,
          timestamp: now,
          value: m.value,
          source
        }
      });
    }
  }
}
