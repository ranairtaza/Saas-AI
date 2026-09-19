import { NextRequest } from 'next/server';
import { GET as snapshotGET } from '../snapshot/route';

export const dynamic = 'force-dynamic';

/**
 * Phase 48.2: Consolidated System Overview Endpoint
 * Delegates to canonical /api/system/snapshot to ensure unified tenancy,
 * shared dependency-health engine, and zero divergent health logic.
 */
export async function GET(req: NextRequest) {
  return snapshotGET(req);
}
