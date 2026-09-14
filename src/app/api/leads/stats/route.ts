import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run aggregations concurrently for performance
    const [
      totalLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      lastWeekTotal,
      recentLeads
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId: user.organizationId } }),
      prisma.lead.count({ where: { organizationId: user.organizationId, status: 'CONTACTED' } }),
      prisma.lead.count({ where: { organizationId: user.organizationId, status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { organizationId: user.organizationId, status: 'CONVERTED' } }),
      // Mocking last week trend comparison by looking for leads older than 7 days
      prisma.lead.count({ 
        where: { 
          organizationId: user.organizationId,
          createdAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Get recent leads for the chart
      prisma.lead.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 7,
        select: { createdAt: true, status: true, companyName: true }
      })
    ]);

    // Calculate mock trend percentages
    const trendBase = lastWeekTotal > 0 ? lastWeekTotal : 1; // Prevent division by zero
    const leadsTrend = Math.round(((totalLeads - lastWeekTotal) / trendBase) * 100);

    return NextResponse.json({
      metrics: {
        totalLeads,
        contactedLeads,
        qualifiedLeads,
        convertedLeads,
      },
      trends: {
        totalLeads: leadsTrend >= 0 ? `+${leadsTrend}%` : `${leadsTrend}%`,
      },
      recentLeads
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
