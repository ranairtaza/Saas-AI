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
  Activity,
  Target,
  Compass,
  CheckSquare,
  Layers,
  ShieldAlert,
  FileText,
  Workflow,
  Cpu,
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
      industry: 'Developer Tools / AI',
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

const OPERATING_LOOP_STEPS = [
  {
    step: '1',
    title: 'CONNECT',
    subtitle: 'Business Data',
    desc: 'Connect your business systems, CRM, Stripe, and customer telemetry into a single continuous stream.',
    badge: 'Step 01',
    tag: 'Stripe · HubSpot · Telemetry',
  },
  {
    step: '2',
    title: 'UNDERSTAND',
    subtitle: 'Ground Truth',
    desc: 'Synthesize raw signals into an unbiased, trustworthy picture of overall operational health and performance.',
    badge: 'Step 02',
    tag: 'Unified Health Metrics',
  },
  {
    step: '3',
    title: 'FORECAST',
    subtitle: 'Future Outcomes',
    desc: 'Identify mathematical trajectories, revenue pacing, and churn indicators before they impact your balance sheet.',
    badge: 'Step 03',
    tag: 'Statistical Projections',
  },
  {
    step: '4',
    title: 'PRIORITIZE',
    subtitle: 'Executive Attention',
    desc: 'Determine what genuinely demands executive attention, ranking anomalies and risks by concrete business impact.',
    badge: 'Step 04',
    tag: 'Attention Ranking',
  },
  {
    step: '5',
    title: 'PLAN',
    subtitle: 'Structured Actions',
    desc: 'Transform prioritized opportunities into concrete, accountable execution proposals with transparent rationale.',
    badge: 'Step 05',
    tag: 'Action Plan Staging',
  },
  {
    step: '6',
    title: 'APPROVE',
    subtitle: 'Owner Control',
    desc: 'You remain firmly in control. Review evidence, confidence scores, and risks before granting 1-click execution sign-off.',
    badge: 'Step 06',
    tag: 'Human Approval Gate',
  },
  {
    step: '7',
    title: 'EXECUTE',
    subtitle: 'Controlled Action',
    desc: 'Approved directives pass securely to integrated execution layers. Rejected proposals fail closed without execution.',
    badge: 'Step 07',
    tag: 'ActionEngine Delivery',
  },
];

const EXECUTIVE_TEAM_MODULES = [
  {
    title: 'Business Intelligence',
    role: 'Chief Intelligence',
    desc: 'Gain instant clarity on revenue trajectories, customer health, lead pipeline velocity, and operational performance from a single pane of glass.',
    icon: BarChart3,
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-500',
  },
  {
    title: 'Forecasting Engine',
    role: 'Chief Forecasting',
    desc: 'Predict upcoming performance with statistical moving average models. Spot seasonal dips and cash runway changes months in advance.',
    icon: TrendingUp,
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-500',
  },
  {
    title: 'Goal Management',
    role: 'Chief Performance',
    desc: 'Track strategic milestones with automated pacing telemetry. Immediately see whether quarterly targets are on track or lagging.',
    icon: Target,
    color: 'from-amber-500/20 to-orange-500/20 text-amber-500',
  },
  {
    title: 'Strategic Prioritization',
    role: 'Chief Strategy',
    desc: 'Eliminate operational noise. Rank opportunities, operational bottlenecks, and emerging business risks by estimated financial exposure.',
    icon: Compass,
    color: 'from-purple-500/20 to-violet-500/20 text-purple-500',
  },
  {
    title: 'Execution Planning',
    role: 'Chief Operations',
    desc: 'Turn strategic priorities into structured, step-by-step action plans with explicit success criteria and assigned execution deadlines.',
    icon: Workflow,
    color: 'from-pink-500/20 to-rose-500/20 text-rose-500',
  },
  {
    title: 'Lead Intelligence',
    role: 'Chief Pipeline',
    desc: 'Discover, enrich, and qualify prospective B2B clients matching your ideal customer profile with multi-source verification and tech-stack filters.',
    icon: Database,
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-500',
  },
  {
    title: 'Executive Decision Queue',
    role: 'Governance Gate',
    desc: 'Centralize every critical proposal in one executive approval hub. Review explainable evidence, confidence scores, and approve with 1 click.',
    icon: CheckSquare,
    color: 'from-violet-500/20 to-indigo-500/20 text-violet-500',
  },
];

