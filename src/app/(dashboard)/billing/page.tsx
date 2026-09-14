"use client";

import { useEffect, useState } from "react";
import { 
  CreditCard, 
  History, 
  Zap, 
  CheckCircle2, 
  ExternalLink, 
  AlertCircle, 
  ShieldCheck, 
  Clock, 
  Loader2 
} from "lucide-react";

type BillingInfo = {
  planName: string;
  monthlyCredits: number;
  subscriptionStatus: string;
  stripeCustomerId?: string;
};

type CreditBalance = {
  available: number;
  reserved: number;
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

type PlanItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  monthlyCredits: number;
  stripePriceId: string | null;
  features: string | null;
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [balance, setBalance] = useState<CreditBalance>({ available: 0, reserved: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBillingData() {
      try {
        const [billingRes, plansRes] = await Promise.all([
          fetch("/api/billing"),
          fetch("/api/billing/plans"),
        ]);

        if (billingRes.ok) {
          const data = await billingRes.json();
          setBilling(data.billing);
          setBalance(data.balance || { available: 0, reserved: 0 });
          setTransactions(data.transactions || []);
        }

        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.plans || []);
        }
      } catch (err) {
        console.error("Billing fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBillingData();
  }, []);

  const handleCheckout = async (plan: PlanItem) => {
    setActionNotice(null);
    setCheckoutLoading(plan.id);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setActionNotice(
          data.error || "Stripe Price ID is pending configuration in your production environment variables."
        );
      }
    } catch (err: any) {
      setActionNotice(err.message || "Failed to initiate Stripe checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionNotice(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setActionNotice(data.error || "Customer Portal is available once your first subscription invoice is generated.");
      }
    } catch (err: any) {
      setActionNotice(err.message || "Failed to open customer portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 size={20} className="animate-spin text-primary" />
          <span>Loading billing and subscription state...</span>
        </div>
      </div>
    );
  }

  const isCurrentPlan = (planName: string) => {
    return billing?.planName?.toLowerCase() === planName.toLowerCase();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          <ShieldCheck size={16} />
          <span>Subscription & Financial Governance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organization plan, 7-day trial status, and verified intelligence quotas.
        </p>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Billing Notice:</strong> {actionNotice}
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="glass rounded-2xl p-6 border border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <CreditCard size={22} className="text-primary" />
              <h2 className="text-xl font-bold">
                Current Plan: {billing?.planName || "Free Starter"}
              </h2>
              {billing?.subscriptionStatus && (
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  billing.subscriptionStatus === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                  billing.subscriptionStatus === "TRIALING" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                  billing.subscriptionStatus === "PAST_DUE" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {billing.subscriptionStatus === "TRIALING" ? "7-Day Free Trial" : billing.subscriptionStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Organization-isolated billing. Subscriptions renew automatically each billing cycle.
            </p>
          </div>

          <div>
            {billing?.stripeCustomerId ? (
              <button 
                onClick={handlePortal}
                disabled={portalLoading}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 border border-border"
              >
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Manage Stripe Portal
              </button>
            ) : (
              <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg bg-muted/40 border border-border block">
                No active Stripe subscription
              </span>
            )}
          </div>
        </div>

        {/* Quota breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-muted/20 border border-border">
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">
              Available Intelligence Credits
            </span>
            <span className="text-3xl font-black text-foreground tabular-nums block mt-1">
              {balance.available}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Allocated: {billing?.monthlyCredits || 50} / month
            </span>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border">
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">
              Active Job Reservations
            </span>
            <span className="text-3xl font-black text-foreground tabular-nums block mt-1">
              {balance.reserved}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Unused reservations refund automatically
            </span>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border">
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">
              Executive OS Governance
            </span>
            <span className="text-base font-bold text-foreground block mt-2 flex items-center gap-1.5">
              <ShieldCheck size={18} className="text-emerald-500" />
              Human Gate Active
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              All high-risk actions require owner sign-off
            </span>
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <span>Available Executive Operating System Tiers</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.name);
            const parsedFeatures: string[] = plan.features ? JSON.parse(plan.features) : [];

            return (
              <div 
                key={plan.id}
                className={`glass rounded-2xl p-6 border flex flex-col justify-between relative transition-all ${
                  isCurrent 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-border/80"
                }`}
              >
                {isCurrent && (
                  <div className="absolute top-4 right-4 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    Current Active Tier
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 min-h-[32px]">
                    {plan.description || "Comprehensive AI Executive Operating System"}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-black text-foreground">
                      ${Math.floor(plan.monthlyPrice / 100)}
                    </span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold">
                      7-day free trial
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs mb-6">
                    {parsedFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  {isCurrent ? (
                    <button 
                      disabled
                      className="w-full py-2.5 rounded-xl font-semibold text-xs bg-muted text-muted-foreground cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan)}
                      disabled={checkoutLoading === plan.id}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                      {checkoutLoading === plan.id ? (
                        <><Loader2 size={14} className="animate-spin" /> Connecting Stripe...</>
                      ) : (
                        <>Start 7-Day Free Trial <ExternalLink size={12} /></>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="text-muted-foreground" />
          <h2 className="text-lg font-bold">Recent Credit Transactions</h2>
        </div>

        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-6 text-xs">
            No credit transactions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2.5 font-semibold">Date</th>
                  <th className="pb-2.5 font-semibold">Description</th>
                  <th className="pb-2.5 font-semibold">Type</th>
                  <th className="pb-2.5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="text-foreground">
                    <td className="py-2.5 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 font-medium">{tx.description}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.type === "GRANT" || tx.type === "REFUND" ? "bg-emerald-500/10 text-emerald-500" :
                        tx.type === "CONSUME" ? "bg-destructive/10 text-destructive" :
                        "bg-amber-500/10 text-amber-500"
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">
                      {tx.type === "GRANT" || tx.type === "REFUND" ? "+" : "-"}{tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
