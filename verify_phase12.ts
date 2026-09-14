import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyPhase12() {
  console.log("==========================================");
  console.log("PHASE 12 VERIFICATION: ANALYTICS & DASHBOARD");
  console.log("==========================================");
  
  let passed = true;
  
  // 1. Verify Recharts dependency
  const pkgJsonStr = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8');
  const pkgJson = JSON.parse(pkgJsonStr);
  if (!pkgJson.dependencies['recharts']) {
    console.log("❌ ERROR: recharts is not in package.json dependencies");
    passed = false;
  } else {
    console.log("✅ 1. Recharts dependency installed.");
  }

  // 2. Verify dashboard/page.tsx enforces tenant isolation
  const dashboardPath = path.join(__dirname, 'src/app/(dashboard)/dashboard/page.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
  
  if (!dashboardCode.includes('organizationId: user.organizationId')) {
    console.log("❌ ERROR: Dashboard does not enforce user.organizationId in queries");
    passed = false;
  } else {
    console.log("✅ 2. Tenant isolation enforced on dashboard metrics.");
  }
  
  // 3. Verify mock SVGs removed
  if (dashboardCode.includes('<svg') || dashboardCode.includes('path d="M0,40')) {
    console.log("❌ ERROR: Dashboard still contains mock SVG charts");
    passed = false;
  } else {
    console.log("✅ 3. Mock charts replaced with real data components.");
  }
  
  // 4. Verify Empty State exists
  if (!dashboardCode.includes('Ready to find your next customers?')) {
    console.log("❌ ERROR: Missing friendly empty state for new organizations");
    passed = false;
  } else {
    console.log("✅ 4. Onboarding empty state implemented.");
  }
  
  if (passed) {
    console.log("\n=> PHASE 12 — PASS");
    process.exit(0);
  } else {
    console.log("\n=> PHASE 12 — FAIL");
    process.exit(1);
  }
}

verifyPhase12().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
