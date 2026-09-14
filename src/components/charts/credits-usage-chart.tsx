"use client";

import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

export interface CreditsUsageChartProps {
  data: {
    date: string;
    credits: number;
  }[];
}

export function CreditsUsageChart({ data }: CreditsUsageChartProps) {
  const { theme } = useTheme();
  
  const isDark = theme === "dark";
  const color = isDark ? "#ffffff" : "#000000";
  const barColor = "var(--color-primary, #3b82f6)";
  
  if (!data || data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-muted-foreground">
        No credit usage to display.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#333" : "#e5e7eb"} />
          <XAxis 
            dataKey="date" 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: isDark ? "#888" : "#666", fontSize: 12 }} 
            dy={10} 
          />
          <YAxis 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: isDark ? "#888" : "#666", fontSize: 12 }} 
          />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
            contentStyle={{ 
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              borderColor: isDark ? "#374151" : "#e5e7eb",
              borderRadius: "8px",
              color: color
            }}
            itemStyle={{ color: barColor }}
          />
          <Bar
            dataKey="credits"
            fill={barColor}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
