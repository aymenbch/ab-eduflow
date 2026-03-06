import React, { useState } from "react";
import { Search, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function getWorkloadColor(count) {
  if (count < 8) return "bg-green-100 text-green-700 border-green-200";
  if (count < 16) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function getWorkloadDot(count) {
  if (count < 8) return "bg-green-400";
  if (count < 16) return "bg-amber-400";
  return "bg-red-400";
}

export default function TeacherColumn({ teachers, subjects, workload, draggedTeacher, onDragStart, onDragEnd }) {
  const [search, setSearch] = useState("");

  const filtered = teachers.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const getSubjectNames = (teacher) => {
    if (!teacher.subject_ids?.length) return "Aucune matière";
    return teacher.subject_ids
      .map(id => subjects.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
        <h3 className="font-semibold text-sm">👩‍🏫 Enseignants disponibles</h3>
        <p className="text-xs text-slate-300 mt-0.5">Glissez vers la grille</p>
      </div>

      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-50">
        {filtered.map(teacher => {
          const hours = workload[teacher.id] || 0;
          const isDragging = draggedTeacher?.id === teacher.id;

          return (
            <div
              key={teacher.id}
              draggable
              onDragStart={() => onDragStart(teacher)}
              onDragEnd={onDragEnd}
              className={`flex items-start gap-2 p-3 cursor-grab active:cursor-grabbing transition-all hover:bg-slate-50 ${
                isDragging ? "opacity-40 scale-95" : ""
              }`}
            >
              <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-800 truncate">
                    {teacher.first_name} {teacher.last_name}
                  </span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getWorkloadDot(hours)}`} />
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{getSubjectNames(teacher)}</p>
                <Badge className={`mt-1 text-xs px-1.5 py-0 border ${getWorkloadColor(hours)}`}>
                  {hours}h/sem
                </Badge>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-xs py-8">Aucun enseignant trouvé</p>
        )}
      </div>
    </div>
  );
}