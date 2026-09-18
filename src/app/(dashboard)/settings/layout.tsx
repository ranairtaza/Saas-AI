"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, Link as LinkIcon, Settings2 } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Profile", href: "/settings/profile", icon: <User size={18} /> },
    { name: "Organization", href: "/settings/organization", icon: <Building2 size={18} /> },
    { name: "Data Providers", href: "/settings/providers", icon: <LinkIcon size={18} /> },
    { name: "Preferences", href: "/settings/preferences", icon: <Settings2 size={18} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto w-full">
      {/* Settings Sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <h2 className="text-2xl font-bold tracking-tight mb-4 hidden md:block">Settings</h2>
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar border-b md:border-b-0 border-border">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal shrink-0 ${
                  isActive
                    ? "bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon}
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Settings Content */}
      <main className="flex-1 w-full min-w-0">
        {children}
      </main>
    </div>
  );
}
