"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  CreditCard, 
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Target,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  TrendingUp,
  BarChart,
  Briefcase,
  FileText,
  Bot,
  Activity
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditsWidget } from "@/components/credits-widget";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string | null; email: string; role?: string; onboarded: boolean; organization?: { name: string } } | null>(null);

  useEffect(() => {
    // Fetch user on mount
    fetch("/api/auth/me")
      .then(res => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then(data => {
        if (!data.user.onboarded) {
          router.push("/onboarding");
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="p-6 flex items-center justify-between md:justify-start gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl leading-none">L</span>
              </div>
              <span className="font-bold text-xl tracking-tight">LeadMachine</span>
            </div>
            <button 
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-6">
            
            {/* Primary Executive Section */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Primary
              </div>
              <NavItem href="/executive" icon={<LayoutDashboard size={18} />} active={pathname === "/executive"}>
                Executive Command
              </NavItem>
              <NavItem href="/executive#attention" icon={<AlertTriangle size={18} />} active={false}>
                Attention Required
              </NavItem>
              <NavItem href="/executive#actions" icon={<Lightbulb size={18} />} active={false}>
                Recommended Actions
              </NavItem>
              <NavItem href="/executive#decisions" icon={<CheckSquare size={18} />} active={false}>
                Decisions
              </NavItem>
              <NavItem href="/executive#forecast" icon={<TrendingUp size={18} />} active={false}>
                Forecast
              </NavItem>
              <NavItem href="/executive#outcomes" icon={<BarChart size={18} />} active={false}>
                Results / Outcomes
              </NavItem>
            </div>

            {/* Supporting Executive Section */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Supporting
              </div>
              <NavItem href="/executive#metrics" icon={<Briefcase size={18} />} active={false}>
                Business / Metrics
              </NavItem>
              <NavItem href="/executive#goals" icon={<Target size={18} />} active={false}>
                Goals
              </NavItem>
              <NavItem href="/executive#briefing" icon={<FileText size={18} />} active={false}>
                Executive Briefing
              </NavItem>
              <NavItem href="/executive#assistant" icon={<Bot size={18} />} active={false}>
                AI Assistant
              </NavItem>
            </div>

            {/* Existing CRM */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Existing CRM
              </div>
              <NavItem href="/leads" icon={<Users size={18} />} active={pathname === "/leads"}>Leads</NavItem>
              <NavItem href="/discover" icon={<Search size={18} />} active={pathname === "/discover"}>Discover</NavItem>
            </div>

            {/* Administration */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Administration
              </div>
              <NavItem href="/billing" icon={<CreditCard size={18} />} active={pathname === "/billing"}>Billing</NavItem>
              <NavItem href="/settings" icon={<Settings size={18} />} active={pathname.startsWith("/settings")}>Settings</NavItem>
              {(user.role === "OWNER" || user.role === "ADMIN") && (
                <NavItem href="/system" icon={<Activity size={18} />} active={pathname === "/system"}>
                  System Command Center
                </NavItem>
              )}
            </div>
            
          </nav>

          <div className="p-4 mt-auto border-t border-border">
            <CreditsWidget />
            
            <div className="flex items-center gap-3 px-2 py-3 mt-2">
              <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-foreground truncate">{user.name || 'Executive User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.organization?.name || 'Organization'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-background relative">
          {/* Top Header */}
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open Navigation Menu"
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-2 md:hidden">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  L
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm tracking-tight leading-none">LeadMachine</span>
                  <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Executive OS</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button 
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>

          {/* Page Content - with bottom padding on mobile for the fixed navigation bar */}
          <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-8 md:pt-6 pb-24 md:pb-8">
            {children}
          </div>

          {/* Mobile Executive Bottom Navigation Bar */}
          <nav 
            aria-label="Executive Quick Navigation" 
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border flex items-center justify-around h-16 px-1 safe-area-bottom shadow-lg"
          >
            <Link 
              href="/executive" 
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 transition-colors ${
                pathname === "/executive" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard size={18} />
              <span className="text-[10px] tracking-tight mt-1">Executive</span>
            </Link>

            <Link 
              href="/executive#attention" 
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <AlertTriangle size={18} />
              <span className="text-[10px] tracking-tight mt-1">Attention</span>
            </Link>

            <Link 
              href="/executive#decisions" 
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckSquare size={18} />
              <span className="text-[10px] tracking-tight mt-1">Decisions</span>
            </Link>

            <Link 
              href="/executive#metrics" 
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart size={18} />
              <span className="text-[10px] tracking-tight mt-1">Metrics</span>
            </Link>

            <Link 
              href="/leads" 
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 transition-colors ${
                pathname === "/leads" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={18} />
              <span className="text-[10px] tracking-tight mt-1">Leads</span>
            </Link>

            <button 
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="More navigation options"
            >
              <Menu size={18} />
              <span className="text-[10px] tracking-tight mt-1">More</span>
            </button>
          </nav>
        </main>
      </div>
    </ToastProvider>
  );
}

function NavItem({ href, icon, children, active }: { href: string, icon: React.ReactNode, children: React.ReactNode, active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${
        active 
          ? "bg-violet-600 text-white shadow-sm" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
