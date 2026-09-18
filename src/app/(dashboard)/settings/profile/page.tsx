"use client";

import { useState, useEffect } from "react";
import { Loader2, User, Mail, Shield } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function ProfileSettingsPage() {
  const { addToast } = useToast();
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load user profile");
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setName(data.user.name || "");
          setEmail(data.user.email || "");
          setRole(data.user.role || "MEMBER");
        }
      })
      .catch((err) => {
        console.error(err);
        addToast(err.message || "Failed to load profile", "error");
      })
      .finally(() => setIsFetching(false));
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Full name cannot be empty", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }

      addToast("Profile updated successfully", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update profile", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal information and security preferences.
        </p>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <User size={18} className="text-muted-foreground" />
            Personal Information
          </h3>
        </div>
        
        <div className="p-6 bg-muted/30">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Shield size={18} className="text-muted-foreground" />
            Security
          </h3>
        </div>
        
        <div className="p-6 bg-muted/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-lg border border-border">
            <div>
              <p className="font-medium text-sm">Password</p>
              <p className="text-xs text-muted-foreground mt-1">Last changed 3 months ago</p>
            </div>
            <button className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
              Change Password
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-lg border border-border">
            <div>
              <p className="font-medium text-sm">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground mt-1">Add an extra layer of security to your account</p>
            </div>
            <button className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500 transition-colors">
              Enable 2FA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
