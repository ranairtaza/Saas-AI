"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  ChevronRight, 
  Building2, 
  ShieldCheck, 
  TrendingUp, 
  Database, 
  Eye, 
  Sliders, 
  CheckSquare, 
  Zap, 
  Loader2, 
  AlertCircle 
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [profile, setProfile] = useState({
    businessName: "",
    industry: "B2B SaaS",
    businessModel: "Subscriptions (ARR/MRR)",
    targetMarket: "Mid-Market B2B & Founders",
    operatingPriorities: "Accelerate ARR Growth",
    initialDecisionApproved: true,
  });

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/onboard", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        router.push("/executive");
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to finalize executive onboarding");
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        
        {/* Step Indicator Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {[
              { num: 1, label: "The Operating Loop" },
              { num: 2, label: "Profile & Priorities" },
              { num: 3, label: "Telemetry & Data" },
              { num: 4, label: "First Decision" },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    step >= s.num 
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.num ? <CheckCircle2 size={18} /> : s.num}
                </div>
                <span className={`text-[11px] mt-1.5 font-medium hidden sm:block ${
                  step >= s.num ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="glass p-6 sm:p-8 rounded-2xl shadow-xl border border-border min-h-[480px] flex flex-col justify-between">
          
          {/* STEP 1: The Executive Operating Loop */}
          {step === 1 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div>
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold w-fit mb-4">
                  <ShieldCheck size={14} />
                  <span>Executive Operating System</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                  Welcome to LeadMachine
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6">
                  LeadMachine acts as the AI Operating System for your business. It tracks raw data, isolates what matters, proposes evidence-backed decisions, and requires your explicit approval before taking action.
                </p>

                {/* The Core Loop Visualization */}
                <div className="rounded-xl border border-border bg-card/60 p-4 sm:p-5 mb-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    The Continuous Executive Loop
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-background border border-border flex flex-col justify-between">
                      <span className="font-semibold text-primary">1. BUSINESS DATA</span>
                      <span className="text-[11px] text-muted-foreground mt-1">Stripe, Leads, Goals</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border flex flex-col justify-between">
                      <span className="font-semibold text-blue-500">2. BUSINESS STATE</span>
                      <span className="text-[11px] text-muted-foreground mt-1">Truth baseline & metrics</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border flex flex-col justify-between">
                      <span className="font-semibold text-amber-500">3. WHAT MATTERS</span>
                      <span className="text-[11px] text-muted-foreground mt-1">Anomalies & risks</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border flex flex-col justify-between">
                      <span className="font-semibold text-emerald-500">4. OWNER APPROVAL</span>
                      <span className="text-[11px] text-muted-foreground mt-1">You decide. Always.</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs sm:text-sm text-muted-foreground mb-6">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span><strong>Human Governance Guarantee:</strong> No automated action runs without owner verification.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span><strong>Zero Fake Data:</strong> Unconnected telemetry displays explicit <em>Awaiting Sync</em> states.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span><strong>Continuous Learning:</strong> Tracks expected vs actual outcomes to refine recommendations.</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Configure Business Profile <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: Organization Profile & Strategic Priorities */}
          {step === 2 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Operating Profile & Priorities
                </h1>
                <p className="text-muted-foreground text-sm mb-5">
                  Define your business baseline so executive reasoning focuses on your real operational goals.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5 block">
                      Company / Organization Name *
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="e.g. Acme Technologies"
                      required
                      value={profile.businessName} 
                      onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5 block">
                        Industry
                      </label>
                      <select 
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={profile.industry}
                        onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                      >
                        <option value="B2B SaaS">B2B SaaS / Software</option>
                        <option value="Professional Services">Agency & Professional Services</option>
                        <option value="E-Commerce">E-Commerce & D2C</option>
                        <option value="Healthcare & FinTech">FinTech / Healthcare</option>
                        <option value="Other">Other Enterprise</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5 block">
                        Business Model
                      </label>
                      <select 
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={profile.businessModel}
                        onChange={(e) => setProfile({ ...profile, businessModel: e.target.value })}
                      >
                        <option value="Subscriptions (ARR/MRR)">Recurring Subscriptions (ARR/MRR)</option>
                        <option value="Monthly Retainers">Fixed Retainer Contracts</option>
                        <option value="Usage-Based">Usage-Based Pricing</option>
                        <option value="Transaction-Fee">Transactional Revenue</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5 block">
                      Target Market & ICP
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="e.g. Series-A Founders, Mid-Market CFOs, IT Directors"
                      value={profile.targetMarket} 
                      onChange={(e) => setProfile({ ...profile, targetMarket: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5 block">
                      Primary Operating Priority
                    </label>
                    <select 
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={profile.operatingPriorities}
                      onChange={(e) => setProfile({ ...profile, operatingPriorities: e.target.value })}
                    >
                      <option value="Accelerate ARR Growth">Accelerate ARR Growth</option>
                      <option value="Protect & Expand Gross Margins">Protect & Expand Gross Margins</option>
                      <option value="Reduce Customer Churn & Retain Accounts">Reduce Customer Churn & Retain Accounts</option>
                      <option value="Scale Sales Pipeline Velocity">Scale Sales Pipeline Velocity</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium"
                >
                  Back
                </button>
                <button 
                  onClick={() => { if (profile.businessName.trim()) setStep(3); }}
                  disabled={!profile.businessName.trim()}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  Confirm Priority & Next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: What LeadMachine Monitors & Business Telemetry */}
          {step === 3 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  What LeadMachine Monitors
                </h1>
                <p className="text-muted-foreground text-sm mb-5">
                  The operating system ingests telemetry across three core pillars. Unconnected sources clearly display <em>Awaiting Sync</em>.
                </p>

                <div className="space-y-3 mb-6">
                  {/* Pillar 1: Revenue */}
                  <div className="p-4 rounded-xl border border-border bg-card/60 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground">Revenue & Cash Velocity</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Monitors ARR/MRR trends, customer expansion, contraction, and churn telemetry via Stripe.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-amber-500/10 text-amber-500 shrink-0">
                      Awaiting Sync
                    </span>
                  </div>

                  {/* Pillar 2: Pipeline */}
                  <div className="p-4 rounded-xl border border-border bg-card/60 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground">Acquisition & Pipeline Intelligence</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Discovers verified prospects, executes AI qualification, and scores leads against your ICP.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-500 shrink-0">
                      Ready to Target
                    </span>
                  </div>

                  {/* Pillar 3: Governance */}
                  <div className="p-4 rounded-xl border border-border bg-card/60 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground">Strategic Goals & Human Governance</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Evaluates financial risk thresholds, stages recommended actions, and requires owner approval.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-primary/10 text-primary shrink-0">
                      Active
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2.5">
                  <Database size={16} className="text-primary shrink-0" />
                  <span>You can connect live Stripe & CRM API keys anytime under <strong>Settings → Providers</strong>. Zero fake data is ever generated.</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setStep(2)}
                  className="px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  Review Baseline State <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Current Business State & First Decision */}
          {step === 4 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Initial Business State & First Decision
                </h1>
                <p className="text-muted-foreground text-sm mb-5">
                  Here is your live truth baseline. LeadMachine has staged your first recommended decision based on your strategic priority.
                </p>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs mb-4 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Ground Truth Baseline */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-center">
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">ARR / Revenue</span>
                    <span className="text-xs font-semibold text-amber-500 block mt-1">Awaiting Sync</span>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Active Pipeline</span>
                    <span className="text-xs font-semibold text-emerald-500 block mt-1">0 Discovered</span>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Operating Priority</span>
                    <span className="text-xs font-semibold text-foreground truncate block mt-1">{profile.operatingPriorities.split(" ")[0]} Growth</span>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Telemetry Status</span>
                    <span className="text-xs font-semibold text-blue-500 block mt-1">Baseline Initialized</span>
                  </div>
                </div>

                {/* First Staged Decision Card */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Recommended Decision #1
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                      LOW RISK (10/100)
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-foreground mb-1.5">
                    Initialize Executive Monitoring Baseline for {profile.operatingPriorities}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    <strong>Evidence & Reasoning:</strong> Operating priority established as <em>{profile.operatingPriorities}</em>. With live revenue telemetry pending sync, establishing your baseline criteria allows the decision engine to model pipeline velocity and accurately measure outcome attribution.
                  </p>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      checked={profile.initialDecisionApproved}
                      onChange={(e) => setProfile({ ...profile, initialDecisionApproved: e.target.checked })}
                    />
                    <span className="text-xs text-foreground font-medium">
                      <strong>Approve as Owner:</strong> Authorize LeadMachine to activate baseline governance and queue telemetry tracking for {profile.businessName || "my business"}.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className="px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium disabled:opacity-50"
                >
                  Back
                </button>
                <button 
                  onClick={completeOnboarding}
                  disabled={isSubmitting}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <><Loader2 size={18} className="animate-spin" /> Launching Command Center...</>
                  ) : (
                    <>Launch Executive Command Center <ChevronRight size={18} /></>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
