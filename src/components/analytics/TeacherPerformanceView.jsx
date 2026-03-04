import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

export default function TeacherPerformanceView({ classes, students, grades, exams, subjects, attendance }) {
  const stats = useMemo(() => {
    const byClass = classes.map(cls => {
      const classStudentIds = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const classExamIds = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const classGrades = grades.filter(g => classStudentIds.includes(g.student_id) && classExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = classGrades.length ? classGrades.reduce((a, b) => a + b.score, 0) / classGrades.length : null;
      const successRate = classGrades.length ? (classGrades.filter(g => g.score >= 10).length / classGrades.length) * 100 : null;
      let dispersion = null;
      if (classGrades.length > 1 && avg !== null) {
        const variance = classGrades.reduce((acc, g) => acc + Math.pow(g.score - avg, 2), 0) / classGrades.length;
        dispersion = Math.sqrt(variance);
      }
      return {
        name: cls.name,
        avg: avg !== null ? parseFloat(avg.toFixed(1)) : null,
        successRate: successRate !== null ? parseFloat(successRate.toFixed(0)) : null,
        dispersion: dispersion !== null ? parseFloat(dispersion.toFixed(1)) : null,
        count: classGrades.length
      };
    }).filter(c => c.count > 0);

    const bySubject = subjects.map(sub => {
      const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const subGrades = grades.filter(g => subExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      const successRate = subGrades.length ? parseFloat(((subGrades.filter(g => g.score >= 10).length / subGrades.length) * 100).toFixed(0)) : null;
      return { name: sub.name.slice(0, 14), successRate, count: subGrades.length };
    }).filter(s => s.count > 0);

    const atRiskStudents = students.filter(s => s.status === "active").filter(student => {
      const sg = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
      const avg = sg.length ? sg.reduce((a, b) => a + b.score, 0) / sg.length : null;
      const att = attendance.filter(a => a.student_id === student.id);
      const absRate = att.length ? (att.filter(a => a.status === "absent").length / att.length) * 100 : 0;
      return (avg !== null && avg < 10) || absRate > 20;
    });

    const avgs = byClass.map(c => c.avg).filter(Boolean);
    const maxEcart = avgs.length > 1 ? Math.max(...avgs) - Math.min(...avgs) : null;

    return { byClass, bySubject, atRiskStudents, maxEcart };
  }, [classes, students, grades, exams, subjects, attendance]);

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Classes analysées</p>
            <p className="text-3xl font-bold text-indigo-700 mt-1">{stats.byClass.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400 bg-red-50">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Élèves à risque</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{stats.atRiskStudents.length}</p>
            <p className="text-xs text-red-400 mt-0.5">Détectés automatiquement</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Écart inter-classes</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{stats.maxEcart !== null ? `${stats.maxEcart.toFixed(1)} pts` : "—"}</p>
            <p className="text-xs text-amber-400 mt-0.5">Analyse biais notation</p>
          </CardContent>
        </Card>
      </div>

      {/* Moyenne + Dispersion par classe */}
      {stats.byClass.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500" />Moyenne & Dispersion par classe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]} name="Moyenne">
                  {stats.byClass.map((c, i) => (
                    <Cell key={i} fill={c.avg >= 12 ? "#22c55e" : c.avg >= 10 ? "#6366f1" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {stats.byClass.map(c => (
                <div key={c.name} className="flex items-center justify-between text-xs px-1">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex gap-4 text-slate-500">
                    <span>Moy: <strong className="text-slate-700">{c.avg ?? "—"}/20</strong></span>
                    <span>Réussite: <strong className="text-slate-700">{c.successRate ?? "—"}%</strong></span>
                    <span>Écart-type: <strong className="text-slate-700">{c.dispersion ?? "—"}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Taux de réussite par matière */}
      {stats.bySubject.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />Taux de réussite par matière
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(160, stats.bySubject.length * 32)}>
              <BarChart data={stats.bySubject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, "Taux de réussite"]} />
                <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                  {stats.bySubject.map((s, i) => (
                    <Cell key={i} fill={s.successRate >= 70 ? "#22c55e" : s.successRate >= 50 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Élèves à risque */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />Élèves à risque détectés automatiquement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.atRiskStudents.length === 0 ? (
            <p className="text-center text-slate-400 py-6">Aucun élève à risque détecté 🎉</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stats.atRiskStudents.map(s => {
                const sg = grades.filter(g => g.student_id === s.id && !g.absent && g.score != null);
                const avg = sg.length ? (sg.reduce((a, b) => a + b.score, 0) / sg.length).toFixed(1) : null;
                const cls = classes.find(c => c.id === s.class_id);
                const att = attendance.filter(a => a.student_id === s.id);
                const absRate = att.length ? ((att.filter(a => a.status === "absent").length / att.length) * 100).toFixed(0) : 0;
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-xs font-bold text-red-700">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{s.first_name} {s.last_name}</p>
                        {cls && <p className="text-xs text-slate-400">{cls.name}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-red-100 text-red-700 text-xs">Moy: {avg ?? "—"}/20</Badge>
                      {absRate > 20 && <Badge className="bg-orange-100 text-orange-700 text-xs">Abs: {absRate}%</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {stats.byClass.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Aucune donnée disponible — ajoutez des examens et des notes</p>
        </div>
      )}
    </div>
  );
}