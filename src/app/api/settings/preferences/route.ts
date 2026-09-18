import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { timezone: true },
    });

    return NextResponse.json({
      preferences: {
        emailAlerts: true,
        dailyDigest: true,
        pushNotifications: false,
        timezone: org?.timezone || 'UTC',
      },
    });
  } catch (error: any) {
    console.error('[API /api/settings/preferences GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { timezone } = body;

    if (timezone && typeof timezone === 'string') {
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { timezone },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /api/settings/preferences PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update preferences' }, { status: 500 });
  }
}
