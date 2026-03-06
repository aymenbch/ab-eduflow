import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, RefreshCw, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TeacherColumn from "@/components/affectation/TeacherColumn";
import AssignmentGrid from "@/components/affectation/AssignmentGrid";
import ChargeOverview from "@/components/affectation/ChargeOverview";

const LEVELS = [
  { id: "Primaire", label: "Primaire", cycles: ["CP", "CE1", "CE2", "CM1", "CM2"], color: "bg-green-100 text-green-800 border-green-200" },
  { id: "Collège", label: "Collège", cycles: ["6ème", "5ème", "4ème", "3ème"], color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "Lycée", label: "Lycée", cycles: ["2nde", "1ère", "Terminale"], color: "bg-purple-100 text-purple-800 border-purple-200" },
];

function getCycleLevel(level) {
  if (["CP", "CE1", "CE2", "CM1", "CM2"].includes(level)) return "Primaire";
  if (["6ème", "5ème", "4ème", "3ème"].includes(level)) return "Collège";
  if (["2nde", "1ère", "Terminale"].includes(level)) return "Lycée";
  return null;
}

export default function Affectation() {
  const queryClient = useQueryClient();
  const [draggedTeacher, setDraggedTeacher] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [notification, setNotification] = useState(null);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => base44.entities.Schedule.list(),
  });

  // Compute teacher workload: count schedules per teacher
  const teacherWorkload = React.useMemo(() => {
    const map = {};
    teachers.forEach(t => { map[t.id] = 0; });
    schedules.forEach(s => {
      if (s.teacher_id && map[s.teacher_id] !== undefined) {
        map[s.teacher_id]++;
      }
    });
    return map;
  }, [schedules, teachers]);

  // Affectations: group schedules by (subject_id, class level) -> teacher_id
  // We'll use a local state to track current assignments for the grid
  // Assignment key: `${subject_id}|${level}`
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    const map = {};
    schedules.forEach(s => {
      const cls = classes.find(c => c.id === s.class_id);
      if (!cls || !s.subject_id || !s.teacher_id) return;
      const level = getCycleLevel(cls.level);
      if (!level) return;
      const key = `${s.subject_id}|${level}`;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(s.teacher_id)) map[key].push(s.teacher_id);
    });
    setAssignments(map);
  }, [schedules, classes]);

  const updateMutation = useMutation({
    mutationFn: async ({ subjectId, level, teacherId, teacherSubjectIds }) => {
      // Check compatibility: teacher must have this subject
      if (teacherSubjectIds && !teacherSubjectIds.includes(subjectId)) {
        throw new Error("Ce professeur n'enseigne pas cette matière.");
      }
      // Update teacher's subject_ids if needed (already handled by subject_ids)
      return { subjectId, level, teacherId };
    },
    onSuccess: ({ subjectId, level, teacherId }) => {
      const key = `${subjectId}|${level}`;
      setAssignments(prev => {
        const current = prev[key] || [];
        if (current.includes(teacherId)) return prev;
        return { ...prev, [key]: [...current, teacherId] };
      });
      setNotification({ type: "success", message: "Affectation ajoutée avec succès !" });
      setTimeout(() => setNotification(null), 3000);
    },
    onError: (err) => {
      setNotification({ type: "error", message: err.message || "Erreur d'affectation." });
      setTimeout(() => setNotification(null), 4000);
    },
  });

  const removeAssignment = (subjectId, level, teacherId) => {
    const key = `${subjectId}|${level}`;
    setAssignments(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(id => id !== teacherId),
    }));
    setNotification({ type: "success", message: "Affectation retirée." });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDrop = (subjectId, levelId, teacher) => {
    updateMutation.mutate({
      subjectId,
      level: levelId,
      teacherId: teacher.id,
      teacherSubjectIds: teacher.subject_ids || [],
    });
    setDraggedTeacher(null);
    setDragOverCell(null);
  };

  const activeTeachers = teachers.filter(t => t.status === "active" || !t.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🎯 Affectation Intelligente
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Glissez un enseignant vers un niveau/matière pour l'affecter
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {activeTeachers.length} enseignants
          </Badge>
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            {Object.values(assignments).filter(a => a.length > 0).length} affectations
          </Badge>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
          notification.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {notification.type === "success"
            ? <CheckCircle className="w-4 h-4" />
            : <AlertTriangle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Overview cards */}
      <ChargeOverview teachers={activeTeachers} workload={teacherWorkload} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Teacher panel */}
        <div className="xl:col-span-1">
          <TeacherColumn
            teachers={activeTeachers}
            subjects={subjects}
            workload={teacherWorkload}
            draggedTeacher={draggedTeacher}
            onDragStart={setDraggedTeacher}
            onDragEnd={() => setDraggedTeacher(null)}
          />
        </div>

        {/* Assignment Grid */}
        <div className="xl:col-span-3">
          <AssignmentGrid
            subjects={subjects}
            levels={LEVELS}
            teachers={teachers}
            assignments={assignments}
            draggedTeacher={draggedTeacher}
            dragOverCell={dragOverCell}
            onDragOverCell={setDragOverCell}
            onDrop={handleDrop}
            onRemove={removeAssignment}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <Info className="w-4 h-4" /> Légende :
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-400"></div> Charge légère (&lt; 8h)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400"></div> Charge moyenne (8-16h)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400"></div> Surcharge (&gt; 16h)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-dashed border-blue-400"></div> Zone de dépôt
        </div>
      </div>
    </div>
  );
}