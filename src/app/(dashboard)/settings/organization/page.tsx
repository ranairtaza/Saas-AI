"use client";

import { useState, useEffect } from "react";
import { Loader2, Building2, Users } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export default function OrganizationSettingsPage() {
  const { addToast } = useToast();
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetch("/api/settings/organization")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load organization settings");
        return res.json();
      })
      .then((data) => {
        if (data.organization) {
          setCompanyName(data.organization.name || "");
          setWorkspaceUrl(data.organization.workspaceUrl || "");
          setTeamMembers(data.organization.users || []);
        }
      })
      .catch((err) => {
        console.error(err);
        addToast(err.message || "Failed to load organization data", "error");
      })
      .finally(() => setIsFetching(false));
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      addToast("Company name cannot be empty", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update organization");
      }

      addToast("Organization details updated successfully", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update organization", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
        <p className="text-muted-foreground mt-2">
          Manage your company details and team members.
        </p>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Building2 size={18} className="text-muted-foreground" />
            Company Details
          </h3>
        </div>
        
        <div className="p-6 bg-muted/30">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Workspace URL</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-muted border border-r-0 border-border rounded-l-lg text-sm text-muted-foreground whitespace-nowrap">
                    leadmachine.io/
                  </span>
                  <input
                    type="text"
                    value={workspaceUrl}
                    onChange={(e) => setWorkspaceUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users size={18} className="text-muted-foreground" />
            Team Members
          </h3>
          <button className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500 transition-colors">
            Invite Member
          </button>
        </div>
        
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{member.name}</span>
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-violet-600 hover:text-violet-500 font-medium text-sm transition-colors">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
