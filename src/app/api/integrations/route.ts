import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hasPermission } from '../../../permissions/rbac';
import { PERMISSIONS } from '../../../permissions/definitions';

import { getCurrentUser } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, PERMISSIONS.INTEGRATION_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId: user.organizationId },
      include: { integration: true }
    });

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error("GET /api/integrations failed", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
