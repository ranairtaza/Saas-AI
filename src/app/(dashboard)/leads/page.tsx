import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/db";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { LeadsClient } from "./leads-client";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const search = typeof resolvedParams.search === 'string' ? resolvedParams.search : '';
  const status = typeof resolvedParams.status === 'string' ? resolvedParams.status : '';
  const owner = typeof resolvedParams.owner === 'string' ? resolvedParams.owner : '';
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const where: any = { organizationId: user.organizationId };
  if (status) where.status = status;
  if (owner) {
    if (owner === 'UNASSIGNED') {
      where.ownerId = null;
    } else {
      where.ownerId = owner;
    }
  }
  if (search) {
    where.OR = [
      { companyName: { contains: search } },
      { contactName: { contains: search } },
      { contactEmail: { contains: search } },
    ];
  }

  const [leads, total, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { owner: { select: { id: true, name: true, email: true } } }
    }),
    prisma.lead.count({ where }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, email: true }
    })
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Manage and qualify your discovered prospects.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Add Lead
        </button>
      </div>

      <LeadsClient 
        initialLeads={leads} 
        initialTotal={total}
        users={users}
        searchParams={{ search, status, owner }}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-border flex items-center justify-between glass rounded-2xl shadow-sm border border-border mt-4">
          <span className="text-sm text-muted-foreground">
            Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <a href={`/leads?page=${page - 1}`} className={`px-3 py-1 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}>Prev</a>
            <a href={`/leads?page=${page + 1}`} className={`px-3 py-1 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted ${page === totalPages ? 'pointer-events-none opacity-50' : ''}`}>Next</a>
          </div>
        </div>
      )}
    </div>
  );
}
