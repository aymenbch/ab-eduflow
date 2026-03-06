import React from "react";
import { Badge } from "@/components/ui/badge";

const SPECIFIC_NEED_BADGES = {
  dyslexie: { label: "Dyslexie", color: "bg-orange-100 text-orange-700 border-orange-300" },
  sport_elite: { label: "Sport élite", color: "bg-blue-100 text-blue-700 border-blue-300" },
  handicap: { label: "Handicap", color: "bg-purple-100 text-purple-700 border-purple-300" },
  interne: { label: "Interne", color: "bg-slate-100 text-slate-700 border-slate-300" },
  transport: { label: "Transport", color: "bg-teal-100 text-teal-700 border-teal-300" },
  haut_potentiel: { label: "HP", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  allophones: { label: "Allophone", color: "bg-pink-100 text-pink-700 border-pink-300" },
};

function getAcademicColor(avg) {
  if (avg === null || avg === undefined) return { dot: "bg-slate-300", ring: "ring-slate-200" };
  if (avg >= 14) return { dot: "bg-blue-500", ring: "ring-blue-200", label: "Bon niveau" };
  if (avg >= 10) return { dot: "bg-amber-400", ring: "ring-amber-200", label: "Moyen" };
  return { dot: "bg-red-400", ring: "ring-red-200", label: "Fragile" };
}

function getBehaviorIcon(score) {
  if (score === null || score === undefined) return "😐";
  if (score >= 4) return "😊";
  if (score >= 2) return "😐";
  return "😤";
}

export default function StudentCard({ student, draggable = false, onDragStart, onDragEnd, compact = false }) {
  const avg = student.average_grade ?? null;
  const behavior = student.behavior_score ?? null;
  const progression = student.progression_index ?? null;
  const academicColor = getAcademicColor(avg);
  const genderColor = student.gender === "M" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border rounded-xl p-2.5 select-none ${
        draggable ? "cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow" : ""
      } ring-2 ${academicColor.ring}`}
    >
      <div className="flex items-center gap-2">
        {/* Color dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${academicColor.dot}`} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {student.first_name} {student.last_name}
          </p>
          {!compact && student.student_code && (
            <p className="text-[10px] text-slate-400">{student.student_code}</p>
          )}
        </div>

        {/* Gender badge */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${genderColor}`}>
          {student.gender || "?"}
        </span>
      </div>

      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Average */}
          {avg !== null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${academicColor.dot === "bg-blue-500" ? "bg-blue-50 text-blue-700 border-blue-200" : avg >= 10 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              📊 {avg.toFixed(1)}/20
            </span>
          )}

          {/* Behavior */}
          {behavior !== null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
              {getBehaviorIcon(behavior)} {behavior}/5
            </span>
          )}

          {/* Progression */}
          {progression !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${progression > 0 ? "bg-green-50 text-green-700 border-green-200" : progression < 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
              {progression > 0 ? "↑" : progression < 0 ? "↓" : "→"} {progression > 0 ? "+" : ""}{progression}
            </span>
          )}
        </div>
      )}

      {/* Special need badges */}
      {!compact && student.specific_needs && student.specific_needs.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {student.specific_needs.map(need => {
            const cfg = SPECIFIC_NEED_BADGES[need] || { label: need, color: "bg-gray-100 text-gray-600 border-gray-300" };
            return (
              <span key={need} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
                {cfg.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}