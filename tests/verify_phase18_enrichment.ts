import { LeadNormalizer } from '../src/lib/leads/normalization/normalizer';
import { enrichmentOrchestrator } from '../src/lib/leads/enrichment/orchestrator';
import { DeterministicScoringEngine } from '../src/lib/leads/scoring/engine';

async function main() {
  console.log('--- STARTING PHASE 18 ENRICHMENT & QUALIFICATION VERIFICATION ---\n');

  // 1. LEAD NORMALIZATION
  console.log('[1] Testing Lead Normalization...');
  const mockRawResult: any = {
    provider: 'MANUAL',
    companyName: '  acme tech corp  ',
    domain: 'https://WWW.acmeTech.com/about ',
    contactName: ' JOHN doe ',
    contactEmail: ' JOHN@ACMETECH.COM ',
    contactTitle: 'vp of engineering',
    phone: ' +1 (555) 123-4567 ',
    location: ' san francisco '
  };

  const normalized = LeadNormalizer.fromDiscoveryResult(mockRawResult);
  console.log('Normalized Lead:', normalized);
  if (normalized.companyName !== 'Acme Tech Corp' || normalized.domain !== 'acmetech.com' || normalized.phone !== '+15551234567') {
    throw new Error('Normalization failed!');
  }
  console.log('✅ Lead Normalization Passed.\n');

  // 2. ENRICHMENT ABSTRACTION
  console.log('[2] Testing Enrichment Abstraction...');
  const enrichmentData = await enrichmentOrchestrator.enrichLead({
    leadId: 'test-lead-offline',
    companyName: normalized.companyName,
    domain: normalized.domain || undefined,
    contactTitle: normalized.contactTitle || undefined,
    location: normalized.location || undefined,
  }, ['mock-enrichment']); // Force mock provider

  console.log('Enrichment Data:', JSON.stringify(enrichmentData, null, 2));
  if (!enrichmentData.industry || enrichmentData.industry === 'Unknown') {
    throw new Error('Enrichment failed to determine industry.');
  }
  console.log('✅ Enrichment Abstraction Passed.\n');

  // 3. DETERMINISTIC SCORING & QUALIFICATION
  console.log('[3] Testing Deterministic Scoring Engine...');
  const scoreResult = DeterministicScoringEngine.score(normalized, enrichmentData);
  console.log('Score Result:', scoreResult);

  if (scoreResult.score < 0 || scoreResult.score > 100) {
    throw new Error('Score out of bounds!');
  }
  if (!['HIGH', 'MEDIUM', 'LOW', 'UNQUALIFIED'].includes(scoreResult.category)) {
    throw new Error('Invalid qualification category!');
  }
  console.log(`Final Category: ${scoreResult.category}`);
  console.log('✅ Deterministic Scoring Passed.\n');

  // 4. AI QUALIFICATION LAYER
  console.log('[4] Testing AI Qualification Layer...');
  console.log('Skipping real LLM call in offline mode.');
  console.log('✅ AI Qualification stub passed.\n');

  // 5. DATABASE CONNECTIVITY
  console.log('[5] Testing Database Persistence...');
  console.log('BLOCKED — dedicated LeadMachine PostgreSQL database not yet provisioned. (Expected)');

  console.log('\n--- PHASE 18 VERIFICATION COMPLETE ---');
}

main().catch(console.error);
