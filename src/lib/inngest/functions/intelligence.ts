import { inngest } from '../client';
import { prisma } from '../../db';
import { BusinessIntelligenceService } from '../../../business/intelligence';
import { InsightGenerator, RawAnomalyData } from '../../../business/intelligence/insight-generator';

export const dailyBusinessIntelligence = inngest.createFunction(
  { id: 'daily-business-intelligence', name: 'Daily Business Intelligence Check', triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }) => {
    // 1. Fetch active organizations
    const orgs = await step.run('fetch-active-orgs', async () => {
      // In a real app we'd filter for active subscriptions
      return await prisma.organization.findMany({
        select: { id: true, name: true }
      });
    });

    for (const org of orgs) {
      await step.run(`process-org-${org.id}`, async () => {
        // 2. Generate report to get anomalies and health
        const report = await BusinessIntelligenceService.generateReport(org.id);

        // 3. Convert anomalies to ExecutiveEvents
        for (const anomaly of report.anomalies) {
          const metric = report.metrics.find(m => m.metricKey === anomaly.metricKey);
          if (!metric) continue;

          const rawData: RawAnomalyData = {
            metricName: metric.metricName,
            metricKey: metric.metricKey,
            currentValue: metric.currentValue,
            baselineValue: metric.baselineValue,
            changePercentage: metric.changePercent,
            eventType: 'ANOMALY',
            severity: anomaly.severity === 'HIGH' ? 'CRITICAL' : (anomaly.severity || 'MEDIUM'),
            description: `Detected anomaly for ${metric.metricName}: deviation of ${anomaly.deviation.toFixed(2)}.`,
            sourceTable: 'MetricSnapshot',
            domain: 'OPERATIONS' // simplified default
          };

          // 4. Create Event & Request AI Recommendation
          const event = await InsightGenerator.createExecutiveEvent(org.id, rawData);
          if (event) {
             await InsightGenerator.processEventToRecommendation(org.id, event.id);
          }
        }

        // 5. Look for integration failures
        const failedConnections = await prisma.integrationConnection.findMany({
          where: { organizationId: org.id, status: 'FAILING' },
          include: { integration: true }
        });

        for (const conn of failedConnections) {
          const rawData: RawAnomalyData = {
            metricName: 'Integration Health',
            metricKey: 'integration_health',
            currentValue: 0,
            baselineValue: 1,
            changePercentage: -100,
            eventType: 'INTEGRATION_FAILURE',
            severity: 'CRITICAL',
            description: `${conn.integration.name} synchronization has failed.`,
            sourceTable: 'IntegrationConnection',
            sourceRecordId: conn.id,
            domain: 'OPERATIONS'
          };
          
          const event = await InsightGenerator.createExecutiveEvent(org.id, rawData);
          if (event) {
             await InsightGenerator.processEventToRecommendation(org.id, event.id);
          }
        }
        
        // 6. Generate Daily Executive Briefing
        // This is a minimal fallback briefing using the current events & recommendations
        const currentEvents = await prisma.executiveEvent.findMany({
            where: { organizationId: org.id, occurredAt: { gte: new Date(Date.now() - 24*60*60*1000) } }
        });
        
        const topRecs = await prisma.executiveRecommendation.findMany({
            where: { organizationId: org.id, status: 'PROPOSED' },
            orderBy: { priorityScore: 'desc' },
            take: 3
        });
        
        await prisma.executiveBriefingRecord.create({
            data: {
                organizationId: org.id,
                healthScore: report.overallHealth === 'HEALTHY' ? 100 : (report.overallHealth === 'WARNING' ? 70 : 40),
                healthSummary: JSON.stringify({ overall: report.overallHealth }),
                executiveSummary: `Generated daily briefing based on ${currentEvents.length} events.`,
                topPriorities: JSON.stringify(topRecs.map(r => r.title)),
                keyChanges: JSON.stringify(currentEvents.map(e => e.title)),
                risks: JSON.stringify(currentEvents.filter(e => e.severity === 'CRITICAL').map(e => e.title)),
                opportunities: '[]',
                recommendedActions: JSON.stringify(topRecs.map(r => r.executiveSummary)),
                supportingFacts: '[]',
                generatedBy: 'DETERMINISTIC_FALLBACK'
            }
        });
      });
    }

    return { message: `Processed ${orgs.length} organizations for business intelligence.` };
  }
);
