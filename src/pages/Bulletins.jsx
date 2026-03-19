import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Users } from "lucide-react";
import BulletinPreview from "@/components/bulletins/BulletinPreview.jsx";

const LEGACY_PERIODS = [
  { id: "T1", name: "Trimestre 1", type: "trimestre" },
  { id: "T2", name: "Trimestre 2", type: "trimestre" },
  { id: "T3", name: "Trimestre 3", type: "trimestre" },
];

export default function Bulletins() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });

  // Année scolaire active + ses périodes
  const { data: schoolYears = [] } = useQuery({ queryKey: ["schoolYears"], queryFn: () => base44.entities.SchoolYear.list() });
  const activeYear = schoolYears.find(y => y.status === "active");
  const { data: periodsRaw = [] } = useQuery({
    queryKey: ["periods", activeYear?.id],
    queryFn: () => base44.entities.Period.filter({ school_year_id: activeYear.id }),
    enabled: !!activeYear?.id,
  });
  const periods = periodsRaw.length > 0
    ? [...periodsRaw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : LEGACY_PERIODS;

  // Sélectionner automatiquement la première période au chargement
  React.useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(periods[0].id);
    }
  }, [periods]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const classStudents = useMemo(() =>
    students.filter(s => s.class_id === selectedClassId && s.status === "active"),
    [students, selectedClassId]
  );

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="text-5xl">📋</div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Bulletins Scolaires</h1>
            <p className="text-white/80">Génération et impression des bulletins trimestriels</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Classe</label>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedStudentId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Période</label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.status === "closed" && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Élève (optionnel)</label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les élèves" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les élèves</SelectItem>
                  {classStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClassId && (
              <Button onClick={handlePrintAll} className="bg-blue-600 hover:bg-blue-700 gap-2 print:hidden">
                <Printer className="w-4 h-4" />
                Imprimer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedClassId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-xl">
          <FileText className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-lg font-medium">Sélectionnez une classe et une période</p>
          <p className="text-sm">pour générer les bulletins scolaires</p>
        </div>
      )}

      {selectedClassId && (
        <div className="space-y-2 print:space-y-0">
          <div className="flex items-center gap-3 mb-4 print:hidden">
            <Users className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-600 font-medium">
              {selectedStudentId && selectedStudentId !== "all"
                ? "1 bulletin"
                : `${classStudents.length} bulletins — ${selectedClass?.name}`}
            </span>
            {selectedPeriod && <Badge variant="outline" className="border-indigo-300 text-indigo-600">{selectedPeriod.name}</Badge>}
          </div>

          {(selectedStudentId && selectedStudentId !== "all"
            ? classStudents.filter(s => s.id === selectedStudentId)
            : classStudents
          ).map(student => (
            <BulletinPreview
              key={student.id}
              student={student}
              period={selectedPeriod}
              cls={selectedClass}
              teachers={teachers}
              grades={grades}
              exams={exams}
              subjects={subjects}
              attendance={attendance}
              allClassStudents={classStudents}
              allGrades={grades}
            />
          ))}
        </div>
      )}
    </div>
  );
}