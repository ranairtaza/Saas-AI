import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        billing: {
          select: {
            plan: { select: { name: true } },
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const workspaceUrl = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        workspaceUrl: workspaceUrl || 'workspace',
        plan: org.billing?.plan?.name || 'Starter',
        createdAt: org.createdAt,
        users: org.users,
      },
    });
  } catch (error: any) {
    console.error('[API /api/settings/organization GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch organization settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Must have admin or owner permission to edit organization
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin permissions required' }, { status: 403 });
    }

    const body = await req.json();
    const { companyName } = body;

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return NextResponse.json({ error: 'Valid company name is required' }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: companyName.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: updated.id,
        name: updated.name,
      },
    });
  } catch (error: any) {
    console.error('[API /api/settings/organization PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update organization settings' }, { status: 500 });
  }
}
