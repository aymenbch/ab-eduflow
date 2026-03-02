import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Grades() {
  const urlParams = new URLSearchParams(window.location.search);
  const examId = urlParams.get("exam_id");

  const [grades, setGrades] = useState({});
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const exams = await base44.entities.Exam.filter({ id: examId });
      return exams[0];
    },
    enabled: !!examId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", exam?.class_id],
    queryFn: () => base44.entities.Student.filter({ class_id: exam.class_id }),
    enabled: !!exam?.class_id,
  });

  const { data: existingGrades = [] } = useQuery({
    queryKey: ["grades", examId],
    queryFn: () => base44.entities.Grade.filter({ exam_id: examId }),
    enabled: !!examId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  useEffect(() => {
    if (existingGrades.length > 0) {
      const gradeMap = {};
      existingGrades.forEach((g) => {
        gradeMap[g.student_id] = {
          id: g.id,
          score: g.score,
          comment: g.comment || "",
          absent: g.absent || false,
        };
      });
      setGrades(gradeMap);
    }
  }, [existingGrades]);

  const handleGradeChange = (studentId, field, value) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    for (const student of students) {
      const gradeData = grades[student.id];
      const existingGrade = existingGrades.find((g) => g.student_id === student.id);

      if (gradeData) {
        const data = {
          student_id: student.id,
          exam_id: examId,
          score: gradeData.absent ? null : Number(gradeData.score) || null,
          comment: gradeData.comment || "",
          absent: gradeData.absent || false,
        };

        if (existingGrade) {
          await base44.entities.Grade.update(existingGrade.id, data);
        } else if (gradeData.score || gradeData.absent) {
          await base44.entities.Grade.create(data);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["grades", examId] });
    setSaving(false);
  };

  if (!examId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Aucun examen sélectionné</p>
        <Link to={createPageUrl("Exams")}>
          <Button className="mt-4">Voir les examens</Button>
        </Link>
      </div>
    );
  }

  const subject = exam ? subjectMap[exam.subject_id] : null;

  // Calculate stats
  const filledGrades = Object.values(grades).filter((g) => g.score && !g.absent);
  const average =
    filledGrades.length > 0
      ? filledGrades.reduce((sum, g) => sum + Number(g.score), 0) / filledGrades.length
      : 0;
  const absentCount = Object.values(grades).filter((g) => g.absent).length;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Exams")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{exam?.title || "Chargement..."}</h1>
          {exam && (
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                style={{ borderColor: subject?.color, color: subject?.color }}
              >
                {subject?.name}
              </Badge>
              <span className="text-slate-500">
                Barème: /{exam.max_score || 20}
              </span>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Moyenne de classe</p>
            <p className="text-2xl font-bold">{average.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Notes saisies</p>
            <p className="text-2xl font-bold">
              {filledGrades.length} / {students.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Absents</p>
            <p className="text-2xl font-bold">{absentCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grades table */}
      <Card>
        <CardHeader>
          <CardTitle>Saisie des notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Élève</th>
                  <th className="text-center py-3 px-4 w-32">Note /{exam?.max_score || 20}</th>
                  <th className="text-center py-3 px-4 w-24">Absent</th>
                  <th className="text-left py-3 px-4">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const gradeData = grades[student.id] || {};
                  return (
                    <tr key={student.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                            {student.first_name?.[0]}
                            {student.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-slate-500">{student.student_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Input
                          type="number"
                          min="0"
                          max={exam?.max_score || 20}
                          step="0.5"
                          value={gradeData.score || ""}
                          onChange={(e) => handleGradeChange(student.id, "score", e.target.value)}
                          disabled={gradeData.absent}
                          className="w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Checkbox
                          checked={gradeData.absent || false}
                          onCheckedChange={(checked) =>
                            handleGradeChange(student.id, "absent", checked)
                          }
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          value={gradeData.comment || ""}
                          onChange={(e) => handleGradeChange(student.id, "comment", e.target.value)}
                          placeholder="Commentaire..."
                          className="w-full"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {students.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Aucun élève dans cette classe
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}