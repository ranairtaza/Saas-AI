import { WorkflowRoutingEngine, generateRecommendationFingerprint } from '../src/lib/leads/workflow/routing-engine';
import { WorkflowRoutingContext } from '../src/lib/leads/workflow/types';
import { DeterministicScoringEngine } from '../src/lib/leads/scoring/engine';
import { ToolRegistry } from '../src/ai/tools/registry';
import { updateLeadStatusTool } from '../src/ai/tools/actions/update_lead_status';
import { addLeadNoteTool } from '../src/ai/tools/actions/add_lead_note';
import { assignLeadTool } from '../src/ai/tools/actions/assign_lead';
import { deleteLeadTool } from '../src/ai/tools/actions/delete_lead';
import { isDatabaseWritesAllowed } from '../src/lib/db-guard';

async function verifyPhase19() {
  console.log("==================================================");
  console.log("Starting Phase 19: Workflow Routing & Action Tests");
  console.log("==================================================\n");

  let allTestsPassed = true;

  const mockUsers = [
    { id: 'user-admin', name: 'Alice Admin', email: 'alice@company.com', role: 'ADMIN' },
    { id: 'user-sales', name: 'Bob Sales', email: 'bob@company.com', role: 'MEMBER' },
  ];

  try {
    // ----------------------------------------------------
    // TEST 1: Routing Tiers & Business Rules
    // ----------------------------------------------------
    console.log("TEST 1: Routing Tiers & Business Rules");

    // 1A. HIGH Lead (75-100)
    const highContext: WorkflowRoutingContext = {
      lead: { id: 'lead-1', companyName: 'High Corp', status: 'DISCOVERED', score: 90 },
      scoreResult: {
        score: 90,
        category: 'HIGH',
        factors: [{ name: 'Decision Maker', points: 15, maxPoints: 15, reason: 'Identified' }]
      },
      organizationUsers: mockUsers
    };
    const highRecs = WorkflowRoutingEngine.generateRecommendations(highContext);
    const hasAssignHigh = highRecs.some(r => r.actionName === 'assign_lead' && r.parameters && (r.parameters as any).userId === 'user-admin');
    const hasStatusChangeHigh = highRecs.some(r => r.actionName === 'update_lead_status');

    if (hasAssignHigh && !hasStatusChangeHigh) {
      console.log("  PASS: HIGH lead recommended for priority assignment. Did NOT auto-force status to QUALIFIED.");
    } else {
      console.error("  FAIL: HIGH lead recommendation mismatch:", highRecs);
      allTestsPassed = false;
    }

    // 1B. MEDIUM Lead (50-74)
    const medContext: WorkflowRoutingContext = {
      lead: { id: 'lead-2', companyName: 'Med Corp', status: 'DISCOVERED', score: 60 },
      scoreResult: {
        score: 60,
        category: 'MEDIUM',
        factors: [{ name: 'Contact Info', points: 15, maxPoints: 20, reason: 'Valid' }]
      },
      organizationUsers: mockUsers
    };
    const medRecs = WorkflowRoutingEngine.generateRecommendations(medContext);
    const hasAssignMed = medRecs.some(r => r.actionName === 'assign_lead' && (r.parameters as any).userId === 'user-sales');
    const hasStatusChangeMed = medRecs.some(r => r.actionName === 'update_lead_status');

    if (hasAssignMed && !hasStatusChangeMed) {
      console.log("  PASS: MEDIUM lead recommended for standard assignment. Did NOT auto-force status to CONTACTED.");
    } else {
      console.error("  FAIL: MEDIUM lead recommendation mismatch:", medRecs);
      allTestsPassed = false;
    }

    // 1C. LOW Lead (25-49)
    const lowContext: WorkflowRoutingContext = {
      lead: { id: 'lead-3', companyName: 'Low Corp', status: 'DISCOVERED', score: 35 },
      scoreResult: { score: 35, category: 'LOW', factors: [] },
      aiQualification: { missingInformation: ['Phone number', 'Annual Revenue'] },
      organizationUsers: mockUsers
    };
    const lowRecs = WorkflowRoutingEngine.generateRecommendations(lowContext);
    const hasLowNurtureNote = lowRecs.some(r => r.actionName === 'add_lead_note' && (r.parameters as any).noteContent.includes('Phone number'));

    if (hasLowNurtureNote) {
      console.log("  PASS: LOW lead generated nurture/missing information note.");
    } else {
      console.error("  FAIL: LOW lead recommendation mismatch:", lowRecs);
      allTestsPassed = false;
    }

    // 1D. UNQUALIFIED Lead (0-24)
    const unqualContext: WorkflowRoutingContext = {
      lead: { id: 'lead-4', companyName: 'Unqual Corp', status: 'DISCOVERED', score: 10 },
      scoreResult: { score: 10, category: 'UNQUALIFIED', factors: [] },
      organizationUsers: mockUsers
    };
    const unqualRecs = WorkflowRoutingEngine.generateRecommendations(unqualContext);
    const hasUnqualNote = unqualRecs.some(r => r.actionName === 'add_lead_note');
    const hasUnqualLost = unqualRecs.some(r => r.actionName === 'update_lead_status' && (r.parameters as any).newStatus === 'LOST');

    if (hasUnqualNote && !hasUnqualLost) {
      console.log("  PASS: UNQUALIFIED lead generated review note. Did NOT automatically mark lead as LOST.");
    } else {
      console.error("  FAIL: UNQUALIFIED lead recommendation mismatch:", unqualRecs);
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 2: Score Boundary Precision
    // ----------------------------------------------------
    console.log("\nTEST 2: Score Category Boundaries");
    const testBoundaries = [
      { score: 0, cat: 'UNQUALIFIED' },
      { score: 24, cat: 'UNQUALIFIED' },
      { score: 25, cat: 'LOW' },
      { score: 49, cat: 'LOW' },
      { score: 50, cat: 'MEDIUM' },
      { score: 74, cat: 'MEDIUM' },
      { score: 75, cat: 'HIGH' },
      { score: 100, cat: 'HIGH' },
    ];
    for (const b of testBoundaries) {
      const cat = DeterministicScoringEngine.categorize(b.score);
      if (cat === b.cat) {
        console.log(`  PASS: Score ${b.score} correctly categorized as ${cat}`);
      } else {
        console.error(`  FAIL: Score ${b.score} expected ${b.cat}, got ${cat}`);
        allTestsPassed = false;
      }
    }

    // ----------------------------------------------------
    // TEST 3: State Awareness & Deduplication
    // ----------------------------------------------------
    console.log("\nTEST 3: State Awareness & Deduplication");
    // If lead is already assigned to Alice Admin, do NOT recommend assigning Alice Admin again
    const alreadyAssignedContext: WorkflowRoutingContext = {
      lead: { id: 'lead-1', companyName: 'High Corp', status: 'DISCOVERED', ownerId: 'user-admin', score: 90 },
      scoreResult: { score: 90, category: 'HIGH', factors: [] },
      organizationUsers: mockUsers
    };
    const alreadyAssignedRecs = WorkflowRoutingEngine.generateRecommendations(alreadyAssignedContext);
    const dupAssign = alreadyAssignedRecs.some(r => r.actionName === 'assign_lead');
    if (!dupAssign) {
      console.log("  PASS: Suppressed assignment recommendation when lead is already assigned.");
    } else {
      console.error("  FAIL: Generated redundant assignment recommendation for already-assigned lead!");
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 4: Fingerprinting / Idempotency
    // ----------------------------------------------------
    console.log("\nTEST 4: Deterministic Recommendation Fingerprinting");
    const fp1 = generateRecommendationFingerprint('lead-100', 'DISCOVERED', null, 'assign_lead', 'user-1');
    const fp2 = generateRecommendationFingerprint('lead-100', 'DISCOVERED', null, 'assign_lead', 'user-1');
    const fp3 = generateRecommendationFingerprint('lead-100', 'CONTACTED', null, 'assign_lead', 'user-1');
    const fp4 = generateRecommendationFingerprint('lead-100', 'DISCOVERED', 'user-prev', 'assign_lead', 'user-1');
    const fp5 = generateRecommendationFingerprint('lead-100', 'DISCOVERED', null, 'assign_lead', 'user-2');

    if (fp1 === fp2) {
      console.log("  PASS: Identical inputs produce identical recommendation fingerprint ID.");
    } else {
      console.error("  FAIL: Fingerprint was not deterministic!", fp1, fp2);
      allTestsPassed = false;
    }

    if (fp1 !== fp3 && fp1 !== fp4 && fp1 !== fp5) {
      console.log("  PASS: State change (status, owner, target) produces distinct fingerprint ID.");
    } else {
      console.error("  FAIL: Distinct states generated collision!", { fp1, fp3, fp4, fp5 });
      allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 5: Action Bridge & Tool Registry Mapping
    // ----------------------------------------------------
    console.log("\nTEST 5: Action Bridge & Registered Tool Verification");
    const registry = new ToolRegistry();
    registry.register(updateLeadStatusTool);
    registry.register(addLeadNoteTool);
    registry.register(assignLeadTool);
    registry.register(deleteLeadTool);

    for (const rec of highRecs) {
      const tool = registry.getTool(rec.actionName);
      if (tool && typeof tool.buildAction === 'function') {
        console.log(`  PASS: Recommendation "${rec.title}" maps cleanly to registered Tool "${rec.actionName}".`);
      } else {
        console.error(`  FAIL: Recommendation action "${rec.actionName}" not found in ToolRegistry!`);
        allTestsPassed = false;
      }
    }

    // ----------------------------------------------------
    // TEST 6: Database Write Safety (Read-Only Guarantee)
    // ----------------------------------------------------
    console.log("\nTEST 6: Database Write Safety Verification");
    const writesAllowed = isDatabaseWritesAllowed();
    if (!writesAllowed) {
      console.log("  PASS: Database writes remain fail-closed in current environment. Recommendation generation is strictly read-only.");
    } else {
      console.error("  FAIL: Database writes are unexpectedly enabled in test environment!");
      allTestsPassed = false;
    }

  } catch (error) {
    console.error("FAIL: Unexpected error during tests:", error);
    allTestsPassed = false;
  }

  console.log("\n==================================================");
  if (allTestsPassed) {
    console.log("ALL PHASE 19 VERIFICATION TESTS COMPLETED SUCCESSFULLY ✅");
  } else {
    console.log("SOME PHASE 19 TESTS FAILED ❌");
    process.exit(1);
  }
}

verifyPhase19().catch(console.error);
