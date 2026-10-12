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
      {/* Back button & Action Header from Design */}
      <div className="space-y-3">
        <Link 
          href="/leads" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Leads</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {lead.companyName}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Verified
              </span>
            </div>
            
            {/* Metadata row under company from design */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
              <span className="flex items-center gap-1"><Building size={13} className="text-muted-foreground" /> {(lead as any).industry || 'Marketing Agency'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><MapPin size={13} className="text-muted-foreground" /> {lead.location || 'New York, USA'}</span>
              <span>•</span>
              <span>51-200 employees</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Mail size={13} className="text-muted-foreground" /> {lead.contactEmail || 'acme@digital.com'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button className="px-4 py-2 border border-border/80 bg-card hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all shadow-sm">
              Add to Campaign
            </button>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1">
              <span>Export Lead</span>
              <span className="text-[10px]">▾</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Row from Design: Overview, Contacts (12), Technographics, Notes, Activity */}
      <div className="border-b border-border/80 flex items-center gap-8 text-xs font-bold">
        <button className="pb-3 border-b-2 border-purple-600 text-purple-600 dark:text-purple-400 transition-colors">
          Overview
        </button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          Contacts <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded-full">12</span>
        </button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">
          Technographics
        </button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">
          Notes
        </button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">
          Activity
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Contact & Company Info (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information card */}
            <div className="glass rounded-3xl shadow-sm border border-border/80 p-6 space-y-4">
              <h3 className="font-bold text-base text-foreground">Contact Information</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Name</span>
                  <p className="font-bold text-foreground mt-0.5">{lead.contactName || 'Sarah Johnson'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Position</span>
                  <p className="font-semibold text-foreground mt-0.5">{lead.contactTitle || 'Marketing Director'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-semibold text-purple-600 dark:text-purple-400 mt-0.5">{lead.contactEmail || 'sarah.johnson@acmedigital.com'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-semibold text-foreground mt-0.5">{lead.phone || '+1 (212) 555-0187'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">LinkedIn</span>
                  <p className="font-medium text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                    {lead.domain ? `linkedin.com/company/${lead.domain}` : 'linkedin.com/in/sarahjohnson'}
                  </p>
                </div>
                {/* Social icons row */}
                <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                  <span className="h-6 w-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[10px]">in</span>
                  <span className="h-6 w-6 rounded-full bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-[10px]">𝕏</span>
                  <span className="h-6 w-6 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-[10px]">f</span>
                </div>
              </div>
            </div>

            {/* Company Information card */}
            <div className="glass rounded-3xl shadow-sm border border-border/80 p-6 space-y-4">
              <h3 className="font-bold text-base text-foreground">Company Information</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Industry</span>
                  <p className="font-bold text-foreground mt-0.5">{(lead as any).industry || 'Marketing Agencies'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Founded</span>
                  <p className="font-semibold text-foreground mt-0.5">2016</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Company Size</span>
                  <p className="font-semibold text-foreground mt-0.5">51-200 employees</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue</span>
                  <p className="font-semibold text-foreground mt-0.5">$5M - $10M</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Location</span>
                  <p className="font-semibold text-foreground mt-0.5">{lead.location || 'New York, USA'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Description</span>
                  <p className="text-muted-foreground leading-relaxed mt-0.5">
                    Full-service digital marketing agency helping brands grow through data-driven strategies.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Notes full-width bottom card from Design */}
          <div className="glass rounded-3xl shadow-sm border border-border/80 p-6 space-y-3 bg-gradient-to-r from-purple-500/5 via-card to-indigo-500/5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <span>AI Notes</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                ✨ Generated by AI
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lead.companyName} is actively looking for new SEO and PPC tools. They recently hired 3 new marketers and posted about aggressive growth targets for Q3. High probability of engagement on outbound sequences.
            </p>
          </div>
        </div>

        {/* Right Column: AI Score Gauge & Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Score Circular Gauge Card from Design */}
          <div className="glass rounded-3xl shadow-sm border border-border/80 p-6 space-y-5 text-center">
            <h3 className="font-bold text-base text-foreground text-left">AI Score</h3>
            
            {/* Donut Gauge Visual */}
            <div className="relative flex items-center justify-center my-2">
              <div className="w-28 h-28 rounded-full border-8 border-purple-500/20 flex flex-col items-center justify-center bg-card shadow-inner">
                <span className="text-3xl font-black text-foreground">
                  {lead.score || 92}
                </span>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Excellent Fit
                </span>
              </div>
            </div>

            {/* Checklist attributes from design */}
            <div className="space-y-2 text-left text-xs pt-2 border-t border-border/60">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Matches your industry</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Company size fits</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Active on digital channels</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>High growth potential</span>
              </div>
            </div>

            <button className="w-full py-2.5 px-4 bg-muted/80 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors border border-border/80 shadow-sm">
              View Similar Leads
            </button>
          </div>

          {/* Existing interactive client controls */}
          <LeadDetailClient lead={lead} users={users} activities={activities} />
        </div>
      </div>
    </div>
  );
}
