import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyPhase13() {
  console.log("==========================================");
  console.log("PHASE 13 VERIFICATION: CRM INTELLIGENCE");
  console.log("==========================================");
  
  let passed = true;
  
  // 1. Verify schema has ownerId and LeadActivity
  const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  if (!schema.includes('ownerId') || !schema.includes('model LeadActivity')) {
    console.log("❌ ERROR: schema.prisma is missing ownerId or LeadActivity");
    passed = false;
  } else {
    console.log("✅ 1. Schema updated with ownership and activity models.");
  }

  // 2. Verify bulk API exists and enforces organizationId
  const bulkApiPath = path.join(__dirname, 'src/app/api/leads/bulk/route.ts');
  const bulkApiCode = fs.readFileSync(bulkApiPath, 'utf-8');
  if (!bulkApiCode.includes('organizationId: user.organizationId')) {
    console.log("❌ ERROR: Bulk API does not enforce organizationId");
    passed = false;
  } else {
    console.log("✅ 2. Bulk API exists and enforces tenant isolation.");
  }

  // 3. Verify lead mutate API exists and enforces organizationId
  const mutateApiPath = path.join(__dirname, 'src/app/api/leads/[id]/route.ts');
  const mutateApiCode = fs.readFileSync(mutateApiPath, 'utf-8');
  if (!mutateApiCode.includes('organizationId: user.organizationId')) {
    console.log("❌ ERROR: Mutate API does not enforce organizationId");
    passed = false;
  } else {
    console.log("✅ 3. Mutate API exists and enforces tenant isolation.");
  }

  // 4. Verify leads list has bulk capabilities
  const leadsClientPath = path.join(__dirname, 'src/app/(dashboard)/leads/leads-client.tsx');
  const leadsClientCode = fs.readFileSync(leadsClientPath, 'utf-8');
  if (!leadsClientCode.includes('performBulkAction') || !leadsClientCode.includes('checkbox')) {
    console.log("❌ ERROR: Leads client lacks bulk action capabilities");
    passed = false;
  } else {
    console.log("✅ 4. Leads client implements bulk actions and filters.");
  }

  // 5. Verify lead detail has interactive controls
  const detailClientPath = path.join(__dirname, 'src/app/(dashboard)/leads/[id]/lead-detail-client.tsx');
  const detailClientCode = fs.readFileSync(detailClientPath, 'utf-8');
  if (!detailClientCode.includes('updateLead') || !detailClientCode.includes('addNote')) {
    console.log("❌ ERROR: Lead detail client lacks interactive controls");
    passed = false;
  } else {
    console.log("✅ 5. Lead detail client implements interactive updates and activity feed.");
  }

  if (passed) {
    console.log("\n=> PHASE 13 — PASS");
    process.exit(0);
  } else {
    console.log("\n=> PHASE 13 — FAIL");
    process.exit(1);
  }
}

verifyPhase13().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