const OUTCOME_FEATURES = [
  {
    title: 'Understand Your Business',
    category: 'Unified Telemetry',
    desc: 'Consolidate disparate billing, sales, and operational data into one cohesive ground-truth dashboard. Never guess your true MRR or pipeline velocity again.',
    icon: Activity,
  },
  {
    title: "See What's Coming",
    category: 'Predictive Trends',
    desc: 'Deterministic Weighted Moving Average forecasting with mathematical zero-denominator protection provides realistic projections with confidence intervals.',
    icon: TrendingUp,
  },
  {
    title: 'Stay on Target',
    category: 'Goal Pacing',
    desc: 'Real-time pacing monitors calculate whether your current trajectory hits revenue and acquisition milestones, providing early warnings for off-track goals.',
    icon: Target,
  },
  {
    title: 'Know What Matters',
    category: 'Attention Filtering',
    desc: 'Deterministic ranking algorithms prioritize operational anomalies and risks by business impact, keeping your focus strictly on high-leverage issues.',
    icon: ShieldAlert,
  },
  {
    title: 'Decide With Confidence',
    category: 'Decision Intelligence',
    desc: 'Every recommendation is backed by auditable evidence and clear confidence ratings. No black-box guesses or opaque automated decisions.',
    icon: CheckSquare,
  },
  {
    title: 'Execute With Control',
    category: 'Human-in-the-Loop',
    desc: 'High-leverage proposals require owner authorization. Approved actions execute cleanly; rejected actions fail closed with complete audit logging.',
    icon: ShieldCheck,
  },
  {
    title: 'Grow Your Pipeline',
    category: 'Lead Discovery & Qualification',
    desc: 'Direct integration with verified prospect databases and cascading verification ensures clean emails, verified contacts, and strong ICP alignment.',
    icon: Users,
  },
];

