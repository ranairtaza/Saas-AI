'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Search,
  Sparkles,
  Database,
  ShieldCheck,
  TrendingUp,
  Bot,
  Zap,
  ChevronDown,
  Building2,
  Mail,
  Phone,
  BarChart3,
  Sliders,
  Users,
  Lock,
  Globe2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface MockLead {
  name: string;
  industry: string;
  location: string;
  score: number;
  initials: string;
  color: string;
  email: string;
  phone: string;
  employees: string;
  tech: string[];
}

const SAMPLE_LEADS: Record<string, MockLead[]> = {
  default: [
    {
      name: 'Apex Growth Labs',
      industry: 'B2B SaaS / Analytics',
      location: 'San Francisco, CA',
      score: 96,
      initials: 'A',
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      email: 'alex.v@apexgrowth.io',
      phone: '+1 (415) 555-0192',
      employees: '45-100',
      tech: ['Next.js', 'Stripe', 'PostgreSQL'],
    },
    {
      name: 'Veritas Health AI',
      industry: 'HealthTech / MedTech',
      location: 'Boston, MA',
      score: 93,
      initials: 'V',
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      email: 'claire.m@veritashealth.ai',
      phone: '+1 (617) 555-0144',
      employees: '120-250',
      tech: ['Python', 'AWS', 'TensorFlow'],
    },
    {
      name: 'Kite Commerce Global',
      industry: 'E-commerce & Retail',
      location: 'Austin, TX',
      score: 89,
      initials: 'K',
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      email: 'devin.r@kitecommerce.com',
      phone: '+1 (512) 555-0187',
      employees: '30-50',
      tech: ['Shopify Plus', 'Klaviyo', 'Segment'],
    },
  ],
  saas: [
    {
      name: 'CloudSync Technologies',
      industry: 'Cloud Infrastructure SaaS',
      location: 'Seattle, WA',
      score: 98,
      initials: 'C',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      email: 'sarah.k@cloudsync.tech',
      phone: '+1 (206) 555-0118',
      employees: '80-150',
      tech: ['Kubernetes', 'Go', 'GCP'],
    },
    {
      name: 'PromptScale AI',
      industry: 'Generative AI Developer Tools',
      location: 'San Francisco, CA',
      score: 94,
      initials: 'P',
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      email: 'marcus.l@promptscale.dev',
      phone: '+1 (415) 555-0831',
      employees: '25-40',
      tech: ['Next.js', 'PyTorch', 'OpenAI'],
    },
  ],
  fintech: [
    {
      name: 'LedgerFlow Payments',
      industry: 'FinTech / Treasury API',
      location: 'New York, NY',
      score: 97,
      initials: 'L',
      color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      email: 'jordan.t@ledgerflow.co',
      phone: '+1 (212) 555-0371',
      employees: '60-120',
      tech: ['Stripe', 'Node.js', 'Snowflake'],
    },
    {
      name: 'Aegis Capital OS',
      industry: 'WealthTech & Compliance',
      location: 'Chicago, IL',
      score: 91,
      initials: 'A',
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      email: 'elena.s@aegiscapital.io',
      phone: '+1 (312) 555-0994',
      employees: '40-80',
      tech: ['PostgreSQL', 'Python', 'Redis'],
    },
  ],
};

