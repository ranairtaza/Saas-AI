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

  const total = balance.available + balance.reserved;

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">Credits</p>
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-sm font-semibold">{balance.available} <span className="text-xs text-muted-foreground font-normal">Available</span></p>
      </div>
      
      {balance.reserved > 0 && (
        <p className="text-xs text-amber-500 mb-2 font-medium">{balance.reserved} Reserved</p>
      )}

      <Link href="/billing" className="block w-full mt-3 text-xs font-semibold text-center text-primary py-2 rounded-md border border-primary/20 hover:bg-primary/10 transition-colors">
        Manage Billing
      </Link>
    </div>
  );
}
