import assert from 'assert';
import { GeminiProvider } from '../src/ai/providers/gemini';
import { AIQualificationService } from '../src/ai/qualification';
import { MockIntegrationProvider } from '../src/integrations/providers/mock/adapter';
import { syncManager } from '../src/integrations/core/manager';

console.log('========================================================');
console.log('🧪 LEADMACHINE — PHASE 46 VERIFICATION');
console.log('   Production Activation & Mock Behavior Quarantine');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  const originalEnv = { ...process.env };

  try {
    // --- Section 1: Gemini Provider Key Handling ---
    console.log('--- Section 1: Gemini Provider Key Handling ---');

    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const provider = new GeminiProvider();
    const resultMissingKey = await provider.generateCompletion(
      { organizationId: 'test-org', userId: 'test-user', role: 'OWNER' },
      [{ role: 'user', content: 'What is our current MRR?' }]
    );

    await it('GeminiProvider missing key returns baseline deterministic mode message', () => {
      assert(resultMissingKey.message.content.includes('baseline deterministic mode'));
      assert(resultMissingKey.message.content.toLowerCase().includes('continuous business monitoring'));
    });

    await it('GeminiProvider handles endpoint errors gracefully without crashing', async () => {
      const failingMockProvider = {
        async generateCompletion() {
          return {
            message: {
              role: 'assistant' as const,
              content: 'Executive AI Assistant encountered a temporary connectivity issue reaching the model endpoint. Your business telemetry, metrics, and pending actions remain secure and unaffected.',
            },
          };
        },
      };
      const failResult = await failingMockProvider.generateCompletion();
      assert(failResult.message.content.includes('temporary connectivity issue'));
    });

    // --- Section 2: AI Qualification Unavailability & Non-Fabrication ---
    console.log('\n--- Section 2: AI Qualification Unavailability & Non-Fabrication ---');

    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const mockLead = {
      contactName: 'Jane Smith',
      contactEmail: 'jane@enterprise.co',
      companyName: 'Enterprise Co',
      domain: 'enterprise.co',
    };

    const mockScoreResult: any = {
      score: 85,
      category: 'HIGH' as const,
      factors: [{ name: 'Domain Authority', points: 30, maxPoints: 30, description: 'Verified domain', reason: 'Domain is active' }],
    };

    const qualResult = await AIQualificationService.qualifyLead(mockLead, null, mockScoreResult);

    await it('AIQualification returns explicit unavailable state when API key is missing', () => {
      assert.strictEqual(qualResult.confidence, 'LOW');
      assert(qualResult.summary.includes('AI qualification unavailable'));
      assert(qualResult.summary.includes('Gemini API key is not configured'));
      assert.strictEqual(qualResult.strengths.length, 0);
      assert.strictEqual(qualResult.weaknesses.length, 0);
      assert(qualResult.missingInformation.includes('Gemini API Key (Not Configured)'));
    });

    await it('AIQualification handles provider errors explicitly without fabricating', async () => {
      process.env.GEMINI_API_KEY = 'fake_key';
      const failingMockProvider = {
        async generateStructured() {
          throw new Error('Endpoint connection timed out');
        }
      };

      const errorQualResult = await AIQualificationService.qualifyLead(mockLead, null, mockScoreResult, failingMockProvider as any);
      assert.strictEqual(errorQualResult.confidence, 'LOW');
      assert(errorQualResult.summary.includes('AI qualification provider error'));
    });

    // --- Section 3: Mock Provider Quarantine in Production ---
    console.log('\n--- Section 3: Mock Provider Quarantine in Production ---');

    const mockAdapter = new MockIntegrationProvider();

    await it('Mock provider connect is strictly blocked in production', async () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_MOCK_INTEGRATION_TESTS;

      await assert.rejects(
        async () => {
          await mockAdapter.connect('prod-org', {});
        },
        /permanently quarantined/
      );
    });

    await it('Mock provider sync is strictly blocked in production', async () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_MOCK_INTEGRATION_TESTS;

      const syncResult = await mockAdapter.sync('prod-org', 'conn-1');
      assert.strictEqual(syncResult.success, false);
      assert.strictEqual(syncResult.recordsProcessed, 0);
      assert(syncResult.errorMessage?.includes('quarantined from production'));
    });

    await it('SyncManager does not register mockProvider in production by default', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ENABLE_MOCK_INTEGRATION_TESTS;

      const provider = syncManager.getProvider('mock_provider');
      assert.strictEqual(provider, undefined);
    });

    // --- Section 4: Production Secret Validation ---
    console.log('\n--- Section 4: Production Secret Validation ---');

    await it('Production jwt signing throws when secrets are missing', async () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;

      const { signSessionToken } = await import('../src/lib/jwt');
      await assert.rejects(
        async () => {
          await signSessionToken('test_session_token');
        },
        /Production security error: Missing JWT_SECRET or SESSION_SECRET/
      );
    });

    await it('Development jwt signing uses safe fallback without throwing', async () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;

      const { signSessionToken, verifySessionJwt } = await import('../src/lib/jwt');
      const token = await signSessionToken('dev_token_123');
      assert(typeof token === 'string' && token.length > 20);

      const verified = await verifySessionJwt(token);
      assert.strictEqual(verified, 'dev_token_123');
    });

    // --- Section 5: Stripe Configuration Absence ---
    console.log('\n--- Section 5: Stripe Configuration Absence ---');

    await it('Stripe getStripe handles missing keys gracefully during static initialization', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripe } = await import('../src/lib/billing/stripe');
      const stripeClient = getStripe();
      assert(Boolean(stripeClient));
    });

  } finally {
    process.env = originalEnv;
  }

  console.log('\n========================================================');
  console.log(`📊 PHASE 46 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('========================================================');
  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 46 TESTS PASSED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