const FAQS = [
  {
    q: 'How does LeadMachine discover and verify prospect data?',
    a: 'LeadMachine connects to cascading, verified enterprise B2B data providers (including Apollo, proprietary real-time web crawlers, and DNS/tech detectors). Every email address undergoes multi-step SMTP handshakes, MX record validation, and bounce-rate checks so your deliverability stays above 98%.',
  },
  {
    q: 'What is the Autonomous Executive Operating System?',
    a: 'Beyond basic lead scraping, LeadMachine synthesizes high-level business telemetry (revenue, customer churn, pipeline velocity) with operational lead actions. It uses deterministic forecasting algorithms and human-gated decision queues so you get executive clarity without runaway AI actions.',
  },
  {
    q: 'Can I connect LeadMachine to my existing CRM and billing systems?',
    a: 'Yes! We support native integrations with Stripe, HubSpot, Salesforce, and custom CSV imports. Real-time webhooks keep your deal stages and customer health scores perfectly synchronized.',
  },
  {
    q: 'How does human-in-the-loop governance work?',
    a: 'All high-risk autonomous proposals (such as outbound email blitzes, budget allocations, or status changes) are submitted to your Decision Queue. You review the explainable evidence, confidence scores, and predicted ROI before granting 1-click execution approval.',
  },
  {
    q: 'Can I upgrade, downgrade, or cancel anytime?',
    a: 'Absolutely. You can change or cancel your subscription at any time directly through the integrated Stripe Customer Portal in your billing settings. No long-term lock-in.',
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'default' | 'saas' | 'fintech'>('default');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [activeTab, setActiveTab] = useState<'discover' | 'enrich' | 'executive'>('discover');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      const q = searchQuery.toLowerCase();
      if (q.includes('saas') || q.includes('cloud') || q.includes('ai')) {
        setActiveCategory('saas');
      } else if (q.includes('fintech') || q.includes('bank') || q.includes('payment') || q.includes('finance')) {
        setActiveCategory('fintech');
      } else {
        setActiveCategory('default');
      }
      setIsSearching(false);
    }, 450);
  };

  const currentLeads = SAMPLE_LEADS[activeCategory] || SAMPLE_LEADS.default;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden scroll-smooth">
      {/* Dynamic ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-primary/20 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-[35%] right-[-12%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50 transition-all">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white font-black text-2xl leading-none">L</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight leading-tight">LeadMachine</span>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Executive OS</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#resources" className="hover:text-foreground transition-colors">Resources</a>
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-semibold hover:text-primary transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Value Prop & Interactive Search */}
          <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase border border-primary/20 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" style={{ animationDuration: '3s' }} />
              Autonomous B2B Pipeline & Executive Intelligence
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]">
              Target High-Value Leads. <br />
              <span className="text-gradient">Automate the Close.</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              LeadMachine unifies multi-source prospect discovery, AI firmographic enrichment, and deterministic executive decision intelligence so your revenue team closes faster.
            </p>

            {/* Live Interactive Search Box */}
            <div className="bg-card border border-border/80 rounded-2xl p-2.5 shadow-xl shadow-black/5 dark:shadow-black/20">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by industry, ICP, or tech stack (e.g. 'Fintech', 'B2B SaaS')..."
                    className="w-full pl-11 pr-4 py-3 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/70"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/25 disabled:opacity-70"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Find Leads
                    </>
                  )}
                </button>
              </form>

              {/* Quick tags */}
              <div className="flex items-center gap-2 pt-2.5 px-2 overflow-x-auto text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80 flex-shrink-0">Popular:</span>
                <button
                  type="button"
                  onClick={() => { setSearchQuery('B2B SaaS'); setActiveCategory('saas'); }}
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors flex-shrink-0"
                >
                  B2B SaaS
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchQuery('Fintech & Banking'); setActiveCategory('fintech'); }}
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors flex-shrink-0"
                >
                  FinTech
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchQuery('HealthTech'); setActiveCategory('default'); }}
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors flex-shrink-0"
                >
                  HealthTech
                </button>
              </div>
            </div>

            {/* Micro Benefits list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>99.8% Email Accuracy</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>Executive Decision Queue</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>No Credit Card Required</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Lead Result Preview */}
          <div className="lg:col-span-5 relative animate-in slide-in-from-right-6 duration-700 delay-150">
            <div className="glass rounded-3xl p-6 shadow-2xl border border-border/80 relative z-10 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Live Verified Pipeline
                  </span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {currentLeads.length} Matches Found
                </span>
              </div>

              {/* Lead Cards List */}
              <div className="space-y-3.5 pt-4">
                {currentLeads.map((lead, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-card/90 border border-border/60 hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-base flex-shrink-0 ${lead.color}`}
                        >
                          {lead.initials}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {lead.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">{lead.industry} • {lead.location}</p>
                        </div>
                      </div>

                      {/* ICP Match score */}
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <span>{lead.score}%</span>
                          <span className="text-[10px] font-medium uppercase">ICP</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      {lead.tech.map((t, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-muted font-medium text-foreground/80">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Callout Footer */}
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Enrich contacts with 1-click</span>
                <Link
                  href="/register"
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Claim Leads <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 border-t border-border/50 bg-muted/20 relative">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Complete Revenue OS
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Engineered for Autonomous Growth
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Everything you need to turn raw internet data into qualified sales meetings and executive certainty.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Multi-Provider Enrichment</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connects across Apollo, LinkedIn scraper adapters, tech stack detectors, and direct DNS queries to deliver 99.8% verified emails, phone numbers, and buying authority.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Autonomous Decision Queue</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                High-leverage proposals are staged with explicit rationale, expected ROI, and risk classification. You maintain total human control with 1-click execution approvals.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Predictive BI & Forecasting</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Deterministic Weighted Moving Average (WMA) statistical forecasting models for ARR, MRR, customer growth, and churn with mathematical zero-denominator protection.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Fail-Closed Governance</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Robust role-based access control (RBAC), database write safety gates, and immutable audit logs that guarantee your enterprise data boundaries are never compromised.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Context-Aware Outreach</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Generates personalized email drafts tailored to each prospect’s role and tech stack. Outreach automatically flags as stale when prospect context mutates.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                <Globe2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Bi-Directional CRM Sync</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Keep HubSpot, Salesforce, and Stripe in sync with background event workers powered by Inngest. No more manual data entry or dropped pipeline opportunities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 border-t border-border/50 relative">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Simple 3-Step Flow
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              How LeadMachine Works
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Turn your ideal customer profile into revenue in three transparent phases.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative p-8 rounded-3xl bg-card border border-border/80 space-y-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black text-lg">
                1
              </div>
              <h3 className="text-2xl font-bold">Define & Discover</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Set your ICP filters: target industries, employee count, location, and tech stack. LeadMachine queries thousands of live web signals to curate prime prospects.
              </p>
              <div className="p-4 rounded-xl bg-muted/60 border border-border/50 text-xs font-mono text-muted-foreground">
                Target: B2B SaaS • $1M-$10M ARR • Stripe + Next.js
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-8 rounded-3xl bg-card border border-border/80 space-y-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary text-white font-black text-lg">
                2
              </div>
              <h3 className="text-2xl font-bold">Enrich & Qualify</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Cascading verification validates direct email addresses, decision-maker titles, and phone numbers while our scoring engine assigns an ICP fit grade.
              </p>
              <div className="p-4 rounded-xl bg-muted/60 border border-border/50 text-xs font-mono text-muted-foreground">
                Score: 96% Match • Verified Contact • High Intent
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-8 rounded-3xl bg-card border border-border/80 space-y-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white font-black text-lg">
                3
              </div>
              <h3 className="text-2xl font-bold">Approve & Close</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Review proposed outreach sequences in your executive decision queue. Approve with 1-click and watch live replies appear in your dashboard.
              </p>
              <div className="p-4 rounded-xl bg-muted/60 border border-border/50 text-xs font-mono text-muted-foreground">
                Queue Status: APPROVED • Outreach Scheduled
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 border-t border-border/50 bg-muted/10 relative">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Simple, Predictable Pricing
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Invest in Continuous Pipeline
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Scale with transparent tiers. No hidden setup fees or long-term contracts.
            </p>

            {/* Billing Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-14 h-8 rounded-full bg-muted border border-border p-1 relative transition-colors focus:outline-none"
              >
                <div
                  className={`w-6 h-6 rounded-full bg-primary transition-transform ${
                    billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Annual
                <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter / Trial Plan */}
            <div className="p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Free Trial</h3>
                <p className="text-sm text-muted-foreground">Test LeadMachine with full feature access for 14 days.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">$0</span>
                  <span className="text-muted-foreground text-sm"> / 14 days</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>100 Verified Lead Credits</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Basic AI Lead Qualification</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>1 Team Member Seat</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>CSV Export</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl border border-border hover:bg-muted font-semibold text-sm text-center transition-colors block"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro Plan (Highlighted) */}
            <div className="p-8 rounded-3xl bg-card border-2 border-primary shadow-2xl shadow-primary/15 relative flex flex-col justify-between space-y-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                Most Popular
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Professional</h3>
                <p className="text-sm text-muted-foreground">Ideal for growing SaaS sales teams and revenue leaders.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">
                    ${billingCycle === 'annual' ? '39' : '49'}
                  </span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">2,500 Lead Credits / Month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Autonomous Executive Decision Queue</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Predictive BI & ARR Forecasting</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Bi-Directional CRM Sync (HubSpot / Stripe)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Up to 5 Team Seats</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm text-center transition-all shadow-md shadow-primary/25 block"
              >
                Get Started with Pro
              </Link>
            </div>

            {/* Business Plan */}
            <div className="p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Business</h3>
                <p className="text-sm text-muted-foreground">For scaling sales organizations that need maximum capacity.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">
                    ${billingCycle === 'annual' ? '159' : '199'}
                  </span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">15,000 Lead Credits / Month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Custom Governance Policies & Rules</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Dedicated Inngest Event Processing</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Unlimited Team Seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Priority Support & SLA</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl border border-border hover:bg-muted font-semibold text-sm text-center transition-colors block"
              >
                Upgrade to Business
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Resources & FAQ Section */}
      <section id="resources" className="py-24 border-t border-border/50 relative">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Knowledge & FAQs
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Have questions about data privacy, AI governance, or integrations? We have answers.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/80 bg-card/80 overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-primary' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm sm:text-base text-muted-foreground leading-relaxed animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-20 border-t border-border/50 bg-gradient-to-b from-transparent to-primary/5 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-primary/90 to-secondary/90 text-white p-10 sm:p-16 text-center space-y-6 shadow-2xl shadow-primary/20">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Ready to Accelerate Your Sales Pipeline?
            </h2>
            <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto">
              Join forward-thinking B2B companies discovering verified leads and automating executive decisions with LeadMachine today.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-primary hover:bg-white/95 font-bold text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Start Free 14-Day Trial
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-base transition-colors border border-white/20"
              >
                Sign In to Workspace
              </Link>
            </div>
            <p className="text-xs text-white/70">Instant setup • Cancel anytime • 100 free lead credits</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/90 py-12 text-sm text-muted-foreground">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-black text-sm">L</span>
            </div>
            <span className="font-bold text-foreground">LeadMachine OS</span>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#resources" className="hover:text-foreground transition-colors">Resources</a>
            <Link href="/login" className="hover:text-foreground transition-colors">Login</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} LeadMachine. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
