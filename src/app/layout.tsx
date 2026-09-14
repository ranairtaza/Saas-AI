import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeadMachine — AI Executive Operating System for Business Owners",
  description: "Know what is happening. Know what matters. Approve what happens next. Turn your business data into clear decisions, priorities, and controlled actions — from anywhere.",
  openGraph: {
    title: "LeadMachine — The AI Operating System for Business Owners",
    description: "Know what is happening. Know what matters. Approve what happens next. Governed business intelligence, predictive forecasting, and executive decisions.",
    siteName: "LeadMachine",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadMachine — AI Executive Operating System",
    description: "Know what is happening. Know what matters. Approve what happens next.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
