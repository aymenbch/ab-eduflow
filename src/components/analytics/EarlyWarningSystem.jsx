import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Loader2, Sparkles } from "lucide-react";

export default function EarlyWarningSystem() {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

  const warnings = useMemo(() => {
    return students.filter(s => s.status === "active").map(student => {
      // Grades
      const studentGrades = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
      const avg = studentGrades.length ? studentGrades.reduce((a, b) => a + b.score, 0) / studentGrades.length : null;

      // Trimester grades to detect drops
      const t1Exams = exams.filter(e => e.trimester === "T1").map(e => e.id);
      const t2Exams = exams.filter(e => e.trimester === "T2").map(e => e.id);
      const t3Exams = exams.filter(e => e.trimester === "T3").map(e => e.id);
      const avgT = (examIds) => {
        const g = studentGrades.filter(g => examIds.includes(g.exam_id));
        return g.length ? g.reduce((a, b) => a + b.score, 0) / g.length : null;
      };
      const avgT1 = avgT(t1Exams), avgT2 = avgT(t2Exams), avgT3 = avgT(t3Exams);
      const latestAvg = avgT3 ?? avgT2 ?? avgT1;
      const prevAvg = avgT3 ? avgT2 ?? avgT1 : avgT2 ? avgT1 : null;
      const drop = latestAvg && prevAvg ? prevAvg - latestAvg : 0;

      // Attendance
      const studentAtt = attendance.filter(a => a.student_id === student.id);
      const consecutiveAbsences = (() => {
        let max = 0, cur = 0;
        const sorted = [...studentAtt].sort((a, b) => new Date(a.date) - new Date(b.date));
        sorted.forEach(a => {
          if (a.status === "absent") { cur++; max = Math.max(max, cur); }
          else cur = 0;
        });
        return max;
      })();
      const absenceRate = studentAtt.length ? (studentAtt.filter(a => a.status === "absent").length / studentAtt.length) * 100 : 0;

      // Subjects below 10
      const subjectsBelowThreshold = (() => {
        const byExam = {};
        studentGrades.forEach(g => {
          const exam = exams.find(e => e.id === g.exam_id);
          if (exam?.subject_id) {
            if (!byExam[exam.subject_id]) byExam[exam.subject_id] = [];
            byExam[exam.subject_id].push(g.score);
          }
        });
        return Object.values(byExam).filter(scores => {
          const a = scores.reduce((x, y) => x + y, 0) / scores.length;
          return a < 10;
        }).length;
      })();

      // Sanctions
      const activeSanctions = sanctions.filter(s => s.student_id === student.id && !s.resolved).length;

      // Risk level
      const alerts = [];
      if (avg !== null && avg < 8) alerts.push("Moyenne critique (< 8/20)");
      else if (avg !== null && avg < 10) alerts.push("Moyenne insuffisante (< 10/20)");
      if (drop > 3) alerts.push(`Chute de ${drop.toFixed(1)} pts vs trimestre précédent`);
      if (consecutiveAbsences >= 3) alerts.push(`${consecutiveAbsences} absences consécutives`);
      if (absenceRate > 20) alerts.push(`Taux d'absence élevé (${absenceRate.toFixed(0)}%)`);
      if (subjectsBelowThreshold >= 2) alerts.push(`${subjectsBelowThreshold} matières sous la moyenne`);
      if (activeSanctions >= 2) alerts.push(`${activeSanctions} sanctions actives`);

      const riskLevel = alerts.length >= 3 ? "red" : alerts.length >= 1 ? "yellow" : "green";

      return {
        student,
        avg: avg ? avg.toFixed(1) : null,
        alerts,
        riskLevel,
        absenceRate: absenceRate.toFixed(0),
        consecutiveAbsences,
        activeSanctions
      };
    }).sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    });
  }, [students, grades, exams, attendance, sanctions]);

  const redCount = warnings.filter(w => w.riskLevel === "red").length;
  const yellowCount = warnings.filter(w => w.riskLevel === "yellow").length;
  const greenCount = warnings.filter(w => w.riskLevel === "green").length;

  const handleAIAnalysis = async () => {
    setLoadingAI(true);
    const criticalStudents = warnings.filter(w => w.riskLevel === "red").slice(0, 5).map(w => ({
      nom: `${w.student.first_name} ${w.student.last_name}`,
      moyenne: w.avg,
      alertes: w.alerts,
      absences: w.absenceRate + "%"
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un conseiller pédagogique expert. Voici les élèves en situation de risque critique dans l'établissement:\n\n${JSON.stringify(criticalStudents, null, 2)}\n\nPour chaque élève, propose des recommandations concrètes et personnalisées (plan d'action, soutien scolaire, contact parents, etc.). Sois précis et bienveillant.`,
      response_json_schema: {
        type: "object",
        properties: {
          synthese: { type: "string" },
          recommandations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                eleve: { type: "string" },
                priorite: { type: "string", enum: ["urgente", "importante", "normale"] },
                actions: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });
    setAiAnalysis(result);
    setLoadingAI(false);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <div><p className="text-2xl font-bold text-red-700">{redCount}</p><p className="text-sm text-red-600">🔴 Alerte critique</p></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-yellow-500" />
          <div><p className="text-2xl font-bold text-yellow-700">{yellowCount}</p><p className="text-sm text-yellow-600">🟡 Surveillance</p></div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <div><p className="text-2xl font-bold text-green-700">{greenCount}</p><p className="text-sm text-green-600">🟢 Stable</p></div>
        </div>
      </div>

      {/* AI Analysis button */}
      {redCount > 0 && (
        <div className="flex items-center gap-4">
          <Button onClick={handleAIAnalysis} disabled={loadingAI} className="bg-violet-600 hover:bg-violet-700 gap-2">
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyse IA — Plan d'action pour les élèves en danger
          </Button>
        </div>
      )}

      {/* AI Result */}
      {aiAnalysis && (
        <Card className="border-violet-200 bg-violet-50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" />Analyse IA & Recommandations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">{aiAnalysis.synthese}</p>
            {aiAnalysis.recommandations?.map((rec, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{rec.eleve}</span>
                  <Badge className={rec.priorite === "urgente" ? "bg-red-100 text-red-700" : rec.priorite === "importante" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}>
                    {rec.priorite}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {rec.actions?.map((action, j) => (
                    <li key={j} className="text-sm text-slate-600 flex items-start gap-2"><span className="text-violet-500 mt-0.5">•</span>{action}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Students list */}
      <div className="space-y-3">
        {warnings.filter(w => w.riskLevel !== "green" || w.alerts.length > 0).map(({ student, avg, alerts, riskLevel, absenceRate, activeSanctions }) => (
          <Card key={student.id} className={`border-l-4 ${riskLevel === "red" ? "border-l-red-500" : riskLevel === "yellow" ? "border-l-yellow-500" : "border-l-green-500"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-sm font-bold">
                    {student.first_name[0]}{student.last_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{student.first_name} {student.last_name}</p>
                    <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                      {avg && <span>Moy: {avg}/20</span>}
                      <span>Abs: {absenceRate}%</span>
                      {activeSanctions > 0 && <span className="text-red-500">{activeSanctions} sanction(s)</span>}
                    </div>
                  </div>
                </div>
                <span className="text-xl">{riskLevel === "red" ? "🔴" : riskLevel === "yellow" ? "🟡" : "🟢"}</span>
              </div>
              {alerts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {alerts.map((alert, i) => (
                    <Badge key={i} className={`text-xs ${riskLevel === "red" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {alert}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {warnings.filter(w => w.riskLevel !== "green").length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle className="w-12 h-12 mb-2 text-green-400" />
            <p className="text-lg font-medium text-green-600">Tous les élèves sont dans la zone stable 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}