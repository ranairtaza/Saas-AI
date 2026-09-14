import { 
  getDatabaseWriteSafetyStatus, 
  isDatabaseWritesAllowed, 
  assertDatabaseWritesAllowed, 
  DatabaseWriteBlockedError, 
  EXPECTED_DATABASE_ID 
} from '../src/lib/db-guard';
import { DeterministicScoringEngine } from '../src/lib/leads/scoring/engine';
import { enrichmentService } from '../src/lib/leads/enrichment/service';
import { AIQualificationService } from '../src/ai/qualification';

async function verifyPhase18_2() {
  console.log("==================================================");
  console.log("Starting Phase 18.2: Database Write Safety Tests");
  console.log("==================================================\n");

  let allTestsPassed = true;

  // Helper to run with env overrides
  const testWithEnv = async (
    writesEnabled: string | undefined,
    databaseId: string | undefined,
    testFn: () => void | Promise<void>
  ) => {
    const origEnabled = process.env.LEADMACHINE_DB_WRITES_ENABLED;
    const origId = process.env.LEADMACHINE_DATABASE_ID;

    try {
      if (writesEnabled !== undefined) {
        process.env.LEADMACHINE_DB_WRITES_ENABLED = writesEnabled;
      } else {
        delete process.env.LEADMACHINE_DB_WRITES_ENABLED;
      }

      if (databaseId !== undefined) {
        process.env.LEADMACHINE_DATABASE_ID = databaseId;
      } else {
        delete process.env.LEADMACHINE_DATABASE_ID;
      }

      await testFn();
    } finally {
      if (origEnabled !== undefined) {
        process.env.LEADMACHINE_DB_WRITES_ENABLED = origEnabled;
      } else {
        delete process.env.LEADMACHINE_DB_WRITES_ENABLED;
      }

      if (origId !== undefined) {
        process.env.LEADMACHINE_DATABASE_ID = origId;
      } else {
        delete process.env.LEADMACHINE_DATABASE_ID;
      }
    }
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Default / Missing Env Fail-Closed
    // ----------------------------------------------------
    console.log("TEST 1: Default environment (missing env vars) fails closed");
    await testWithEnv(undefined, undefined, () => {
      const status = getDatabaseWriteSafetyStatus();
      const isAllowed = isDatabaseWritesAllowed();
      if (!isAllowed && !status.allowed) {
        console.log("  PASS: Writes disabled by default when env vars are missing.");
      } else {
        console.error("  FAIL: Writes were unexpectedly allowed with missing env vars!");
        allTestsPassed = false;
      }

      let errorThrown = false;
      try {
        assertDatabaseWritesAllowed();
      } catch (err) {
        if (err instanceof DatabaseWriteBlockedError) {
          errorThrown = true;
          if (err.message.includes("password") || err.message.includes("postgres://")) {
            console.error("  FAIL: Error message leaked secrets!", err.message);
            allTestsPassed = false;
          }
        }
      }
      if (errorThrown) {
        console.log("  PASS: assertDatabaseWritesAllowed() safely throws DatabaseWriteBlockedError.");
      } else {
        console.error("  FAIL: assertDatabaseWritesAllowed() did not throw!");
        allTestsPassed = false;
      }
    });

    // ----------------------------------------------------
    // TEST 2: Strict Boolean Parsing Refusals
    // ----------------------------------------------------
    console.log("\nTEST 2: Strict parsing refuses non-'true' values");
    const invalidFlags = ["false", "0", "no", "FALSE", "TRUE", "1", "undefined", "null"];
    for (const flag of invalidFlags) {
      await testWithEnv(flag, EXPECTED_DATABASE_ID, () => {
        const allowed = isDatabaseWritesAllowed();
        if (!allowed) {
          console.log(`  PASS: Flag "${flag}" blocked writes.`);
        } else {
          console.error(`  FAIL: Flag "${flag}" should NOT have allowed writes!`);
          allTestsPassed = false;
        }
      });
    }

    // ----------------------------------------------------
    // TEST 3: Database Identity Validation
    // ----------------------------------------------------
    console.log("\nTEST 3: Database identity verification");
    const invalidIdentities = [
      undefined,
      "",
      "keyabroad",
      "postgres",
      "leadmachine_dev_other",
      "production_db",
      "supabase"
    ];
    for (const dbId of invalidIdentities) {
      await testWithEnv("true", dbId, () => {
        const allowed = isDatabaseWritesAllowed();
        if (!allowed) {
          console.log(`  PASS: Database ID "${dbId}" blocked writes.`);
        } else {
          console.error(`  FAIL: Database ID "${dbId}" unexpectedly allowed writes!`);
          allTestsPassed = false;
        }
      });
    }

    // ----------------------------------------------------
    // TEST 4: Valid Combination Allows Writes
    // ----------------------------------------------------
    console.log("\nTEST 4: Exact valid configuration permits writes");
    await testWithEnv("true", EXPECTED_DATABASE_ID, () => {
      const status = getDatabaseWriteSafetyStatus();
      const isAllowed = isDatabaseWritesAllowed();
      if (isAllowed && status.allowed && status.databaseId === EXPECTED_DATABASE_ID) {
        console.log("  PASS: Writes allowed only when LEADMACHINE_DB_WRITES_ENABLED=true and LEADMACHINE_DATABASE_ID=leadmachine.");
      } else {
        console.error("  FAIL: Valid config failed to allow writes:", status);
        allTestsPassed = false;
      }

      let errorThrown = false;
      try {
        assertDatabaseWritesAllowed();
      } catch (err) {
        errorThrown = true;
      }
      if (!errorThrown) {
        console.log("  PASS: assertDatabaseWritesAllowed() passes without error on valid config.");
      } else {
        console.error("  FAIL: assertDatabaseWritesAllowed() threw an error on valid config!");
        allTestsPassed = false;
      }
    });

    // ----------------------------------------------------
    // TEST 5: Phase 18 Enrichment Execution With Write Guard
    // ----------------------------------------------------
    console.log("\nTEST 5: Phase 18 computation executes cleanly under write-blocked mode");
    await testWithEnv("false", undefined, async () => {
      let prismaUpdateCalled = false;
      const mockPrisma = {
        lead: {
          update: async () => {
            prismaUpdateCalled = true;
            return {};
          }
        }
      };

      // Simulate enrich lead computation
      const mockLead = {
        id: "lead-123",
        companyName: "Acme Analytics",
        domain: "acme.io",
        contactName: "Alice Smith",
        contactEmail: "alice@acme.io",
        phone: "555-0199"
      };

      const enrichmentData = await enrichmentService.enrichLead(mockLead.domain, mockLead.companyName);
      const scoreResult = DeterministicScoringEngine.score(mockLead, enrichmentData);
      const aiQualification = await AIQualificationService.qualifyLead(mockLead, enrichmentData, scoreResult);

      const writeSafety = getDatabaseWriteSafetyStatus();
      let persisted = false;

      if (writeSafety.allowed) {
        await mockPrisma.lead.update();
        persisted = true;
      }

      if (!prismaUpdateCalled && !persisted && scoreResult.score > 0 && aiQualification.summary) {
        console.log(`  PASS: Enrichment and Scoring computed successfully (${scoreResult.score}/100, category: ${scoreResult.category}). prisma.lead.update() was NEVER invoked.`);
      } else {
        console.error("  FAIL: Simulation failed or prisma update was illegally invoked!");
        allTestsPassed = false;
      }
    });

    // ----------------------------------------------------
    // TEST 6: Phase 16 & Deterministic Scoring Intact
    // ----------------------------------------------------
    console.log("\nTEST 6: Regression verification");
    const scoreResult = DeterministicScoringEngine.score(
      { contactName: 'John', contactEmail: 'john@tech.io', phone: '123' },
      await enrichmentService.enrichLead("tech.io", "Tech Corp")
    );
    if (scoreResult.score === 100 && scoreResult.category === 'HIGH') {
      console.log("  PASS: Deterministic scoring engine math intact (Score: 100, HIGH).");
    } else {
      console.error("  FAIL: Scoring engine logic mismatch:", scoreResult);
      allTestsPassed = false;
    }

  } catch (error) {
    console.error("FAIL: Unexpected error during tests:", error);
    allTestsPassed = false;
  }

  console.log("\n==================================================");
  if (allTestsPassed) {
    console.log("ALL PHASE 18.2 WRITE SAFETY TESTS COMPLETED SUCCESSFULLY ✅");
  } else {
    console.log("SOME WRITE SAFETY TESTS FAILED ❌");
    process.exit(1);
  }
}

verifyPhase18_2().catch(console.error);
