import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

const ALLOWLISTED_PROVIDERS = ['apollo', 'stripe'];

const credentialSchema = z.object({
  apiKey: z.string().min(1)
});

export async function PUT(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: paramProvider } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.INTEGRATION_CONFIGURE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = paramProvider.toLowerCase();
    if (!ALLOWLISTED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const body = await request.json();
    const result = credentialSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input data', details: result.error.format() }, { status: 400 });
    }

    const encryptedKey = encrypt(result.data.apiKey);

    await prisma.providerCredential.upsert({
      where: {
        organizationId_provider: {
          organizationId: user.organizationId,
          provider: provider
        }
      },
      update: {
        encryptedKey: encryptedKey
      },
      create: {
        organizationId: user.organizationId,
        provider: provider,
        encryptedKey: encryptedKey
      }
    });

    return NextResponse.json({ success: true, provider, configured: true }, { status: 200 });
  } catch (error) {
    console.error(`Settings API Error:`, error);
    return NextResponse.json({ error: 'Failed to update provider credential' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: paramProvider } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.INTEGRATION_CONFIGURE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = paramProvider.toLowerCase();

    await prisma.providerCredential.deleteMany({
      where: {
        organizationId: user.organizationId,
        provider: provider
      }
    });

    return NextResponse.json({ success: true, provider, configured: false }, { status: 200 });
  } catch (error) {
    console.error(`Settings API Error:`, error);
    return NextResponse.json({ error: 'Failed to delete provider credential' }, { status: 500 });
  }
}
