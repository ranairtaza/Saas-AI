import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hasPermission } from '../../../../permissions/rbac';
import { PERMISSIONS } from '../../../../permissions/definitions';

import { getCurrentUser } from '@/lib/session';
import { encrypt } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, PERMISSIONS.INTEGRATION_CONFIGURE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { providerId, credentials } = await req.json();
    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 });
    }

    // Lookup integration
    const integration = await prisma.integration.findUnique({
      where: { provider: providerId }
    });

    if (!integration) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Encrypt credentials securely
    if (credentials) {
      const encryptedKey = encrypt(credentials);
      await prisma.providerCredential.upsert({
        where: {
          organizationId_provider: {
            organizationId: user.organizationId,
            provider: providerId
          }
        },
        update: {
          encryptedKey
        },
        create: {
          organizationId: user.organizationId,
          provider: providerId,
          encryptedKey
        }
      });
    }

    // Upsert connection
    const connection = await prisma.integrationConnection.upsert({
      where: {
        organizationId_integrationId: {
          organizationId: user.organizationId,
          integrationId: integration.id
        }
      },
      update: {
        status: 'ACTIVE'
      },
      create: {
        organizationId: user.organizationId,
        integrationId: integration.id,
        status: 'ACTIVE'
      }
    });

    return NextResponse.json({ connectionId: connection.id, status: connection.status });
  } catch (error: any) {
    console.error("POST /api/integrations/configure failed", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
