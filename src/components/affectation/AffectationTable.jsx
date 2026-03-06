import React, { useState } from "react";
import { X } from "lucide-react";

function isCompatible(teacher, subjectId) {
  if (!teacher) return false;
  if (!teacher.subject_ids?.length) return true;
  return teacher.subject_ids.includes(subjectId);
}

export default function AffectationTable({
  tableData,
  subjects,
  teachers,
  assignments,
  draggedTeacher,
  onDrop,
  onRemove,
}) {
  const [dragOverCell, setDragOverCell] = useState(null);

  const getTeacherById = (id) => teachers.find(t => t.id === id);

  const columns = Object.entries(tableData).map(([type, levelsObj]) => ({
    type,
    levels: Object.entries(levelsObj).map(([level, classes]) => ({ level, classes })),
  }));

  const allClasses = columns.flatMap(t => t.levels.flatMap(l => l.classes));

  const typeColors = {
    "École": "bg-green-600",
    "Collège": "bg-blue-600",
    "Lycée": "bg-purple-600",
    "Autre": "bg-slate-600",
  };

  const levelColors = {
    "École": "bg-green-50 text-green-800",
    "Collège": "bg-blue-50 text-blue-800",
    "Lycée": "bg-purple-50 text-purple-800",
    "Autre": "bg-slate-50 text-slate-800",
  };

  // Color palette per level name
  const levelPalette = {
    "CP":        { header: "bg-emerald-100 text-emerald-800", cell: "bg-emerald-50/40" },
    "CE1":       { header: "bg-green-100 text-green-800",     cell: "bg-green-50/40" },
    "CE2":       { header: "bg-teal-100 text-teal-800",       cell: "bg-teal-50/40" },
    "CM1":       { header: "bg-lime-100 text-lime-800",       cell: "bg-lime-50/40" },
    "CM2":       { header: "bg-cyan-100 text-cyan-800",       cell: "bg-cyan-50/40" },
    "6ème":      { header: "bg-blue-100 text-blue-800",       cell: "bg-blue-50/40" },
    "5ème":      { header: "bg-sky-100 text-sky-800",         cell: "bg-sky-50/40" },
    "4ème":      { header: "bg-indigo-100 text-indigo-800",   cell: "bg-indigo-50/40" },
    "3ème":      { header: "bg-violet-100 text-violet-800",   cell: "bg-violet-50/40" },
    "2nde":      { header: "bg-purple-100 text-purple-800",   cell: "bg-purple-50/40" },
    "1ère":      { header: "bg-fuchsia-100 text-fuchsia-800", cell: "bg-fuchsia-50/40" },
    "Terminale": { header: "bg-rose-100 text-rose-800",       cell: "bg-rose-50/40" },
  };

  // Color palette cycling for individual classes within a level
  const classPaletteColors = [
    "bg-blue-100 text-blue-900",
    "bg-indigo-100 text-indigo-900",
    "bg-violet-100 text-violet-900",
    "bg-purple-100 text-purple-900",
    "bg-fuchsia-100 text-fuchsia-900",
    "bg-pink-100 text-pink-900",
    "bg-rose-100 text-rose-900",
    "bg-orange-100 text-orange-900",
    "bg-amber-100 text-amber-900",
    "bg-yellow-100 text-yellow-900",
    "bg-lime-100 text-lime-900",
    "bg-green-100 text-green-900",
  ];

  if (allClasses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-400 text-sm">
        Aucune classe ne correspond aux filtres sélectionnés.
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-400 text-sm">
        Aucune matière ne correspond aux filtres sélectionnés.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <h3 className="font-semibold text-sm">📋 Grille d'affectation — Enseignants × Classes</h3>
        <p className="text-xs text-blue-200 mt-0.5">Déposez un enseignant dans la cellule de la classe souhaitée</p>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse w-full min-w-[500px]">
          <thead>
            {/* Row 1: Type */}
            <tr>
              <th
                rowSpan={3}
                className="border border-slate-300 bg-slate-100 text-slate-700 text-sm font-bold px-4 py-3 text-left align-middle min-w-[140px] sticky left-0 z-10"
              >
                Matières
              </th>
              {columns.map(({ type, levels }) => {
                const totalClasses = levels.reduce((acc, l) => acc + l.classes.length, 0);
                return (
                  <th
                    key={type}
                    colSpan={totalClasses}
                    className={`border border-slate-300 text-white text-sm font-bold px-3 py-2 text-center ${typeColors[type] || "bg-slate-600"}`}
                  >
                    {type}
                  </th>
                );
              })}
            </tr>

            {/* Row 2: Niveau */}
            <tr>
              {columns.map(({ type, levels }) =>
                levels.map(({ level, classes }) => (
                  <th
                    key={`${type}-${level}`}
                    colSpan={classes.length}
                    className={`border border-slate-300 text-xs font-semibold px-2 py-2 text-center ${levelColors[type] || "bg-slate-50 text-slate-700"}`}
                  >
                    {level}
                  </th>
                ))
              )}
            </tr>

            {/* Row 3: Classes */}
            <tr>
              {columns.map(({ type, levels }) =>
                levels.map(({ level, classes }) =>
                  classes.map(cls => (
                    <th
                      key={cls.id}
                      className="border border-slate-300 bg-slate-50 text-xs font-medium text-slate-600 px-2 py-2 text-center whitespace-nowrap min-w-[110px]"
                    >
                      {cls.name}
                    </th>
                  ))
                )
              )}
            </tr>
          </thead>

          <tbody>
            {subjects.map(subject => (
              <tr key={subject.id} className="hover:bg-slate-50/40 transition-colors">
                <td className="border border-slate-200 px-3 py-2 sticky left-0 bg-white z-10 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    {subject.color && (
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-tight">{subject.name}</p>
                      <p className="text-[10px] text-slate-400">{subject.code}</p>
                    </div>
                  </div>
                </td>

                {columns.map(({ type, levels }) =>
                  levels.map(({ classes }) =>
                    classes.map(cls => {
                      const key = `${subject.id}|${cls.id}`;
                      const assigned = assignments[key] || [];
                      const isOver = dragOverCell === key;
                      const compatible = draggedTeacher ? isCompatible(draggedTeacher, subject.id) : null;

                      return (
                        <td
                          key={cls.id}
                          className={`border border-slate-200 align-top p-1.5 transition-all ${
                            isOver
                              ? compatible === false
                                ? "bg-red-50 ring-2 ring-inset ring-red-400"
                                : "bg-blue-50 ring-2 ring-inset ring-blue-400"
                              : draggedTeacher
                              ? "bg-slate-50/60"
                              : ""
                          }`}
                          onDragOver={e => { e.preventDefault(); setDragOverCell(key); }}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={e => {
                            e.preventDefault();
                            if (draggedTeacher && compatible !== false) {
                              onDrop(subject.id, cls.id, draggedTeacher);
                            }
                            setDragOverCell(null);
                          }}
                        >
                          <div className="space-y-1 min-h-[36px]">
                            {assigned.map(tid => {
                              const teacher = getTeacherById(tid);
                              if (!teacher) return null;
                              return (
                                <div
                                  key={tid}
                                  className="flex items-start justify-between gap-1 bg-blue-50 border border-blue-200 rounded px-1.5 py-1 group"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[11px] text-blue-900 font-semibold leading-tight truncate">
                                      {teacher.first_name} {teacher.last_name}
                                    </p>
                                    <p className="text-[10px] text-blue-500 truncate">{subject.name}</p>
                                  </div>
                                  <button
                                    onClick={() => onRemove(subject.id, cls.id, tid)}
                                    className="text-blue-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}

                            {isOver && draggedTeacher && (
                              <div className={`text-[10px] rounded px-1.5 py-1 border border-dashed text-center ${
                                compatible === false
                                  ? "bg-red-100 border-red-400 text-red-600"
                                  : "bg-blue-100 border-blue-400 text-blue-600"
                              }`}>
                                {compatible === false ? "❌ Incompatible" : "✚ Déposer"}
                              </div>
                            )}

                            {assigned.length === 0 && !isOver && (
                              <div className="text-center text-slate-200 text-xs py-1">—</div>
                            )}
                          </div>
                        </td>
                      );
                    })
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}