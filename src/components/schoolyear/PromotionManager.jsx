import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  AlertTriangle,
  Users,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";

const DECISIONS = [
  { value: "promoted", label: "Promu(e)", color: "bg-green-100 text-green-700" },
  { value: "repeating", label: "Redoublant(e)", color: "bg-red-100 text-red-700" },
  { value: "graduated", label: "Diplômé(e)", color: "bg-purple-100 text-purple-700" },
  { value: "transferred", label: "Transféré(e)", color: "bg-orange-100 text-orange-700" },
  { value: "pending", label: "En attente", color: "bg-slate-100 text-slate-600" },
];

// Next level mapping
const NEXT_LEVEL = {
  "6ème": "5ème",
  "5ème": "4ème",
  "4ème": "3ème",
  "3ème": "2nde",
  "2nde": "1ère",
  "1ère": "Terminale",
  "Terminale": "graduated",
};

export default function PromotionManager({ schoolYears }) {
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [decisions, setDecisions] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClass],
    queryFn: () =>
      selectedClass
        ? base44.entities.Student.filter({ class_id: selectedClass, status: "active" })
        : [],
    enabled: !!selectedClass,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () => base44.entities.Grade.list(),
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list(),
  });

  // Calculate average per student
  const studentAverages = useMemo(() => {
    const map = {};
    students.forEach((student) => {
      const studentGrades = grades.filter((g) => g.student_id === student.id);
      const studentExams = exams.filter((e) => {
        const gradeEntry = studentGrades.find((g) => g.exam_id === e.id);
        return gradeEntry !== undefined;
      });

      let totalWeighted = 0;
      let totalCoeff = 0;

      studentExams.forEach((exam) => {
        const grade = studentGrades.find((g) => g.exam_id === exam.id);
        if (grade && !grade.absent && grade.score !== null && grade.score !== undefined) {
          const coeff = exam.coefficient || 1;
          totalWeighted += grade.score * coeff;
          totalCoeff += coeff;
        }
      });

      map[student.id] = totalCoeff > 0 ? +(totalWeighted / totalCoeff).toFixed(2) : null;
    });
    return map;
  }, [students, grades, exams]);

  const handleAutoPromotion = () => {
    setAutoRunning(true);
    const newDecisions = {};
    students.forEach((student) => {
      const avg = studentAverages[student.id];
      const selectedCls = classes.find((c) => c.id === selectedClass);
      const nextLevel = selectedCls ? NEXT_LEVEL[selectedCls.level] : null;

      if (nextLevel === "graduated") {
        newDecisions[student.id] = "graduated";
      } else if (avg !== null && avg >= 10) {
        newDecisions[student.id] = "promoted";
      } else if (avg !== null && avg < 10) {
        newDecisions[student.id] = "repeating";
      } else {
        newDecisions[student.id] = "pending";
      }
    });
    setDecisions(newDecisions);
    setAutoRunning(false);
    toast.success("Promotion automatique appliquée (moyenne ≥ 10 → Promu)");
  };

  const handleSave = async () => {
    if (!yearFrom || !yearTo) {
      toast.error("Veuillez sélectionner les années scolaires source et destination");
      return;
    }
    setSaving(true);
    const selectedCls = classes.find((c) => c.id === selectedClass);

    const records = students.map((student) => ({
      school_year_from: yearFrom,
      school_year_to: yearTo,
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      class_from: selectedCls?.name || "",
      decision: decisions[student.id] || "pending",
      average: studentAverages[student.id],
    }));

    await base44.entities.Promotion.bulkCreate(records);
    queryClient.invalidateQueries({ queryKey: ["promotions"] });
    toast.success(`${records.length} décisions de passage enregistrées !`);
    setSaving(false);
  };

  const selectedCls = classes.find((c) => c.id === selectedClass);
  const nextLevel = selectedCls ? NEXT_LEVEL[selectedCls.level] : null;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-indigo-600" />
            Paramètres du passage
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Année en cours</p>
            <Select value={yearFrom} onValueChange={setYearFrom}>
              <SelectTrigger>
                <SelectValue placeholder="Année source..." />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.id} value={y.name}>{y.name}</SelectItem>
                ))}
                <SelectItem value="2024-2025">2024-2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-center pb-2">
            <ArrowRight className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Nouvelle année</p>
            <Select value={yearTo} onValueChange={setYearTo}>
              <SelectTrigger>
                <SelectValue placeholder="Année destination..." />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.id} value={y.name}>{y.name}</SelectItem>
                ))}
                <SelectItem value="2025-2026">2025-2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Class selector */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Classe à traiter</p>
          <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setDecisions({}); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une classe..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClass && nextLevel && nextLevel !== "graduated" && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Les élèves promus iront en <strong className="ml-1">{nextLevel}</strong>
            </p>
          )}
          {selectedClass && nextLevel === "graduated" && (
            <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Classe de Terminale — les élèves obtiennent leur diplôme
            </p>
          )}
        </CardContent>
      </Card>

      {selectedClass && students.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {DECISIONS.filter(d => d.value !== "pending").map((dec) => (
              <Card key={dec.value}>
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold">
                    {Object.values(decisions).filter((d) => d === dec.value).length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{dec.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Auto promotion button */}
          <Button
            variant="outline"
            className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={handleAutoPromotion}
            disabled={autoRunning}
          >
            {autoRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Promotion automatique (moyenne ≥ 10)
          </Button>

          {/* Students table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Élèves ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {students.map((student) => {
                  const avg = studentAverages[student.id];
                  const decision = decisions[student.id] || "pending";
                  const decConfig = DECISIONS.find((d) => d.value === decision);

                  return (
                    <div key={student.id} className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {student.first_name} {student.last_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {avg !== null ? (
                            <span className={`text-sm font-bold ${avg >= 10 ? "text-green-600" : "text-red-600"}`}>
                              {avg}/20
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pas de notes</span>
                          )}
                        </div>
                      </div>
                      <Select
                        value={decision}
                        onValueChange={(v) => setDecisions((prev) => ({ ...prev, [student.id]: v }))}
                      >
                        <SelectTrigger className={`w-36 text-xs font-medium ${decConfig?.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DECISIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.color}`}>
                                {d.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Valider et enregistrer les décisions
          </Button>
        </>
      )}

      {selectedClass && students.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Aucun élève actif dans cette classe</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}