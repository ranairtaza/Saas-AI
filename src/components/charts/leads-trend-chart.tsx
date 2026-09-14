"use client";

import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

export interface LeadsTrendChartProps {
  data: {
    date: string;
    leads: number;
  }[];
}

export function LeadsTrendChart({ data }: LeadsTrendChartProps) {
  const { theme } = useTheme();
  
  const isDark = theme === "dark";
  const color = isDark ? "#ffffff" : "#000000";
  const lineColor = "var(--color-primary, #3b82f6)";
  
  if (!data || data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-muted-foreground">
        No recent data to display.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            contentStyle={{ 
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              borderColor: isDark ? "#374151" : "#e5e7eb",
              borderRadius: "8px",
              color: color
            }}
            itemStyle={{ color: lineColor }}
          />
          <Area
            type="monotone"
            dataKey="leads"
            stroke={lineColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorLeads)"
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