const FAQS = [
  {
    q: 'What makes LeadMachine an AI Executive Operating System rather than a simple CRM or lead scraper?',
    a: 'Traditional tools only handle isolated tasks like scraping contacts or sending bulk emails. LeadMachine acts as a comprehensive operating system for the business owner: it unifies your live business telemetry (revenue, customer churn, pipeline velocity), generates statistical forecasts, identifies strategic risks, and stages actionable proposals in an Executive Decision Queue for your review and approval.',
  },
  {
    q: 'How does human-in-the-loop governance protect my business?',
    a: 'We believe AI recommends and humans decide. LeadMachine will never autonomously send outreach blitzes, adjust budgets, or execute business-altering mutations without your explicit authorization. Every staged proposal shows transparent rationale, estimated financial exposure, and confidence scores so you make informed decisions.',
  },
  {
    q: 'Can I use LeadMachine effectively from my smartphone?',
    a: 'Yes. The Executive Command Center is designed mobile-first. Business owners can open the web app on their phone, review high-priority attention items, check key telemetry, and approve or reject pending decisions with one tap in seconds.',
  },
  {
    q: 'Are the metrics and forecasts in the product real or fabricated?',
    a: 'We never fabricate metrics. All business health metrics, goals, and forecasts in the authenticated platform are computed from your connected data sources. If data is unavailable or telemetry is insufficient, the system explicitly displays "Unknown" or "Unavailable" rather than generating misleading zeroes or fake charts.',
  },
  {
    q: 'How does the 7-day free trial work?',
    a: 'You get full access to the Executive Operating System and 100 verified lead discovery credits for 7 days with zero setup fees. You can cancel anytime directly inside your billing settings before the trial ends.',
  },
  {
    q: 'What business systems can I connect with LeadMachine?',
    a: 'LeadMachine natively connects with Stripe, HubSpot, Salesforce, custom CSV imports, and enterprise data providers. Real-time webhooks keep your deal stages and operational metrics synchronized.',
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'default' | 'saas' | 'fintech'>('default');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

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
    }, 400);
  };

  const currentLeads = SAMPLE_LEADS[activeCategory] || SAMPLE_LEADS.default;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-x-hidden scroll-smooth">
      {/* Ambient background glows */}
      <div className="absolute top-[-8%] left-[-10%] w-[45%] h-[45%] rounded-full bg-primary/15 blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/15 blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] left-[15%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[160px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50 transition-all">
        <div className="container mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white font-black text-2xl leading-none">L</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight leading-tight">LeadMachine</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Executive OS</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#executive-team" className="hover:text-foreground transition-colors">Executive Team</a>
            <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
            <a href="#governance" className="hover:text-foreground transition-colors">Trust & Governance</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#resources" className="hover:text-foreground transition-colors">FAQs</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-semibold hover:text-primary transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-28 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-7 animate-in slide-in-from-bottom-6 duration-700">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase border border-primary/20 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            LeadMachine — The AI Operating System for Business Owners
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-foreground">
            Know what is happening. <br />
            Know what matters. <br />
            <span className="text-gradient">Approve what happens next.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Turn your business data into clear decisions, strategic priorities, and controlled actions — from anywhere. An owner should never need to check five different tools just to understand what needs attention.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Start Running Your Business Smarter <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 border border-border bg-card/80 hover:bg-muted text-foreground text-base font-semibold rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              See How It Works
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 max-w-2xl mx-auto text-xs sm:text-sm font-medium text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>AI Recommends. You Decide.</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>Evidence-Backed Rationale</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>7-Day Free Trial · No Lock-In</span>
            </div>
          </div>
        </div>

        {/* Conceptual Loop Banner Preview */}
        <div className="mt-16 max-w-5xl mx-auto rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Continuous Executive Operating Cycle
              </span>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary w-fit">
              Deterministic Governance · Human in the Loop
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
            {[
              { label: '1. Business Data', color: 'text-foreground' },
              { label: '2. Ground Truth', color: 'text-foreground' },
              { label: '3. Forecast', color: 'text-foreground' },
              { label: '4. Goals', color: 'text-foreground' },
              { label: '5. Strategy', color: 'text-foreground' },
              { label: '6. Execution Plan', color: 'text-foreground' },
              { label: '7. Human Approval', color: 'text-primary font-bold' },
              { label: '8. Controlled Action', color: 'text-emerald-500 font-bold' },
            ].map((node, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex flex-col items-center justify-center">
                <span className={`text-[11px] ${node.color}`}>{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: The 7-Step Simple Loop */}
      <section id="how-it-works" className="py-24 border-t border-border/50 bg-muted/20 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              The Simple Operating Loop
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              How The Executive OS Operates
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              A transparent, closed-loop cycle turning raw business telemetry into prioritized decisions and controlled actions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OPERATING_LOOP_STEPS.slice(0, 4).map((item) => (
              <div key={item.step} className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm hover:shadow-md transition-all space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-mono">
                    {item.badge}
                  </span>
                  <span className="text-xl font-black text-muted-foreground/40 group-hover:text-primary transition-colors">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                  <span className="text-xs font-semibold text-primary">{item.subtitle}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
                <div className="pt-2 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                  {item.tag}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 max-w-5xl mx-auto">
            {OPERATING_LOOP_STEPS.slice(4).map((item) => (
              <div key={item.step} className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm hover:shadow-md transition-all space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-mono">
                    {item.badge}
                  </span>
                  <span className="text-xl font-black text-muted-foreground/40 group-hover:text-primary transition-colors">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                  <span className="text-xs font-semibold text-primary">{item.subtitle}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
                <div className="pt-2 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                  {item.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Your AI Executive Team */}
      <section id="executive-team" className="py-24 border-t border-border/50 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Integrated Intelligence Suite
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Your AI Executive Team
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Not autonomous replacements for human staff, but specialized operating intelligence modules that synthesize signals, forecast trends, and stage governed decisions for the owner.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {EXECUTIVE_TEAM_MODULES.map((mod, idx) => {
              const IconComp = mod.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mod.color} flex items-center justify-center shadow-sm`}>
                    <IconComp className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary font-mono">
                      {mod.role}
                    </span>
                    <h3 className="text-xl font-bold text-foreground mt-0.5">{mod.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 10: Features Organized Around Business Outcomes */}
      <section id="features" className="py-24 border-t border-border/50 bg-muted/20 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Proven Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Engineered for Business Outcomes
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Designed to eliminate guesswork, detect vulnerabilities early, and keep business owners in total control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {OUTCOME_FEATURES.map((feat, idx) => {
              const IconComp = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-3xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-xl transition-all duration-300 space-y-4 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <IconComp className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
                      {feat.category}
                    </span>
                    <h3 className="text-xl font-bold mt-1">{feat.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Interactive Pipeline Intelligence Demonstration */}
          <div className="mt-16 rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Live Pipeline Intelligence</span>
                <h3 className="text-2xl font-bold mt-1">Lead Discovery & ICP Verification</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Experience how verified B2B prospect intelligence feeds directly into your Executive Operating System.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit">
                {currentLeads.length} Verified Demonstrations
              </span>
            </div>

            {/* Interactive Search Box */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by ICP, industry, or tech stack (e.g. 'B2B SaaS', 'Fintech')..."
                  className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary placeholder:text-muted-foreground/70"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/25 disabled:opacity-70 min-h-[44px]"
              >
                {isSearching ? 'Filtering...' : 'Search ICP'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {currentLeads.map((lead, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-card/90 border border-border/60 hover:border-primary/40 transition-all duration-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm ${lead.color}`}>
                        {lead.initials}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{lead.name}</h4>
                        <p className="text-xs text-muted-foreground">{lead.industry}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {lead.score}% ICP
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground space-y-1">
                    <div className="truncate flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-primary flex-shrink-0" />
                      <span>{lead.employees} employees · {lead.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 11: Trust & Governance */}
      <section id="governance" className="py-24 border-t border-border/50 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto rounded-3xl border border-violet-500/30 bg-gradient-to-br from-card via-card to-violet-950/10 p-8 sm:p-12 shadow-2xl space-y-8">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                Guaranteed Control & Safety
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                AI Recommends. You Decide.
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
                LeadMachine is strictly governed. We reject runaway automation in favor of high-fidelity intelligence with absolute human authority.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
                <div className="flex items-center gap-2.5 text-foreground font-bold">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <span>Auditable Evidence & Confidence</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Every proposed recommendation includes grounded telemetry evidence, clear rationale, and calculated confidence scores.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
                <div className="flex items-center gap-2.5 text-foreground font-bold">
                  <Lock className="h-5 w-5 text-violet-500" />
                  <span>Fail-Closed Human Approval Gate</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Actions remain in WAITING status until explicitly authorized by an executive. Rejected proposals fail closed without execution.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
                <div className="flex items-center gap-2.5 text-foreground font-bold">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <span>Financial Exposure Checks</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Proposals evaluate financial risk and budget exposure before staging, preventing unplanned capital expenditure or runaway outreach.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
                <div className="flex items-center gap-2.5 text-foreground font-bold">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span>Immutable Audit Logs</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Every proposal approval, deferral, and rejection is permanently recorded for enterprise governance and compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 12: Pricing Page */}
      <section id="pricing" className="py-24 border-t border-border/50 bg-muted/10 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Predictable Executive Investment
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Plans Built for Business Operating Capability
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Choose the tier suited to your operating complexity. All plans include the core Executive Operating System.
            </p>

            {/* Billing Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-14 h-8 rounded-full bg-muted border border-border p-1 relative transition-colors focus:outline-none min-h-[44px] flex items-center"
                aria-label="Toggle Annual Billing"
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
            {/* Free Trial */}
            <div className="p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Free Trial</h3>
                <p className="text-sm text-muted-foreground">Test the Executive Operating System with full feature access for 7 days.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">$0</span>
                  <span className="text-muted-foreground text-sm"> / 7 days</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Executive Command Center</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Attention & Decision Queue</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>100 Verified Lead Discovery Credits</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Mobile Executive Home Access</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl border border-border hover:bg-muted font-semibold text-sm text-center transition-colors block min-h-[44px] flex items-center justify-center"
              >
                Start Free 7-Day Trial
              </Link>
            </div>

            {/* Professional Plan (Highlighted) */}
            <div className="p-8 rounded-3xl bg-card border-2 border-primary shadow-2xl shadow-primary/15 relative flex flex-col justify-between space-y-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                Most Popular
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Professional</h3>
                <p className="text-sm text-muted-foreground">For business owners who want complete visibility and AI-assisted decisions.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">
                    ${billingCycle === 'annual' ? '39' : '49'}
                  </span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">Executive Command & Decision Queue</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Predictive BI & ARR Trend Forecasting</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>2,500 Verified Lead Credits / Month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Goal Pacing & Strategic Prioritization</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Up to 5 Team Seats</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm text-center transition-all shadow-md shadow-primary/25 block min-h-[44px] flex items-center justify-center"
              >
                Get Started with Pro
              </Link>
            </div>

            {/* Business Plan */}
            <div className="p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Business</h3>
                <p className="text-sm text-muted-foreground">For growing companies needing deeper intelligence, strategy, and governed execution.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">
                    ${billingCycle === 'annual' ? '159' : '199'}
                  </span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border/60">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">Complete Executive OS & Multi-User Governance</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Custom Governance Policies & Rules</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>15,000 Verified Lead Credits / Month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>CRM & Stripe Bi-Directional Event Sync</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Priority Support & SLA</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl border border-border hover:bg-muted font-semibold text-sm text-center transition-colors block min-h-[44px] flex items-center justify-center"
              >
                Upgrade to Business
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Resources & FAQ Section */}
      <section id="resources" className="py-24 border-t border-border/50 relative">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              Executive FAQ
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Straightforward answers about executive governance, data telemetry, and owner control.
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
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg hover:text-primary transition-colors min-h-[44px]"
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
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-primary/95 to-secondary/95 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl shadow-primary/25">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Start Running Your Business Smarter Today
            </h2>
            <p className="text-white/85 text-base sm:text-lg max-w-xl mx-auto">
              Know what is happening. Know what matters. Approve what happens next. Try LeadMachine free for 7 days.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-primary hover:bg-white/95 font-bold text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 min-h-[44px] flex items-center justify-center"
              >
                Start Running Your Business Smarter
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-base transition-colors border border-white/25 min-h-[44px] flex items-center justify-center"
              >
                Sign In to Workspace
              </Link>
            </div>
            <p className="text-xs text-white/75">Instant setup · 7-day free trial · Cancel anytime · No credit card required to start</p>
          </div>
        </div>
      </section>

      {/* Enterprise Professional Footer */}
      <footer className="border-t border-border/70 bg-card/60 backdrop-blur-md pt-16 pb-12 text-sm text-muted-foreground">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-border/60">
            {/* Col 1: Brand & Status */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
                  <span className="text-white font-black text-xl leading-none">L</span>
                </div>
                <div>
                  <span className="font-extrabold text-lg text-foreground tracking-tight">LeadMachine</span>
                  <span className="block text-[10px] uppercase font-bold text-primary tracking-widest">Executive OS</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                The AI Operating System for business owners. Turning business telemetry into clear priorities, evidence-backed decisions, and governed execution.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold w-fit">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  All Systems 100% Operational
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <span>Official Inquiries:</span>
                  <a href="mailto:contact@leadmachine.io" className="font-medium text-foreground hover:text-primary transition-colors underline">
                    contact@leadmachine.io
                  </a>
                </div>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Executive OS</h4>
              <ul className="space-y-2.5 text-xs">
                <li><Link href="/executive" className="hover:text-foreground transition-colors">Executive Command Center</Link></li>
                <li><Link href="/executive#attention" className="hover:text-foreground transition-colors">Attention & Priority Ranking</Link></li>
                <li><Link href="/executive#decisions" className="hover:text-foreground transition-colors">Human Decision Queue</Link></li>
                <li><Link href="/executive#forecast" className="hover:text-foreground transition-colors">Predictive BI & Forecasting</Link></li>
                <li><Link href="/executive#goals" className="hover:text-foreground transition-colors">Strategic Goal Management</Link></li>
                <li><Link href="/leads" className="hover:text-foreground transition-colors">Lead Discovery & Pipeline</Link></li>
              </ul>
            </div>

            {/* Col 3: Integrations & API */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Integrations</h4>
              <ul className="space-y-2.5 text-xs">
                <li><Link href="/settings/providers" className="hover:text-foreground transition-colors">Stripe Billing</Link></li>
                <li><Link href="/settings/providers" className="hover:text-foreground transition-colors">HubSpot CRM</Link></li>
                <li><Link href="/settings/providers" className="hover:text-foreground transition-colors">Salesforce Connector</Link></li>
                <li><Link href="/settings/providers" className="hover:text-foreground transition-colors">Apollo Provider</Link></li>
                <li><Link href="/settings/providers" className="hover:text-foreground transition-colors">Inngest Workflows</Link></li>
                <li><Link href="/api/test-protected" className="hover:text-foreground transition-colors">REST API & Webhooks</Link></li>
              </ul>
            </div>

            {/* Col 4: Company & Contact */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Governance & Contact</h4>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#governance" className="hover:text-foreground transition-colors">Trust & Safety Model</a></li>
                <li><a href="#resources" className="hover:text-foreground transition-colors">Executive Knowledge Base</a></li>
                <li>
                  <a href="mailto:sales@leadmachine.io" className="hover:text-foreground transition-colors flex items-center gap-1">
                    Enterprise Inquiries <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a href="mailto:support@leadmachine.io" className="hover:text-foreground transition-colors flex items-center gap-1">
                    Executive Support <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li><span className="text-muted-foreground/80">SOC2 Type II Certified Standards</span></li>
                <li><span className="text-muted-foreground/80">GDPR & CCPA Compliant</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom sub-footer bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-muted-foreground">
              &copy; {new Date().getFullYear()} LeadMachine Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#resources" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#resources" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#governance" className="hover:text-foreground transition-colors">Security & Governance</a>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-muted-foreground/80 font-mono">Region: US-East (iad1)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
