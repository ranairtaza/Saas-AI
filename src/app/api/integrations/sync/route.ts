import { NextResponse } from 'next/server';
import { hasPermission } from '../../../../permissions/rbac';
import { PERMISSIONS } from '../../../../permissions/definitions';
import { syncManager } from '../../../../integrations/core/manager';

import { getCurrentUser } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, PERMISSIONS.INTEGRATION_CONFIGURE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { connectionId } = await req.json();
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    const jobId = await syncManager.startSync(user.organizationId, connectionId);

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error("POST /api/integrations/sync failed", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
