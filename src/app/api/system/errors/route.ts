import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { isSystemOperator } from '@/permissions/definitions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalOperator = isSystemOperator(user);
    if (!isGlobalOperator && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Owner or Admin role required' },
        { status: 403 }
      );
    }

    // Strict tenant barrier: Non-operator must have an active organizationId
    if (!isGlobalOperator && !user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: User is not associated with an organization' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);
    const severity = searchParams.get('severity');

    // Tenant isolation: enforce user.organizationId unless caller is global system operator
    const effectiveOrgId = isGlobalOperator ? searchParams.get('organizationId') || undefined : user.organizationId;

    const where: any = {
      OR: [
        { statusCode: { gte: 400 } },
        { severity: { in: ['WARN', 'ERROR', 'CRITICAL'] } },
        { eventType: 'ERROR' },
      ],
    };

    if (effectiveOrgId) {
      where.organizationId = effectiveOrgId;
    } else if (!isGlobalOperator) {
      where.organizationId = user.organizationId;
    }

    if (severity) {
      where.severity = severity;
    }

    const events = await prisma.systemTelemetryEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        userId: true,
        eventType: true,
        severity: true,
        route: true,
        method: true,
        statusCode: true,
        durationMs: true,
        requestId: true,
        traceId: true,
        service: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      events,
      tenantContext: {
        isGlobalOperator,
        organizationId: effectiveOrgId || null,
        isolated: !isGlobalOperator,
      },
    });
  } catch (error: any) {
    console.error('[SystemErrors] Failed to fetch system errors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
