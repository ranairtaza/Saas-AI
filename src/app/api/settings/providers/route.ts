import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const credentials = await prisma.providerCredential.findMany({
      where: { organizationId: user.organizationId },
      select: { provider: true }
    });

    const providers = credentials.map(c => ({
      provider: c.provider,
      configured: true
    }));

    return NextResponse.json({ providers }, { status: 200 });
  } catch (error) {
    console.error('Settings API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
