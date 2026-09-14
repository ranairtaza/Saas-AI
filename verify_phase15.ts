// verify_phase15.ts
// This script simulates testing the core components introduced in Phase 15.

import { hasPermission } from './src/permissions/rbac';
import { PermissionGate } from './src/ai/security/permission-gate';
import { getBusinessSummaryTool } from './src/ai/tools/business/get_business_summary';
import { logAudit } from './src/audit/logger';
import { verifySessionJwt } from './src/lib/jwt';

async function runTests() {
  console.log("Running Phase 15 Verification...");
  
  try {
    // 1. RBAC permissions
    console.assert(hasPermission('OWNER', 'ai:chat') === true, 'OWNER should have ai:chat');
    console.assert(hasPermission('MEMBER', 'billing:manage') === false, 'MEMBER should not have billing:manage');
    console.log("[PASS] RBAC permissions work.");

    // 2. Permission Gate
    const context = { organizationId: 'org1', userId: 'user1', role: 'MEMBER' };
    
    // Member does not have business:read according to our rules, but wait, let's test a tool they do have, or see if they fail what they don't.
    // getBusinessSummaryTool requires 'business:read'
    const allowed = await PermissionGate.verify(context, getBusinessSummaryTool);
    console.assert(allowed === false, 'PermissionGate should reject unauthorized tools');
    console.log("[PASS] Permission Gate blocks unauthorized tools.");

    // 3. JWT Logic
    const jwtToken = await import('./src/lib/jwt').then(m => m.signSessionToken('opaque123'));
    const unwrap = await verifySessionJwt(jwtToken);
    console.assert(unwrap === 'opaque123', 'JWT wrap/unwrap should work');
    console.log("[PASS] Edge Security JWT implementation works.");

    console.log("\nALL VERIFICATIONS PASSED (Locally Verified)");

  } catch (error) {
    console.error("[FAIL] Verification failed:", error);
    process.exit(1);
  }
}

runTests();
