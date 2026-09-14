"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Zap, Target, Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState({
    businessName: "",
    industry: "",
    businessModel: "",
    targetMarket: "",
    operatingPriorities: ""
  });

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/onboard", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh(); // Ensure layout refetches user
      } else {
        console.error("Failed to complete onboarding");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > i ? <CheckCircle2 size={16} /> : i}
              </div>
              {i < 4 && <div className={`h-1 w-full -mx-4 ${step > i ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="glass p-8 rounded-2xl shadow-sm border border-border min-h-[400px] flex flex-col">
          {step === 1 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                <Target size={32} />
              </div>
              <h1 className="text-3xl font-bold mb-2">Welcome to LeadMachine</h1>
              <p className="text-muted-foreground mb-8">
                Your automated B2B acquisition pipeline is ready. We'll help you discover, verify, and qualify leads at scale.
              </p>
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors mt-auto"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold mb-2">Business Profile</h1>
              <p className="text-muted-foreground mb-6">
                Tell us about your business so we can provide relevant insights.
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-1 block">Business Name *</label>
                  <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" required
                    value={profile.businessName} onChange={(e) => setProfile({...profile, businessName: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Industry</label>
                  <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" placeholder="e.g. B2B SaaS"
                    value={profile.industry} onChange={(e) => setProfile({...profile, industry: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Business Model</label>
                  <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" placeholder="e.g. Subscriptions, Agency"
                    value={profile.businessModel} onChange={(e) => setProfile({...profile, businessModel: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Target Market</label>
                  <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" placeholder="e.g. Enterprise HR Leaders"
                    value={profile.targetMarket} onChange={(e) => setProfile({...profile, targetMarket: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Operating Priorities</label>
                  <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" placeholder="e.g. Grow ARR, Reduce churn"
                    value={profile.operatingPriorities} onChange={(e) => setProfile({...profile, operatingPriorities: e.target.value})} />
                </div>
              </div>

              <button 
                onClick={() => { if(profile.businessName.trim()) setStep(3); }}
                disabled={!profile.businessName.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors mt-auto disabled:opacity-50"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
                <Zap size={32} />
              </div>
              <h1 className="text-3xl font-bold mb-2">How Credits Work</h1>
              <p className="text-muted-foreground mb-6">
                LeadMachine uses a transparent credit system. 
              </p>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-primary mt-0.5" />
                  <span><strong>1 Credit = 1 Verified Lead.</strong> You only pay for what you actually discover and accept.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-primary mt-0.5" />
                  <span><strong>No duplicate charges.</strong> We automatically deduplicate leads against your CRM.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-primary mt-0.5" />
                  <span><strong>Safe reservations.</strong> Unused credits from a discovery job are instantly refunded.</span>
                </li>
              </ul>
              <button 
                onClick={() => setStep(4)}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors mt-auto"
              >
                Got it <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold mb-2">Ready to Discover</h1>
              <p className="text-muted-foreground mb-8">
                To run your first discovery job, you will need to configure your Apollo API key in the Settings page.
              </p>
              
              <div className="bg-muted p-4 rounded-xl mb-8">
                <p className="text-sm font-medium">Your initial Free Plan includes 50 credits to get started.</p>
              </div>

              <button 
                onClick={completeOnboarding}
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors mt-auto disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Finalizing...</>
                ) : (
                  <>Go to Dashboard <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
