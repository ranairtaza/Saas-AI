import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building, Mail, Phone, MapPin, Globe } from "lucide-react";
import { LeadDetailClient } from "./lead-detail-client";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;

  const [lead, users, activities] = await Promise.all([
    prisma.lead.findUnique({
      where: { 
        id,
        organizationId: user.organizationId 
      },
      include: { owner: true }
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, email: true }
    }),
    prisma.leadActivity.findMany({
      where: { leadId: id, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    })
  ]);

  if (!lead) return notFound();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/leads" className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {lead.companyName}
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {lead.status}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">Discovered on {new Date(lead.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-2xl shadow-sm border border-border p-6">
            <h3 className="font-semibold text-lg mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2"><Building size={14} /> Company</span>
                <p className="font-medium">{lead.companyName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2"><Globe size={14} /> Website</span>
                <p className="font-medium text-primary">{lead.domain || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2">Contact Name</span>
                <p className="font-medium">{lead.contactName || '-'}</p>
                <p className="text-sm text-muted-foreground">{lead.contactTitle}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2"><Mail size={14} /> Email</span>
                <p className="font-medium">{lead.contactEmail || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2"><Phone size={14} /> Phone</span>
                <p className="font-medium">{lead.phone || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2"><MapPin size={14} /> Location</span>
                <p className="font-medium">{lead.location || '-'}</p>
              </div>
            </div>
          </div>
          
          {lead.notes && (
            <div className="glass rounded-2xl shadow-sm border border-border p-6">
              <h3 className="font-semibold text-lg mb-4">Legacy Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <LeadDetailClient lead={lead} users={users} activities={activities} />
      </div>
    </div>
  );
}
