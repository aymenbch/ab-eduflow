import React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function getCycleForTeacher(teacher) {
  // Infer cycle from qualification or rely on subject_ids (simplified logic)
  return null; // No strict restriction for now; handled by subject_ids
}

export default function AssignmentGrid({
  subjects,
  levels,
  teachers,
  assignments,
  draggedTeacher,
  dragOverCell,
  onDragOverCell,
  onDrop,
  onRemove,
}) {
  const getTeacherById = (id) => teachers.find(t => t.id === id);

  const isCompatible = (teacher, subjectId) => {
    if (!teacher) return false;
    // If teacher has no subject_ids set, allow (open assignment)
    if (!teacher.subject_ids?.length) return true;
    return teacher.subject_ids.includes(subjectId);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <h3 className="font-semibold text-sm">📋 Grille d'affectation — Matières × Niveaux</h3>
        <p className="text-xs text-blue-200 mt-0.5">Déposez un enseignant dans la cellule correspondante</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 w-40">
                Matière
              </th>
              {levels.map(lvl => (
                <th
                  key={lvl.id}
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-l border-slate-200"
                >
                  <span className={`inline-block px-2 py-1 rounded-lg border text-xs font-bold ${lvl.color}`}>
                    {lvl.label}
                  </span>
                  <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                    {lvl.cycles.map(c => (
                      <span key={c} className="text-[10px] text-slate-400">{c}</span>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map(subject => (
              <tr key={subject.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Subject cell */}
                <td className="px-4 py-3 border-r border-slate-100">
                  <div className="flex items-center gap-2">
                    {subject.color && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subject.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{subject.name}</p>
                      <p className="text-xs text-slate-400">{subject.code}</p>
                    </div>
                  </div>
                </td>

                {/* Level cells */}
                {levels.map(lvl => {
                  const key = `${subject.id}|${lvl.id}`;
                  const assigned = assignments[key] || [];
                  const isOver = dragOverCell === key;
                  const compatible = draggedTeacher ? isCompatible(draggedTeacher, subject.id) : null;

                  return (
                    <td
                      key={lvl.id}
                      className={`px-2 py-2 border-l border-slate-100 align-top min-w-[140px] transition-all ${
                        isOver
                          ? compatible === false
                            ? "bg-red-50 border-2 border-dashed border-red-400"
                            : "bg-blue-50 border-2 border-dashed border-blue-400"
                          : draggedTeacher
                          ? "bg-slate-50/80"
                          : ""
                      }`}
                      onDragOver={e => { e.preventDefault(); onDragOverCell(key); }}
                      onDragLeave={() => onDragOverCell(null)}
                      onDrop={e => {
                        e.preventDefault();
                        if (draggedTeacher && compatible !== false) {
                          onDrop(subject.id, lvl.id, draggedTeacher);
                        }
                      }}
                    >
                      <div className="space-y-1 min-h-[40px]">
                        {assigned.map(tid => {
                          const teacher = getTeacherById(tid);
                          if (!teacher) return null;
                          return (
                            <div
                              key={tid}
                              className="flex items-center justify-between gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 group"
                            >
                              <span className="text-xs text-blue-800 font-medium truncate max-w-[90px]">
                                {teacher.first_name} {teacher.last_name}
                              </span>
                              <button
                                onClick={() => onRemove(subject.id, lvl.id, tid)}
                                className="text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}

                        {isOver && draggedTeacher && (
                          <div className={`text-xs rounded-lg px-2 py-1 border border-dashed text-center ${
                            compatible === false
                              ? "bg-red-100 border-red-400 text-red-600"
                              : "bg-blue-100 border-blue-400 text-blue-600"
                          }`}>
                            {compatible === false ? "❌ Incompatible" : "✚ Déposer ici"}
                          </div>
                        )}

                        {assigned.length === 0 && !isOver && (
                          <div className="text-center text-slate-300 text-xs py-1">—</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={levels.length + 1} className="text-center py-12 text-slate-400 text-sm">
                  Aucune matière configurée. Ajoutez des matières d'abord.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}