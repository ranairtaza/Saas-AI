"use client";

import { useTheme } from "next-themes";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

const DATA = [
  { name: "Marketing Agencies", value: 35, color: "#7C3AED" },
  { name: "Web Development", value: 25, color: "#3B82F6" },
  { name: "E-commerce", value: 18, color: "#EC4899" },
  { name: "SaaS", value: 12, color: "#10B981" },
  { name: "Others", value: 10, color: "#F59E0B" },
];

export function TopIndustriesChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="h-64 w-full flex flex-col items-center justify-center">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#374151" : "#e5e7eb",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value: any) => [`${value}%`, 'Share']}
            />
            <Pie
              data={DATA}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend list matching design */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground pt-1">
        {DATA.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="font-semibold text-foreground">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
