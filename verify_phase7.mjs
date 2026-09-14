import prisma from './src/lib/db.js';
import { grantCredits, reserveCredits, consumeCredits, refundCredits, getCreditBalance } from './src/lib/billing/credits.js';
import crypto from 'crypto';
import assert from 'assert';

async function run() {
  console.log("==========================================");
  console.log("PHASE 7 VERIFICATION: Billing & Credits");
  console.log("==========================================");

  let orgA, orgB;
  let testFailed = false;

  try {
    orgA = await prisma.organization.create({ data: { name: 'Billing Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'Billing Org B' } });

    console.log("1. Testing Grants...");
    await grantCredits(orgA.id, 100, 'TEST_GRANT', 'ref1', 'Initial grant');
    let balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 100);

    console.log("2. Testing Idempotent Grants...");
    await grantCredits(orgA.id, 100, 'TEST_GRANT', 'ref1', 'Initial grant duplicate');
    balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 100); // Should still be 100

    console.log("3. Testing Tenant Isolation...");
    let balB = await getCreditBalance(orgB.id);
    assert.strictEqual(balB.available, 0);

    console.log("4. Testing Reservation...");
    await reserveCredits(orgA.id, 40, 'DISCOVERY_JOB', 'job1', 'Reserving for job');
    balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 60);
    assert.strictEqual(balA.reserved, 40);

    console.log("5. Testing Insufficient Balance...");
    try {
      await reserveCredits(orgA.id, 100, 'DISCOVERY_JOB', 'job2');
      assert.fail("Should have thrown insufficient credits");
    } catch(err) {
      assert(err.message.includes('Insufficient'));
    }

    console.log("6. Testing Consumption...");
    await consumeCredits(orgA.id, 30, 'DISCOVERY_JOB', 'job1-consume', 'Consumed 30 leads');
    balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 60);
    assert.strictEqual(balA.reserved, 10); // 10 still reserved

    console.log("7. Testing Refund...");
    await refundCredits(orgA.id, 10, 'DISCOVERY_JOB', 'job1-refund', 'Refund unused 10 leads');
    balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 70); // 60 + 10 refunded
    assert.strictEqual(balA.reserved, 0);

    console.log("8. Testing Idempotent Refunds...");
    await refundCredits(orgA.id, 10, 'DISCOVERY_JOB', 'job1-refund', 'Refund unused 10 leads again');
    balA = await getCreditBalance(orgA.id);
    assert.strictEqual(balA.available, 70);
    assert.strictEqual(balA.reserved, 0);

    console.log("=> Credit Engine: PASS");

    console.log("\nREAL STRIPE PAYMENT TEST: NOT EXECUTED\n");
    console.log("PHASE 7 — PASS");
  } catch (error) {
    console.error("PHASE 7 FAILED:");
    console.error(error);
    testFailed = true;
  } finally {
    if (orgA) await prisma.organization.delete({ where: { id: orgA.id } });
    if (orgB) await prisma.organization.delete({ where: { id: orgB.id } });
  }

  process.exit(testFailed ? 1 : 0);
}

run();
