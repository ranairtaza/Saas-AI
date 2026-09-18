import { execSync } from 'child_process';

const testSuites = [
  'tests/verify_phase18.ts',
  'tests/verify_phase18_2.ts',
  'tests/verify_phase19.ts',
  'tests/verify_phase20.ts',
  'tests/verify_phase21.ts',
  'tests/verify_phase22.ts',
  'tests/verify_phase23.ts',
  'tests/verify_phase24.ts',
  'tests/verify_phase25.ts',
  'tests/verify_phase26.ts',
  'tests/verify_phase27.ts',
  'tests/verify_phase28.ts',
  'tests/verify_phase29.ts',
  'tests/verify_phase30.ts',
  'tests/verify_phase30_real_db.ts',
  'tests/verify_phase31.ts',
  'tests/verify_phase32.ts',
  'tests/verify_phase33_strict.ts',
  'tests/verify_phase34_strict.ts',
  'tests/verify_phase35_strict.ts',
  'tests/verify_phase36.ts',
  'tests/verify_phase38.ts',
  'tests/verify_phase39.ts',
  'tests/verify_phase40.ts',
  'tests/verify_phase41.ts',
  'tests/verify_phase42.ts',
  'tests/verify_phase43.ts',
  'tests/verify_phase44.ts',
  'tests/verify_phase46.ts',
];

console.log('==========================================================================');
console.log(`🧪 RUNNING FULL ${testSuites.length}-SUITE COMPREHENSIVE REGRESSION MATRIX (PHASES 18 - 46)`);
console.log('==========================================================================\n');

let allPassed = true;

const dbWriteSuites = new Set([
  'tests/verify_phase30_real_db.ts',
  'tests/verify_phase31.ts',
  'tests/verify_phase32.ts',
  'tests/verify_phase33_strict.ts',
  'tests/verify_phase34_strict.ts',
  'tests/verify_phase35_strict.ts',
  'tests/verify_phase38.ts',
  'tests/verify_phase40.ts',
]);

for (const suite of testSuites) {
  try {
    console.log(`▶ Running ${suite}...`);
    const env = { ...process.env };
    if (dbWriteSuites.has(suite)) {
      env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
    } else {
      env.LEADMACHINE_DB_WRITES_ENABLED = 'false';
    }
    execSync(`npx tsx "${suite}"`, { stdio: 'inherit', env });
    console.log(`✅ ${suite} PASSED.\n`);
  } catch (err) {
    console.error(`❌ ${suite} FAILED.`);
    allPassed = false;
    process.exit(1);
  }
}

if (allPassed) {
  console.log('==========================================================================');
  console.log(`🎉 ALL ${testSuites.length} TEST SUITES PASSED CLEANLY WITH ZERO REGRESSIONS!`);
  console.log('==========================================================================');
}

