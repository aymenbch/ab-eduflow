import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CheckCircle, AlertTriangle, Save, Loader2, Filter,
  Search, X, Info, BarChart2, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudentCard from "@/components/affectation/StudentCard";
import StudentAIAssistant from "@/components/affectation/StudentAIAssistant";

function ClassDropZone({ cls, students, assignedStudentIds, onDrop, onRemove, draggedStudent }) {
  const [isOver, setIsOver] = useState(false);
  const assignedStudents = students.filter(s => assignedStudentIds.includes(s.id));

  const avgGrade = assignedStudents.length > 0
    ? (assignedStudents.reduce((sum, s) => sum + (s.average_grade || 0), 0) / assignedStudents.length).toFixed(1)
    : null;

  const genderCount = { M: 0, F: 0 };
  assignedStudents.forEach(s => { if (s.gender) genderCount[s.gender]++; });

  const bgColor = cls.level?.includes("Terminale") || cls.level?.includes("1ère") || cls.level?.includes("3ème")
    ? "from-indigo-50 to-indigo-100/50 border-indigo-200"
    : cls.level?.includes("2nde") || cls.level?.includes("4ème") || cls.level?.includes("5ème")
    ? "from-teal-50 to-teal-100/50 border-teal-200"
    : "from-slate-50 to-slate-100/50 border-slate-200";

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 bg-gradient-to-b min-h-[400px] transition-all ${bgColor} ${isOver && draggedStudent ? "border-purple-400 ring-2 ring-purple-300 scale-[1.01]" : ""}`}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => { e.preventDefault(); setIsOver(false); onDrop(cls.id); }}
    >
      {/* Class Header */}
      <div className="px-3 py-3 border-b border-slate-200 bg-white/70 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-slate-800">{cls.name}</p>
            <p className="text-[10px] text-slate-400">{cls.level}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-700">{assignedStudents.length}</p>
            <p className="text-[10px] text-slate-400">élèves</p>
          </div>
        </div>

        {/* Stats row */}
        {assignedStudents.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {avgGrade && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                parseFloat(avgGrade) >= 14 ? "bg-blue-50 text-blue-700 border-blue-200" :
                parseFloat(avgGrade) >= 10 ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200"
              }`}>
                Moy. {avgGrade}/20
              </span>
            )}
            {genderCount.M > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">♂ {genderCount.M}</span>}
            {genderCount.F > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 border border-pink-200">♀ {genderCount.F}</span>}
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div className={`flex-1 p-2 space-y-1.5 overflow-y-auto ${isOver && draggedStudent ? "bg-purple-50/50" : ""}`}>
        {isOver && draggedStudent && (
          <div className="border-2 border-dashed border-purple-400 rounded-xl p-2 text-center text-xs text-purple-500 font-medium">
            Déposer ici
          </div>
        )}
        {assignedStudents.map(student => (
          <div key={student.id} className="relative group">
            <StudentCard student={student} compact={false} />
            <button
              onClick={() => onRemove(cls.id, student.id)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {assignedStudents.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-24 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
            Glissez des élèves ici
          </div>
        )}
      </div>
    </div>
  );
}

function UnassignedPanel({ students, draggedStudent, onDragStart, onDragEnd, searchTerm, onSearch, filterGender, onFilterGender, filterNeed, onFilterNeed }) {
  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    if (searchTerm && !name.includes(searchTerm.toLowerCase())) return false;
    if (filterGender !== "all" && s.gender !== filterGender) return false;
    if (filterNeed !== "all" && !(s.specific_needs || []).includes(filterNeed)) return false;
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-full">
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-slate-700">Élèves non affectés</p>
          <Badge variant="secondary" className="text-xs">{students.length}</Badge>
        </div>
        <Input
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={e => onSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="flex gap-1">
          <Select value={filterGender} onValueChange={onFilterGender}>
            <SelectTrigger className="h-7 text-[10px] flex-1">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="M">Garçons</SelectItem>
              <SelectItem value="F">Filles</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterNeed} onValueChange={onFilterNeed}>
            <SelectTrigger className="h-7 text-[10px] flex-1">
              <SelectValue placeholder="Besoin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="dyslexie">Dyslexie</SelectItem>
              <SelectItem value="sport_elite">Sport élite</SelectItem>
              <SelectItem value="handicap">Handicap</SelectItem>
              <SelectItem value="interne">Interne</SelectItem>
              <SelectItem value="haut_potentiel">Haut potentiel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8">
            {students.length === 0 ? "Tous les élèves sont affectés ✓" : "Aucun résultat"}
          </div>
        )}
        {filtered.map(student => (
          <StudentCard
            key={student.id}
            student={student}
            draggable
            onDragStart={() => onDragStart(student)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

export default function AffectationEleves() {
  const queryClient = useQueryClient();
  const [draggedStudent, setDraggedStudent] = useState(null);
  const [studentAssignments, setStudentAssignments] = useState({}); // { class_id: [student_id, ...] }
  const [notification, setNotification] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterNeed, setFilterNeed] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.filter({ status: "active" }),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  // Init assignments from students' class_id
  React.useEffect(() => {
    if (students.length === 0) return;
    const map = {};
    students.forEach(s => {
      if (s.class_id) {
        if (!map[s.class_id]) map[s.class_id] = [];
        map[s.class_id].push(s.id);
      }
    });
    setStudentAssignments(map);
  }, [students]);

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDrop = (classId) => {
    if (!draggedStudent) return;
    const studentId = draggedStudent.id;

    // Remove from old class if any
    setStudentAssignments(prev => {
      const newMap = { ...prev };
      // Remove from all classes
      Object.keys(newMap).forEach(cid => {
        newMap[cid] = newMap[cid].filter(id => id !== studentId);
      });
      // Add to new class
      if (!newMap[classId]) newMap[classId] = [];
      if (!newMap[classId].includes(studentId)) newMap[classId] = [...newMap[classId], studentId];
      return newMap;
    });
    setDraggedStudent(null);
    notify("success", `${draggedStudent.first_name} ${draggedStudent.last_name} affecté(e) avec succès`);
  };

  const handleRemove = (classId, studentId) => {
    setStudentAssignments(prev => ({
      ...prev,
      [classId]: (prev[classId] || []).filter(id => id !== studentId),
    }));
    notify("success", "Élève retiré de la classe.");
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = [];
    Object.entries(studentAssignments).forEach(([classId, studentIds]) => {
      studentIds.forEach(studentId => {
        const student = students.find(s => s.id === studentId);
        if (student && student.class_id !== classId) {
          updates.push(base44.entities.Student.update(studentId, { class_id: classId }));
        }
      });
    });
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ["students"] });
    setSaving(false);
    notify("success", `${updates.length} affectation(s) enregistrée(s) avec succès !`);
  };

  // Unassigned = students with no class or class not in classes list
  const assignedStudentIds = useMemo(() => {
    const ids = new Set();
    Object.values(studentAssignments).forEach(arr => arr.forEach(id => ids.add(id)));
    return ids;
  }, [studentAssignments]);

  const unassignedStudents = useMemo(() =>
    students.filter(s => !assignedStudentIds.has(s.id)),
    [students, assignedStudentIds]
  );

  const availableLevels = useMemo(() => [...new Set(classes.map(c => c.level))], [classes]);
  const filteredClasses = useMemo(() =>
    filterLevel === "all" ? classes : classes.filter(c => c.level === filterLevel),
    [classes, filterLevel]
  );

  const totalAssigned = assignedStudentIds.size;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🎓 Affectation des Élèves aux Classes</h1>
          <p className="text-slate-500 text-sm mt-1">Glissez un élève vers une classe pour l'affecter</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {students.length} élèves
          </Badge>
          <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
            <CheckCircle className="w-3 h-3 text-green-500" />
            {totalAssigned} affectés
          </Badge>
          {unassignedStudents.length > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {unassignedStudents.length} non affectés
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-green-600 hover:bg-green-700 gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
          notification.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {notification.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* AI Assistant */}
      <StudentAIAssistant
        students={students}
        classes={classes}
        studentAssignments={studentAssignments}
        onApply={setStudentAssignments}
      />

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Filter className="w-4 h-4" /> Filtrer par niveau :
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Tous les niveaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {availableLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-slate-700"><Info className="w-4 h-4" /> Légende :</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Bon niveau (≥14)</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div> Moyen (10-14)</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> Fragile (&lt;10)</div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 items-start">
        {/* Unassigned panel */}
        <div className="w-64 flex-shrink-0 sticky top-20" style={{ maxHeight: "calc(100vh - 200px)" }}>
          <UnassignedPanel
            students={unassignedStudents}
            draggedStudent={draggedStudent}
            onDragStart={setDraggedStudent}
            onDragEnd={() => setDraggedStudent(null)}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            filterGender={filterGender}
            onFilterGender={setFilterGender}
            filterNeed={filterNeed}
            onFilterNeed={setFilterNeed}
          />
        </div>

        {/* Classes grid */}
        <div className="flex-1 min-w-0">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune classe disponible</p>
              <p className="text-sm">Créez des classes dans la section Classes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredClasses.map(cls => (
                <ClassDropZone
                  key={cls.id}
                  cls={cls}
                  students={students}
                  assignedStudentIds={studentAssignments[cls.id] || []}
                  draggedStudent={draggedStudent}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}