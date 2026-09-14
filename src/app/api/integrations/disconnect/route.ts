import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { hasPermission } from '../../../../permissions/rbac';
import { PERMISSIONS } from '../../../../permissions/definitions';
import { syncManager } from '../../../../integrations/core/manager';

import { getCurrentUser } from '@/lib/session';

const prisma = new PrismaClient();

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

    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection || connection.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.integrationConnection.delete({
      where: { id: connectionId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/integrations/disconnect failed", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
