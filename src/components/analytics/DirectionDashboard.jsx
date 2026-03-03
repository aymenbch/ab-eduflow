import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { TrendingUp, TrendingDown, Users, Award, AlertTriangle, BookOpen } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export default function DirectionDashboard() {
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });

  const stats = useMemo(() => {
    const activeStudents = students.filter(s => s.status === "active");
    const allScores = grades.filter(g => !g.absent && g.score != null).map(g => g.score);
    const globalAvg = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : 0;
    const successRate = allScores.length ? ((allScores.filter(s => s >= 10).length / allScores.length) * 100).toFixed(1) : 0;

    const absentCount = attendance.filter(a => a.status === "absent").length;
    const absentRate = attendance.length ? ((absentCount / attendance.length) * 100).toFixed(1) : 0;

    // By class
    const byClass = classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const classExams = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const classGrades = grades.filter(g => classStudents.includes(g.student_id) && classExams.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = classGrades.length ? (classGrades.reduce((a, b) => a + b.score, 0) / classGrades.length).toFixed(1) : 0;
      return { name: cls.name, moyenne: parseFloat(avg), effectif: classStudents.length };
    }).filter(c => c.effectif > 0);

    // By subject
    const bySubject = subjects.map(sub => {
      const subExams = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const subGrades = grades.filter(g => subExams.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = subGrades.length ? (subGrades.reduce((a, b) => a + b.score, 0) / subGrades.length).toFixed(1) : 0;
      return { name: sub.name, moyenne: parseFloat(avg), examens: subExams.length };
    }).filter(s => s.examens > 0);

    // By trimester
    const byTrimester = ["T1", "T2", "T3"].map(t => {
      const tExams = exams.filter(e => e.trimester === t).map(e => e.id);
      const tGrades = grades.filter(g => tExams.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = tGrades.length ? (tGrades.reduce((a, b) => a + b.score, 0) / tGrades.length).toFixed(1) : null;
      return { name: t, moyenne: avg ? parseFloat(avg) : null };
    }).filter(t => t.moyenne !== null);

    // Gender split
    const boys = activeStudents.filter(s => s.gender === "M").length;
    const girls = activeStudents.filter(s => s.gender === "F").length;

    return { globalAvg, successRate, absentRate, byClass, bySubject, byTrimester, boys, girls, activeCount: activeStudents.length, sanctionsActive: sanctions.filter(s => !s.resolved).length };
  }, [students, grades, exams, classes, subjects, attendance, sanctions]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<Award className="w-5 h-5 text-indigo-600" />} label="Moyenne générale" value={`${stats.globalAvg}/20`} color="indigo" />
        <KPICard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Taux de réussite" value={`${stats.successRate}%`} color="green" />
        <KPICard icon={<Users className="w-5 h-5 text-blue-600" />} label="Taux d'absentéisme" value={`${stats.absentRate}%`} color="blue" />
        <KPICard icon={<AlertTriangle className="w-5 h-5 text-orange-600" />} label="Sanctions actives" value={stats.sanctionsActive} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyenne par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Moyenne par classe</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.byClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} />
                <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                <Bar dataKey="moyenne" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Évolution trimestrielle */}
        <Card>
          <CardHeader><CardTitle className="text-base">📈 Évolution trimestrielle</CardTitle></CardHeader>
          <CardContent>
            {stats.byTrimester.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={stats.byTrimester}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 20]} />
                  <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                  <Line type="monotone" dataKey="moyenne" stroke="#6366f1" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400">Données insuffisantes</div>
            )}
          </CardContent>
        </Card>

        {/* Moyenne par matière */}
        <Card>
          <CardHeader><CardTitle className="text-base">📚 Performance par matière</CardTitle></CardHeader>
          <CardContent>
            {stats.bySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.bySubject} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                  <Bar dataKey="moyenne" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400">Aucune donnée</div>
            )}
          </CardContent>
        </Card>

        {/* Répartition genre */}
        <Card>
          <CardHeader><CardTitle className="text-base">👥 Répartition des élèves</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={[{ name: "Garçons", value: stats.boys }, { name: "Filles", value: stats.girls }]} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    <Cell fill="#6366f1" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-900">{stats.activeCount}</p>
                  <p className="text-sm text-slate-500">élèves actifs</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center"><p className="font-bold text-indigo-600">{stats.boys}</p><p className="text-slate-500">Garçons</p></div>
                  <div className="text-center"><p className="font-bold text-pink-600">{stats.girls}</p><p className="text-slate-500">Filles</p></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 border-indigo-200",
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    orange: "bg-orange-50 border-orange-200",
  };
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}