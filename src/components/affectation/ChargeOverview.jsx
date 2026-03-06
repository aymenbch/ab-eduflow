import React from "react";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

function WorkloadBar({ hours }) {
  const max = 24;
  const pct = Math.min((hours / max) * 100, 100);
  const color = hours < 8 ? "bg-green-400" : hours < 16 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ChargeOverview({ teachers, workload }) {
  const overloaded = teachers.filter(t => (workload[t.id] || 0) >= 16).length;
  const balanced = teachers.filter(t => { const h = workload[t.id] || 0; return h >= 8 && h < 16; }).length;
  const light = teachers.filter(t => (workload[t.id] || 0) < 8).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white border border-green-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-green-700">{light}</p>
          <p className="text-xs text-slate-500">Charge légère (&lt; 8h)</p>
        </div>
      </div>
      <div className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-amber-700">{balanced}</p>
          <p className="text-xs text-slate-500">Charge équilibrée (8-16h)</p>
        </div>
      </div>
      <div className="bg-white border border-red-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-red-700">{overloaded}</p>
          <p className="text-xs text-slate-500">En surcharge (&gt; 16h)</p>
        </div>
      </div>
    </div>
  );
}