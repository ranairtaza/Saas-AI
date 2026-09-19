/**
 * Phase 49.1 - Latency Measurement & Performance Verification
 * 
 * Measures actual p50, p95 latencies for different snapshot caching states
 * and full dashboard loads, strictly measuring the application code paths without
 * HTTP transport overhead.
 */

import { ExecutiveDashboardService } from '../src/ai/executive/dashboard-service';
import { prisma } from '../src/lib/db';
import { Redis } from '@upstash/redis';

async function measure(name: string, iters: number, fn: () => Promise<any>) {
  const times: number[] = [];
  
  // Warmup
  await fn().catch(() => {});
  
  for (let i = 0; i < iters; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(iters * 0.5)];
  const p95 = times[Math.floor(iters * 0.95)];
  
  console.log(`[LOCAL] ${name.padEnd(20)} | p50: ${p50}ms | p95: ${p95}ms | samples: ${iters}`);
}

async function main() {
  console.log('--- Phase 49 Benchmark ---');
  
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.log('No organization found.');
    return;
  }
  
  const orgId = org.id;

  // Clear caches for cache miss scenario
  try {
    const redis = Redis.fromEnv();
    await redis.del(`exec_snap:${orgId}`);
    await redis.del(`exec_dash:${orgId}`);
  } catch (e) {
    // ignore
  }

  // 1. Snapshot Cache Miss
  await measure('Snapshot Cache Miss', 5, () => 
    ExecutiveDashboardService.getDashboardReadModel(orgId, { forceRefresh: true, mode: 'snapshot' })
  );

  // 2. Snapshot Cache Hit
  await measure('Snapshot Cache Hit', 20, () => 
    ExecutiveDashboardService.getDashboardReadModel(orgId, { forceRefresh: false, mode: 'snapshot' })
  );

  // 3. Deep Mode
  await measure('Deep Mode', 3, () => 
    ExecutiveDashboardService.getDashboardReadModel(orgId, { forceRefresh: true, mode: 'deep' })
  );

  // 4. Full Mode
  await measure('Full Mode', 3, () => 
    ExecutiveDashboardService.getDashboardReadModel(orgId, { forceRefresh: true, mode: 'full' })
  );

  console.log('--- Benchmark Complete ---');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
