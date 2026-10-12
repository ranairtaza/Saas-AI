"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function CreditsWidget() {
  const [balance, setBalance] = useState<{ available: number; reserved: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing")
      .then((res) => res.json())
      .then((data) => {
        if (data.credits) {
          setBalance({ available: data.credits.availableBalance, reserved: data.credits.reservedBalance });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 mb-4 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!balance) return null;

  const total = 10000;
  const used = Math.min(10000, 3200 + (balance.reserved || 0));
  const percent = Math.round((used / total) * 100);

  return (
    <div className="glass rounded-2xl p-4 mb-4 border border-border/80 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">Pro Plan</span>
        <span className="text-[10px] font-semibold text-muted-foreground">{percent}%</span>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{used.toLocaleString()}</span> / {total.toLocaleString()} Leads used
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500" 
          style={{ width: `${percent}%` }}
        />
      </div>

      <Link 
        href="/billing" 
        className="block w-full py-1.5 px-3 text-xs font-bold text-center text-foreground hover:text-purple-600 bg-background/80 hover:bg-muted/80 rounded-xl border border-border/80 transition-all shadow-sm"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}
