import Link from "next/link";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none"></div>
      
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-white font-bold text-xl leading-none">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight">LeadMachine</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link href="#" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="#" className="hover:text-foreground transition-colors">How It Works</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Resources</Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login" className="hidden md:block text-sm font-medium hover:text-primary transition-colors">
            Login
          </Link>
          <Link href="/register" className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium transition-colors shadow-lg shadow-primary/25">
            Start Free Trial
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 relative z-10 py-12 lg:py-24">
        
        {/* Left Copy */}
        <div className="flex-1 max-w-2xl space-y-8 animate-in slide-in-from-bottom-8 duration-700 fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AI-Powered Lead Generation
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Find. Qualify. <br/>
            <span className="text-gradient">Close More Deals.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
            We find high-quality leads, enrich their data, and help you reach the right prospects so you can focus on closing.
          </p>
          
          <ul className="space-y-3 text-sm font-medium">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> 1000+ Data Sources</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> AI-Powered & Always Updating</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Verified Email & Phone</li>
          </ul>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link href="/register" className="w-full sm:w-auto flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-md text-base font-medium transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1">
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <button className="w-full sm:w-auto flex items-center justify-center px-8 py-4 rounded-md text-base font-medium transition-colors hover:bg-muted">
              See How It Works
            </button>
          </div>
          <p className="text-xs text-muted-foreground">No credit card required</p>
        </div>
        
        {/* Right Graphic Mockup */}
        <div className="flex-1 w-full max-w-xl relative animate-in slide-in-from-right-8 duration-700 fade-in delay-200">
          <div className="glass rounded-2xl p-6 shadow-2xl border border-white/20 dark:border-white/10 relative z-10 overflow-hidden">
             {/* Mock UI Elements */}
             <div className="absolute top-0 right-0 p-4">
                <div className="w-12 h-12 bg-primary rounded-full shadow-lg shadow-primary/40 flex items-center justify-center animate-bounce">
                  <Search className="text-white h-6 w-6" />
                </div>
             </div>
             
             <div className="space-y-4 pt-8">
                {/* Mock Card 1 */}
                <div className="bg-background rounded-xl p-4 shadow-sm border border-border flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                     <span className="text-orange-600 font-bold">M</span>
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold">Marketing Agency</p>
                     <p className="text-xs text-muted-foreground">New York, USA</p>
                   </div>
                   <div className="w-8 h-8 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center text-xs font-bold bg-green-50 dark:bg-green-500/10">
                     92
                   </div>
                </div>
                {/* Mock Card 2 */}
                <div className="bg-background rounded-xl p-4 shadow-sm border border-border flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                     <span className="text-blue-600 font-bold">W</span>
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold">Web Development Co.</p>
                     <p className="text-xs text-muted-foreground">Austin, USA</p>
                   </div>
                   <div className="w-8 h-8 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center text-xs font-bold bg-green-50 dark:bg-green-500/10">
                     88
                   </div>
                </div>
                {/* Mock Card 3 */}
                <div className="bg-background rounded-xl p-4 shadow-sm border border-border flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                     <span className="text-purple-600 font-bold">E</span>
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold">E-commerce Store</p>
                     <p className="text-xs text-muted-foreground">Los Angeles, USA</p>
                   </div>
                   <div className="w-8 h-8 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center text-xs font-bold bg-green-50 dark:bg-green-500/10">
                     96
                   </div>
                </div>
             </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] rounded-full z-0"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] rounded-full z-0"></div>
        </div>
      </main>
    </div>
  );
}
