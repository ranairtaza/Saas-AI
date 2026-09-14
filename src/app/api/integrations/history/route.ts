import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { hasPermission } from '../../../../permissions/rbac';
import { PERMISSIONS } from '../../../../permissions/definitions';

import { getCurrentUser } from '@/lib/session';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, PERMISSIONS.INTEGRATION_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');

    const history = await prisma.syncJob.findMany({
      where: { 
        organizationId: user.organizationId,
        ...(connectionId ? { integrationConnectionId: connectionId } : {})
      },
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error("GET /api/integrations/history failed", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
