import { PrismaClient } from '@prisma/client';
import { InsightGenerator, RawAnomalyData } from '../src/business/intelligence/insight-generator';

const prisma = new PrismaClient();

async function runPhase18Verification() {
  console.log('==================================================');
  console.log('PHASE 18 VERIFICATION: PROACTIVE EXECUTIVE INTELLIGENCE');
  console.log('==================================================\n');

  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.error('❌ No organization found. Database must be seeded.');
      process.exit(1);
    }
    console.log(`✅ Using Organization: ${org.name} (${org.id})`);

    // 1. Simulate a deterministic event
    const fakeEvent: RawAnomalyData = {
      metricName: 'Customer Churn Rate',
      metricKey: 'churn_rate',
      currentValue: 5.2,
      baselineValue: 2.1,
      changePercentage: 147.6,
      eventType: 'ANOMALY',
      severity: 'CRITICAL',
      description: 'Churn rate has spiked significantly beyond the 2% target.',
      sourceTable: 'MetricSnapshot',
      domain: 'OPERATIONS'
    };

    console.log('\n--- 1. Simulating Verified Business Event ---');
    console.log(fakeEvent);

    // 2. Generate Event
    console.log('\n--- 2. Creating ExecutiveEvent ---');
    const event = await InsightGenerator.createExecutiveEvent(org.id, fakeEvent);
    
    if (!event) {
      throw new Error('Event generation failed, returned null');
    }
    
    console.log(`✅ Successfully generated event: [${event.severity}] ${event.title}`);
    console.log(`Summary: ${event.summary}`);
    console.log(`Fingerprint: ${event.fingerprint}`);

    // 3. Test Idempotency
    console.log('\n--- 3. Testing Event Idempotency (Duplicate Prevention) ---');
    const duplicateEvent = await InsightGenerator.createExecutiveEvent(org.id, fakeEvent);
    if (duplicateEvent.id === event.id) {
       console.log(`✅ Idempotency working. Did not create duplicate event.`);
    } else {
       throw new Error('Idempotency failed! Created duplicate event.');
    }

    // 4. Generate AI Recommendation
    console.log('\n--- 4. Synthesizing AI Recommendation ---');
    const recommendation = await InsightGenerator.processEventToRecommendation(org.id, event.id);
    
    if (!recommendation) {
       throw new Error('Failed to generate recommendation. Maybe event was already processed?');
    }

    console.log(`✅ Synthesized Recommendation: ${recommendation.title}`);
    console.log(`Summary: ${recommendation.executiveSummary}`);
    console.log(`Impact: ${recommendation.expectedImpact}`);
    
    if (recommendation.pendingActionId) {
        console.log(`✅ Successfully generated a PendingAction with ID: ${recommendation.pendingActionId}`);
    }

    console.log('\n✅ PHASE 18 VERIFICATION COMPLETE.');

  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase18Verification();
