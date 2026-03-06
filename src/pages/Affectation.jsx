import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, CheckCircle, AlertTriangle, Info, Filter, Save, CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeacherColumn from "@/components/affectation/TeacherColumn.jsx";
import ChargeOverview from "@/components/affectation/ChargeOverview.jsx";
import AffectationTable from "@/components/affectation/AffectationTable.jsx";
import AIAssistant from "@/components/affectation/AIAssistant.jsx";

const TYPE_LEVELS = {
  "École": ["CP", "CE1", "CE2", "CM1", "CM2"],
  "Collège": ["6ème", "5ème", "4ème", "3ème"],
  "Lycée": ["2nde", "1ère", "Terminale"],
};

const ALL_TYPES = ["École", "Collège", "Lycée"];

function getTypeForLevel(level) {
  for (const [type, levels] of Object.entries(TYPE_LEVELS)) {
    if (levels.includes(level)) return type;
  }
  return null;
}

export default function Affectation() {
  const queryClient = useQueryClient();
  const [draggedTeacher, setDraggedTeacher] = useState(null);
  const [notification, setNotification] = useState(null);
  const [assignments, setAssignments] = useState({});

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");

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

  // Compute teacher workload
  const teacherWorkload = useMemo(() => {
    const map = {};
    teachers.forEach(t => { map[t.id] = 0; });
    schedules.forEach(s => {
      if (s.teacher_id && map[s.teacher_id] !== undefined) map[s.teacher_id]++;
    });
    return map;
  }, [schedules, teachers]);

  // Load assignments from schedules: key = `${subject_id}|${class_id}`
  useEffect(() => {
    const map = {};
    schedules.forEach(s => {
      if (!s.class_id || !s.subject_id || !s.teacher_id) return;
      const key = `${s.subject_id}|${s.class_id}`;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(s.teacher_id)) map[key].push(s.teacher_id);
    });
    setAssignments(map);
  }, [schedules]);

  const updateMutation = useMutation({
    mutationFn: async ({ subjectId, classId, teacherId, teacherSubjectIds }) => {
      if (teacherSubjectIds?.length && !teacherSubjectIds.includes(subjectId)) {
        throw new Error("Ce professeur n'enseigne pas cette matière.");
      }
      return { subjectId, classId, teacherId };
    },
    onSuccess: ({ subjectId, classId, teacherId }) => {
      const key = `${subjectId}|${classId}`;
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

  const removeAssignment = (subjectId, classId, teacherId) => {
    const key = `${subjectId}|${classId}`;
    setAssignments(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(id => id !== teacherId),
    }));
    setNotification({ type: "success", message: "Affectation retirée." });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDrop = (subjectId, classId, teacher) => {
    updateMutation.mutate({
      subjectId,
      classId,
      teacherId: teacher.id,
      teacherSubjectIds: teacher.subject_ids || [],
    });
    setDraggedTeacher(null);
  };

  const activeTeachers = teachers.filter(t => t.status === "active" || !t.status);

  // Build available filter options
  const availableLevels = useMemo(() => {
    if (filterType === "all") return Object.values(TYPE_LEVELS).flat();
    return TYPE_LEVELS[filterType] || [];
  }, [filterType]);

  const availableClasses = useMemo(() => {
    return classes.filter(c => {
      if (filterType !== "all" && getTypeForLevel(c.level) !== filterType) return false;
      if (filterLevel !== "all" && c.level !== filterLevel) return false;
      return true;
    });
  }, [classes, filterType, filterLevel]);

  const filteredSubjects = useMemo(() => {
    if (filterSubject === "all") return subjects;
    return subjects.filter(s => s.id === filterSubject);
  }, [subjects, filterSubject]);

  // Build structured data for the table:
  // Group classes by type then by level
  const tableData = useMemo(() => {
    const filteredClasses = availableClasses.filter(c => {
      if (filterClass !== "all" && c.id !== filterClass) return false;
      return true;
    });

    // Group by type -> level -> classes
    const byType = {};
    filteredClasses.forEach(cls => {
      const type = getTypeForLevel(cls.level) || "Autre";
      if (filterType !== "all" && type !== filterType) return;
      if (!byType[type]) byType[type] = {};
      if (!byType[type][cls.level]) byType[type][cls.level] = [];
      byType[type][cls.level].push(cls);
    });

    return byType;
  }, [availableClasses, filterType, filterClass]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🎯 Affectation Intelligente</h1>
          <p className="text-slate-500 text-sm mt-1">Glissez un enseignant vers une cellule classe pour l'affecter</p>
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
          {notification.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Overview */}
      <ChargeOverview teachers={activeTeachers} workload={teacherWorkload} />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Filter className="w-4 h-4" /> Filtres :
        </div>

        <Select value={filterType} onValueChange={v => { setFilterType(v); setFilterLevel("all"); setFilterClass("all"); }}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Type d'affectation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {ALL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setFilterClass("all"); }}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Niveau scolaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {availableLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Matière" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les matières</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
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

        {/* Assignment Table */}
        <div className="xl:col-span-4">
          <AffectationTable
            tableData={tableData}
            subjects={filteredSubjects}
            teachers={teachers}
            assignments={assignments}
            draggedTeacher={draggedTeacher}
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
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-400"></div> Charge légère (&lt; 8h)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Charge moyenne (8-16h)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div> Surcharge (&gt; 16h)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-200 border border-dashed border-blue-400"></div> Zone de dépôt</div>
      </div>
    </div>
  );
}