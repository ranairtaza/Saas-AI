"use client";

import { useState, useEffect } from "react";
import { Loader2, Bell, Moon, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/Toast";

export default function PreferencesSettingsPage() {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  useEffect(() => {
    fetch("/api/settings/preferences")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.preferences) {
          setEmailAlerts(data.preferences.emailAlerts ?? true);
          setDailyDigest(data.preferences.dailyDigest ?? true);
          setPushNotifications(data.preferences.pushNotifications ?? false);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAlerts, dailyDigest, pushNotifications }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      addToast("Preferences saved successfully", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to save preferences", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Customize your experience, notifications, and interface settings.
        </p>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Moon size={18} className="text-muted-foreground" />
            Appearance
          </h3>
        </div>
        
        <div className="p-6 bg-muted/30">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <div className="w-6 h-6 rounded bg-white shadow-sm" />
              </div>
              <span className="font-medium">Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3 border border-slate-800">
                <div className="w-6 h-6 rounded bg-slate-800 shadow-sm" />
              </div>
              <span className="font-medium">Dark</span>
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-slate-100 to-slate-900 flex items-center justify-center mb-3 border border-border">
                <div className="w-6 h-6 rounded bg-gradient-to-r from-white to-slate-800 shadow-sm" />
              </div>
              <span className="font-medium">System</span>
            </button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Bell size={18} className="text-muted-foreground" />
            Notifications
          </h3>
        </div>
        
        <div className="p-6 bg-muted/30">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex h-5 items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Critical Event Alerts</p>
                  <p className="text-xs text-muted-foreground mt-1">Receive immediate emails when high-priority business events occur.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex h-5 items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={dailyDigest}
                    onChange={(e) => setDailyDigest(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Daily Executive Briefing</p>
                  <p className="text-xs text-muted-foreground mt-1">Receive a comprehensive daily summary of pipeline health and AI recommendations.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex h-5 items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Browser Push Notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">Get instant notifications in your browser for urgent decisions.</p>
                </div>
              </label>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save Preferences'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
