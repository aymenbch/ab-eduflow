import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, trend, trendUp, color = "blue", subtitle }) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 shadow-blue-500/30",
    green: "from-emerald-500 to-emerald-600 shadow-emerald-500/30",
    purple: "from-purple-500 to-purple-600 shadow-purple-500/30",
    orange: "from-orange-500 to-orange-600 shadow-orange-500/30",
    pink: "from-pink-500 to-pink-600 shadow-pink-500/30",
    cyan: "from-cyan-500 to-cyan-600 shadow-cyan-500/30",
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trendUp ? "text-emerald-600" : "text-red-500"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
          colorClasses[color]
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}