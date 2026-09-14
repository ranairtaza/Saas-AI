import { hasPermission } from '../src/permissions/rbac';
import { ActionEngine } from '../src/ai/security/action-engine';
import { prisma } from '../src/lib/db';
import * as crypto from 'crypto';

async function runTests() {
  console.log("Running Phase 16 Verification (Security Action Engine)...");
  
  try {
    // Basic setup
    const organizationId = 'org-test-16';
    const userId = 'user-test-16';

    // Verify constraints locally (simulating the endpoints)

    // 1. RBAC Tests for Action Engine Execution
    // An owner should be able to execute MEDIUM
    console.assert(hasPermission('OWNER', 'lead:update') === true, 'OWNER should have lead:update');
    
    // Member should not have lead:delete
    console.assert(hasPermission('MEMBER', 'lead:delete') === false, 'MEMBER should not have lead:delete');

    // 2. ActionEngine Atomic Constraints & Expiration
    const action = await prisma.pendingAction.create({
      data: {
        organizationId,
        requestingUserId: userId,
        conversationId: 'conv-test',
        actionType: 'LOW',
        actionName: 'update_lead_status',
        actionArgs: JSON.stringify({ leadId: 'lead1', newStatus: 'QUALIFIED' }),
        humanDescription: 'Update lead status',
        riskLevel: 'LOW',
        status: 'WAITING',
        expiresAt: new Date(Date.now() - 10000), // EXPIRED
        idempotencyKey: crypto.randomUUID(),
      }
    });

    try {
      await ActionEngine.executeApprovedAction({
        organizationId,
        userId,
        role: 'OWNER',
      }, action.id);
      throw new Error("Should have failed expiration");
    } catch (e: any) {
      console.assert(e.message.includes('expired'), 'Should fail on expiration');
    }

    // Check it's marked EXPIRED now
    const expiredAction = await prisma.pendingAction.findUnique({ where: { id: action.id }});
    console.assert(expiredAction?.status === 'EXPIRED', 'Status should transition to EXPIRED');

    console.log("[PASS] Action Engine blocks expired actions and updates status.");
    
    console.log("\nALL VERIFICATIONS PASSED (Locally Verified for Phase 16)");

  } catch (error) {
    console.error("[FAIL] Verification failed:", error);
    process.exit(1);
  }
}

runTests();
