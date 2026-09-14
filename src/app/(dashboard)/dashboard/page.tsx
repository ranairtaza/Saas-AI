import { getCurrentUser } from "@/lib/session";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Coins, Database, AlertCircle } from "lucide-react";
import prisma from "@/lib/db";
import Link from "next/link";
import { LeadsTrendChart } from "@/components/charts/leads-trend-chart";
import { CreditsUsageChart } from "@/components/charts/credits-usage-chart";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch real analytics data concurrently
  const [
    totalLeads,
    recentLeads,
    totalJobs,
    creditAccount,
    recentSearches,
    leadsLast30Days,
    creditConsumptionLast30Days,
    billing
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId: user.organizationId } }),
    prisma.lead.count({ where: { organizationId: user.organizationId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.discoveryJob.count({ where: { organizationId: user.organizationId } }),
    prisma.creditAccount.findUnique({ where: { organizationId: user.organizationId } }),
    prisma.discoveryJob.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.lead.findMany({
      where: { organizationId: user.organizationId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true }
    }),
    prisma.creditTransaction.findMany({
      where: { organizationId: user.organizationId, type: 'CONSUME', createdAt: { gte: thirtyDaysAgo } },
      select: { amount: true, createdAt: true }
    }),
    prisma.organizationBilling.findUnique({
      where: { organizationId: user.organizationId },
      include: { plan: true }
    })
  ]);

  // Aggregate Leads Trend by Day
  const leadsTrendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    leadsTrendMap.set(dateStr, 0);
  }
  
  leadsLast30Days.forEach((lead) => {
    const dateStr = lead.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (leadsTrendMap.has(dateStr)) {
      leadsTrendMap.set(dateStr, leadsTrendMap.get(dateStr)! + 1);
    }
  });

  const leadsChartData = Array.from(leadsTrendMap.entries()).map(([date, leads]) => ({ date, leads }));

  // Aggregate Credit Usage by Day
  const creditsTrendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    creditsTrendMap.set(dateStr, 0);
  }

  creditConsumptionLast30Days.forEach((tx) => {
    const dateStr = tx.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (creditsTrendMap.has(dateStr)) {
      creditsTrendMap.set(dateStr, creditsTrendMap.get(dateStr)! + tx.amount);
    }
  });

  const creditsChartData = Array.from(creditsTrendMap.entries()).map(([date, credits]) => ({ date, credits }));

  const hasData = totalLeads > 0 || totalJobs > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name?.split(' ')[0] || 'User'} 👋</p>
      </div>

      {!hasData && (
        <div className="glass rounded-2xl p-8 border border-border bg-primary/5 flex flex-col items-center justify-center text-center space-y-4">
          <Database size={48} className="text-primary/50" />
          <h2 className="text-2xl font-semibold">Ready to find your next customers?</h2>
          <p className="text-muted-foreground max-w-lg">
            Your workspace is set up and ready to go. Run your first discovery job to start acquiring qualified B2B leads.
          </p>
          <div className="pt-4 flex gap-4">
            <Link href="/settings/providers" className="px-6 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm transition-opacity hover:opacity-90">
              Configure Provider
            </Link>
            <Link href="/discover" className="px-6 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-opacity hover:opacity-90">
              Start Discovery
            </Link>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Leads Found" value={totalLeads.toString()} trend={`${recentLeads} new`} isPositive={recentLeads > 0} suffix="this week" />
        <MetricCard title="Discovery Jobs Run" value={totalJobs.toString()} trend="Active" isPositive={true} suffix="usage" />
        <MetricCard title="Available Credits" value={(creditAccount?.availableBalance || 0).toString()} trend={creditAccount?.reservedBalance ? `${creditAccount.reservedBalance} reserved` : 'Ready to use'} isPositive={true} suffix="" />
        <div className="glass rounded-2xl p-6 shadow-sm border border-border relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Current Plan</p>
          <h3 className="text-2xl font-bold tracking-tight mb-2 truncate">{billing?.plan?.name || "Free Tier"}</h3>
          <div className="flex items-center justify-between text-sm mt-4">
             <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${billing?.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
               {billing?.subscriptionStatus || "INACTIVE"}
             </span>
             <Link href="/billing" className="text-primary hover:underline">Manage</Link>
          </div>
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="font-semibold text-lg">Lead Acquisition</h3>
               <p className="text-sm text-muted-foreground">New leads sourced over the last 30 days</p>
            </div>
          </div>
          <div className="flex-1 mt-auto">
             <LeadsTrendChart data={leadsChartData} />
          </div>
        </div>
        
        <div className="glass rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="font-semibold text-lg">Credit Consumption</h3>
               <p className="text-sm text-muted-foreground">Credits consumed during discovery jobs</p>
            </div>
          </div>
          <div className="flex-1 mt-auto">
             <CreditsUsageChart data={creditsChartData} />
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-lg">Recent Discovery Jobs</h3>
          <Link href="/discover" className="text-sm text-primary hover:underline font-medium">Run New Search</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Criteria Summary</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentSearches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No discovery jobs run yet.
                  </td>
                </tr>
              ) : recentSearches.map((job) => {
                let criteriaObj = { q_organization_domains: '', person_titles: [] };
                try {
                  criteriaObj = JSON.parse(job.criteria);
                } catch(e) {}
                const titleStr = criteriaObj?.person_titles?.length ? criteriaObj.person_titles.join(', ') : 'Any Role';
                const domainStr = criteriaObj?.q_organization_domains || 'Any Domain';

                return (
                <tr key={job.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                     {new Date(job.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                     <div className="font-medium text-foreground truncate max-w-[200px] md:max-w-md" title={`${titleStr} @ ${domainStr}`}>
                        {titleStr} <span className="text-muted-foreground font-normal">at</span> {domainStr}
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium border
                      ${job.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 
                        job.status === 'FAILED' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 
                        'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'}`}>
                      {job.status}
                    </span>
                    {job.error && (
                       <p className="text-xs text-red-500 mt-1 flex items-center max-w-[200px] truncate" title={job.error}>
                         <AlertCircle size={10} className="mr-1 flex-shrink-0" /> {job.error}
                       </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">
                     {job.processed} <span className="text-muted-foreground font-normal">/ {job.total || '-'}</span>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, isPositive, suffix }: { title: string, value: string, trend: string, isPositive: boolean, suffix: string }) {
  return (
    <div className="glass rounded-2xl p-6 shadow-sm border border-border">
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <h3 className="text-3xl font-bold tracking-tight mb-2">{value}</h3>
      <div className="flex items-center text-sm font-medium">
        <span className={`flex items-center ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
          {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <MoreHorizontal size={16} className="mr-1" />}
          {trend}
        </span>
        {suffix && <span className="text-muted-foreground ml-2">{suffix}</span>}
      </div>
    </div>
  );
}
