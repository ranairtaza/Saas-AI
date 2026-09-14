"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, MoreHorizontal, Check, Trash2, User, ChevronDown } from "lucide-react";
import { DeterministicScoringEngine } from "@/lib/leads/scoring/engine";
export function LeadsClient({ 
  initialLeads, 
  initialTotal, 
  users,
  searchParams 
}: { 
  initialLeads: any[]; 
  initialTotal: number;
  users: any[];
  searchParams: any;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const toggleAll = () => {
    if (selectedIds.length === initialLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(initialLeads.map(l => l.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const performBulkAction = async (action: 'DELETE' | 'UPDATE_STATUS' | 'ASSIGN', value?: string) => {
    if (selectedIds.length === 0) return;
    if (action === 'DELETE' && !confirm(`Are you sure you want to delete ${selectedIds.length} leads?`)) return;
    
    setIsBulkUpdating(true);
    try {
      const payload: any = { action, leadIds: selectedIds };
      if (action === 'UPDATE_STATUS') payload.status = value;
      if (action === 'ASSIGN') payload.ownerId = value || null;

      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to perform bulk action");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
    <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <form method="GET" action="/leads" className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              name="search"
              placeholder="Search companies, names, or emails..." 
              defaultValue={searchParams.search || ''}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
            {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          </form>
          
          <form method="GET" action="/leads" className="flex items-center gap-2">
            {searchParams.search && <input type="hidden" name="search" value={searchParams.search} />}
            <select 
              name="status"
              defaultValue={searchParams.status || ''}
              onChange={(e) => e.target.form?.submit()}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors outline-none"
            >
              <option value="">All Statuses</option>
              <option value="DISCOVERED">DISCOVERED</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="PROPOSAL">PROPOSAL</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
            
            <select 
              name="owner"
              defaultValue={searchParams.owner || ''}
              onChange={(e) => e.target.form?.submit()}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors outline-none max-w-[150px]"
            >
              <option value="">All Owners</option>
              <option value="UNASSIGNED">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </form>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 p-2 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-primary px-2">{selectedIds.length} selected</span>
            <div className="flex-1"></div>
            
            <select 
              onChange={(e) => {
                if (e.target.value) performBulkAction('UPDATE_STATUS', e.target.value);
                e.target.value = "";
              }}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 bg-background border border-border rounded-md text-sm outline-none cursor-pointer"
            >
              <option value="">Set Status...</option>
              <option value="DISCOVERED">DISCOVERED</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="PROPOSAL">PROPOSAL</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>

            <select 
              onChange={(e) => {
                performBulkAction('ASSIGN', e.target.value);
                e.target.value = "";
              }}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 bg-background border border-border rounded-md text-sm outline-none cursor-pointer"
            >
              <option value="">Assign To...</option>
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>

            <button 
              onClick={() => performBulkAction('DELETE')}
              disabled={isBulkUpdating}
              className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
              title="Delete Selected"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
            <tr>
              <th className="px-4 py-4 w-12">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === initialLeads.length && initialLeads.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-4 py-4 font-medium">Company & Contact</th>
              <th className="px-4 py-4 font-medium">Status & Owner</th>
              <th className="px-4 py-4 font-medium">Score</th>
              <th className="px-4 py-4 font-medium">Created</th>
              <th className="px-4 py-4 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initialLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className="text-muted-foreground mb-2">No leads found matching your criteria.</p>
                </td>
              </tr>
            ) : initialLeads.map((lead) => (
              <tr key={lead.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.includes(lead.id) ? 'bg-primary/5' : ''}`}>
                <td className="px-4 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{lead.companyName}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {lead.contactName || lead.contactEmail || 'No Contact Info'}
                  </div>
                  {lead.aiSummary && (
                    <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 py-0.5">
                      " {lead.aiSummary} "
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                      {lead.status}
                    </span>
                    {lead.owner ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                        <User size={10} /> {lead.owner.name || lead.owner.email}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 italic">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${lead.score || 0}%` }} />
                      </div>
                      <span className="text-xs font-medium">{lead.score || 0}</span>
                    </div>
                    {lead.score > 0 && (
                      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {DeterministicScoringEngine.categorize(lead.score)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-4 text-right">
                  <Link href={`/leads/${lead.id}`} className="text-muted-foreground hover:text-foreground inline-flex p-2 hover:bg-muted rounded-md transition-colors">
                    <MoreHorizontal size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
