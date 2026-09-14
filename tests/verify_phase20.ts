import * as fs from 'fs';
import * as path from 'path';
import { 
  getDatabaseWriteSafetyStatus, 
  assertDatabaseWritesAllowed, 
  isDatabaseWritesAllowed,
  DatabaseWriteBlockedError,
  EXPECTED_DATABASE_ID,
  EXPECTED_APPLICATION,
  verifyDatabaseIdentity
} from '../src/lib/db-guard';
import { DeterministicScoringEngine } from '../src/lib/leads/scoring/engine';
import { WorkflowRoutingEngine } from '../src/lib/leads/workflow/routing-engine';
import { ToolRegistry } from '../src/ai/tools/registry';
import { assignLeadTool } from '../src/ai/tools/actions/assign_lead';
import { updateLeadStatusTool } from '../src/ai/tools/actions/update_lead_status';
import { addLeadNoteTool } from '../src/ai/tools/actions/add_lead_note';
import { deleteLeadTool } from '../src/ai/tools/actions/delete_lead';

async function verifyPhase20() {
  console.log("==================================================");
  console.log("Starting Phase 20: Dedicated PostgreSQL Migration Tests");
  console.log("==================================================\n");

  let allTestsPassed = true;

  try {
    // ----------------------------------------------------
    // TEST 1: Migration Directory & Baseline Structure
    // ----------------------------------------------------
    console.log("TEST 1: PostgreSQL Migration Baseline & Legacy Archival");
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    const legacyDir = path.join(process.cwd(), 'prisma', 'legacy_sqlite_migrations');
    const baselineSql = path.join(migrationsDir, '0_init', 'migration.sql');
    const lockToml = path.join(migrationsDir, 'migration_lock.toml');

    if (!fs.existsSync(migrationsDir) || !fs.existsSync(baselineSql) || !fs.existsSync(lockToml)) {
      console.error("  FAIL: Migration baseline directory or files missing.");
      allTestsPassed = false;
    } else {
      console.log("  PASS: Baseline migration 0_init/migration.sql exists.");
      const tomlContent = fs.readFileSync(lockToml, 'utf-8');
      if (tomlContent.includes('provider = "postgresql"')) {
        console.log("  PASS: migration_lock.toml specifies postgresql provider.");
      } else {
        console.error("  FAIL: migration_lock.toml provider is not postgresql!");
        allTestsPassed = false;
      }
    }

    if (fs.existsSync(legacyDir)) {
      const legacyFiles = fs.readdirSync(legacyDir);
      console.log(`  PASS: Legacy SQLite migrations preserved (${legacyFiles.length} items in prisma/legacy_sqlite_migrations).`);
    } else {
      console.error("  FAIL: Legacy SQLite migrations were not preserved in legacy_sqlite_migrations!");
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 2: Schema Contract Verification
    // ----------------------------------------------------
    console.log("\nTEST 2: Authoritative Schema Contract");
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    if (schemaContent.includes('provider = "postgresql"') && schemaContent.includes('model Organization') && schemaContent.includes('model Lead')) {
      console.log("  PASS: prisma/schema.prisma is configured for PostgreSQL with all core models.");
    } else {
      console.error("  FAIL: schema.prisma is missing PostgreSQL provider or core models.");
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 3: Database Write Safety & Identity Verification
    // ----------------------------------------------------
    console.log("\nTEST 3: Database Write Gate & Identity Safety");
    const originalWrites = process.env.LEADMACHINE_DB_WRITES_ENABLED;
    const originalDbId = process.env.LEADMACHINE_DATABASE_ID;

    // 3A. Default / Missing configuration fails closed
    delete process.env.LEADMACHINE_DB_WRITES_ENABLED;
    delete process.env.LEADMACHINE_DATABASE_ID;

    const defaultStatus = getDatabaseWriteSafetyStatus();
    if (!defaultStatus.allowed) {
      console.log("  PASS: Unconfigured environment fails closed (writes blocked).");
    } else {
      console.error("  FAIL: Unconfigured environment permitted writes!");
      allTestsPassed = false;
    }

    let caughtError = false;
    try {
      assertDatabaseWritesAllowed();
    } catch (e: any) {
      if (e instanceof DatabaseWriteBlockedError) {
        caughtError = true;
      }
    }
    if (caughtError) {
      console.log("  PASS: assertDatabaseWritesAllowed() safely threw DatabaseWriteBlockedError.");
    } else {
      console.error("  FAIL: assertDatabaseWritesAllowed() did not throw DatabaseWriteBlockedError!");
      allTestsPassed = false;
    }

    // 3B. Non-'leadmachine' database ID fails closed
    process.env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
    process.env.LEADMACHINE_DATABASE_ID = 'keyabroad_database';

    const foreignStatus = getDatabaseWriteSafetyStatus();
    if (!foreignStatus.allowed) {
      console.log("  PASS: Foreign database identity (e.g. KeyAbroad) strictly blocked from writes.");
    } else {
      console.error("  FAIL: Foreign database identity permitted writes!");
      allTestsPassed = false;
    }

    // 3C. Valid LeadMachine identity permits writes
    process.env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
    process.env.LEADMACHINE_DATABASE_ID = 'leadmachine';

    const validStatus = getDatabaseWriteSafetyStatus();
    if (validStatus.allowed && validStatus.databaseId === 'leadmachine') {
      console.log("  PASS: Valid LeadMachine configuration authorizes writes.");
    } else {
      console.error("  FAIL: Valid LeadMachine configuration failed authorization!");
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 4: Metadata Identity Table Verification Logic
    // ----------------------------------------------------
    console.log("\nTEST 4: Active Database Metadata Table Logic");
    const mockPrismaSuccess = {
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes('current_database()')) {
          return [{ db_name: 'leadmachine_production' }];
        }
        if (sql.includes('_leadmachine_metadata')) {
          return [{
            id: 'leadmachine-primary-identity',
            application: 'leadmachine',
            environment: 'production',
            identity: 'leadmachine'
          }];
        }
        return [];
      }
    };

    const mockPrismaMismatch = {
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes('current_database()')) {
          return [{ db_name: 'keyabroad_db' }];
        }
        if (sql.includes('_leadmachine_metadata')) {
          return [{
            id: 'other-identity',
            application: 'keyabroad',
            environment: 'production',
            identity: 'keyabroad'
          }];
        }
        return [];
      }
    };

    process.env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
    process.env.LEADMACHINE_DATABASE_ID = 'leadmachine';

    const verifySuccess = await verifyDatabaseIdentity(mockPrismaSuccess);
    if (verifySuccess.verified && verifySuccess.application === 'leadmachine') {
      console.log("  PASS: verifyDatabaseIdentity() verified official LeadMachine database identity.");
    } else {
      console.error("  FAIL: verifyDatabaseIdentity() failed on valid database identity:", verifySuccess);
      allTestsPassed = false;
    }

    const verifyMismatch = await verifyDatabaseIdentity(mockPrismaMismatch);
    if (!verifyMismatch.verified) {
      console.log("  PASS: verifyDatabaseIdentity() blocked mismatched database identity.");
    } else {
      console.error("  FAIL: verifyDatabaseIdentity() permitted mismatched database identity!");
      allTestsPassed = false;
    }

    // Reset env vars to original state
    if (originalWrites) process.env.LEADMACHINE_DB_WRITES_ENABLED = originalWrites;
    else delete process.env.LEADMACHINE_DB_WRITES_ENABLED;

    if (originalDbId) process.env.LEADMACHINE_DATABASE_ID = originalDbId;
    else delete process.env.LEADMACHINE_DATABASE_ID;

    // ----------------------------------------------------
    // TEST 5: Phase 16, 18, 19 Regression Integration
    // ----------------------------------------------------
    console.log("\nTEST 5: Phase 16, 18, 19 Regression in Guarded Environment");

    // Phase 16 Tool Registry
    const registry = new ToolRegistry();
    registry.register(assignLeadTool);
    registry.register(updateLeadStatusTool);
    registry.register(addLeadNoteTool);
    registry.register(deleteLeadTool);
    if (registry.getTool('assign_lead') && registry.getTool('update_lead_status')) {
      console.log("  PASS: Phase 16 ToolRegistry and registered tools intact.");
    } else {
      console.error("  FAIL: Phase 16 ToolRegistry missing tools!");
      allTestsPassed = false;
    }

    // Phase 18 Scoring Math
    const score = DeterministicScoringEngine.score(
      { contactName: 'Alice CEO', contactEmail: 'alice@corp.com', phone: '+1234567890', industry: 'Software & Technology' },
      { sourceProvider: 'mock_apollo', enrichedAt: new Date().toISOString(), decisionMakerIdentified: true, estimatedRevenue: '$20M - $100M', companySize: '200-1000' }
    );
    if (score.score === 100 && score.category === 'HIGH') {
      console.log("  PASS: Phase 18 Deterministic Scoring Engine authoritative (Score: 100/100, HIGH).");
    } else {
      console.error("  FAIL: Phase 18 Deterministic Scoring Engine mismatch:", score);
      allTestsPassed = false;
    }

    // Phase 19 Recommendations
    const recs = WorkflowRoutingEngine.generateRecommendations({
      lead: { id: 'lead-test', companyName: 'Acme', status: 'DISCOVERED', score: 100 },
      scoreResult: score,
      organizationUsers: [{ id: 'user-admin', name: 'Admin User', email: 'admin@acme.com', role: 'ADMIN' }]
    });
    if (recs.length > 0 && recs[0].actionName === 'assign_lead') {
      console.log("  PASS: Phase 19 Workflow Recommendations evaluated deterministically.");
    } else {
      console.error("  FAIL: Phase 19 Workflow Recommendations mismatch:", recs);
      allTestsPassed = false;
    }

  } catch (err) {
    console.error("FAIL: Unexpected error during Phase 20 verification:", err);
    allTestsPassed = false;
  }

  console.log("\n==================================================");
  if (allTestsPassed) {
    console.log("ALL PHASE 20 VERIFICATION TESTS COMPLETED SUCCESSFULLY ✅");
  } else {
    console.log("SOME PHASE 20 TESTS FAILED ❌");
    process.exit(1);
  }
}

verifyPhase20().catch(console.error);
