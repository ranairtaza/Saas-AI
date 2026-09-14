"use client";

import { useEffect, useState } from "react";
import { CreditCard, History, Zap, CheckCircle2 } from "lucide-react";

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

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [balance, setBalance] = useState<CreditBalance>({ available: 0, reserved: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch("/api/billing");
        if (res.ok) {
          const data = await res.json();
          setBilling(data.billing);
          setBalance(data.balance);
          setTransactions(data.transactions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, []);

  const handleCheckout = async (planId: string) => {
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading billing information...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
        <p className="text-muted-foreground mt-2">Manage your subscription and credit usage.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-4">
              <CreditCard size={24} />
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Current Plan: {billing?.planName || "Free"}
                {billing?.subscriptionStatus && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    billing.subscriptionStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-600' :
                    billing.subscriptionStatus === 'TRIALING' ? 'bg-blue-500/10 text-blue-600' :
                    billing.subscriptionStatus === 'PAST_DUE' || billing.subscriptionStatus === 'INCOMPLETE' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {billing.subscriptionStatus}
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">{balance.available}</span>
              <span className="text-muted-foreground">Credits Available</span>
            </div>
            {balance.reserved > 0 && (
              <p className="text-sm text-yellow-500 mb-6">{balance.reserved} credits reserved for active jobs</p>
            )}
            <p className="text-sm text-muted-foreground mb-6">Your plan allocates {billing?.monthlyCredits || 50} credits per month. Credits are consumed for discovering and enriching leads.</p>
          </div>
          
          <div className="flex gap-4">
            {billing?.stripeCustomerId ? (
              <button onClick={handlePortal} className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-md font-medium transition-colors">
                Manage Subscription
              </button>
            ) : (
              <button disabled className="bg-secondary/50 text-secondary-foreground px-4 py-2 rounded-md font-medium cursor-not-allowed">
                No Active Subscription
              </button>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-primary/20 border flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap size={100} />
          </div>
          <h2 className="text-lg font-semibold mb-2">Need more power?</h2>
          <p className="text-sm text-muted-foreground mb-6 flex-1">
            Upgrade to a premium plan to unlock thousands of monthly credits and advanced AI enrichment features.
          </p>
          <button 
            onClick={() => handleCheckout("pro-plan-id")} 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors shadow-lg shadow-primary/20"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <History size={20} className="text-muted-foreground" />
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
        </div>

        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No recent transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="pb-3 font-medium text-muted-foreground">Date</th>
                  <th className="pb-3 font-medium text-muted-foreground">Description</th>
                  <th className="pb-3 font-medium text-muted-foreground">Type</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="py-3">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-3">{tx.description}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tx.type === 'GRANT' || tx.type === 'REFUND' ? 'bg-green-500/10 text-green-500' :
                        tx.type === 'CONSUME' ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium">
                      {tx.type === 'GRANT' || tx.type === 'REFUND' ? '+' : '-'}{tx.amount}
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
