import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Star } from "lucide-react";

export default function StudentAnalytics() {
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });

  const activeStudents = students.filter(s => s.status === "active");

  const profile = useMemo(() => {
    if (!selectedStudentId) return null;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return null;

    const studentGrades = grades.filter(g => g.student_id === selectedStudentId && !g.absent && g.score != null);
    const studentExamIds = studentGrades.map(g => g.exam_id);
    const relatedExams = exams.filter(e => studentExamIds.includes(e.id));

    // Global avg
    const avg = studentGrades.length ? (studentGrades.reduce((a, b) => a + b.score, 0) / studentGrades.length).toFixed(2) : null;

    // By subject
    const bySubject = subjects.map(sub => {
      const subExams = relatedExams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const subGrades = studentGrades.filter(g => subExams.includes(g.exam_id));
      if (!subGrades.length) return null;
      const subAvg = (subGrades.reduce((a, b) => a + b.score, 0) / subGrades.length).toFixed(1);
      return { subject: sub.name, moyenne: parseFloat(subAvg), fullMark: 20 };
    }).filter(Boolean);

    // By trimester
    const byTrimester = ["T1", "T2", "T3"].map(t => {
      const tExams = relatedExams.filter(e => e.trimester === t).map(e => e.id);
      const tGrades = studentGrades.filter(g => tExams.includes(g.exam_id));
      const tAvg = tGrades.length ? (tGrades.reduce((a, b) => a + b.score, 0) / tGrades.length).toFixed(1) : null;
      return { trimestre: t, moyenne: tAvg ? parseFloat(tAvg) : null };
    }).filter(t => t.moyenne !== null);

    // Attendance
    const studentAttendance = attendance.filter(a => a.student_id === selectedStudentId);
    const absentCount = studentAttendance.filter(a => a.status === "absent").length;
    const absenceRate = studentAttendance.length ? ((absentCount / studentAttendance.length) * 100).toFixed(0) : 0;

    // Class ranking
    const classStudents = students.filter(s => s.class_id === student.class_id);
    const classAverages = classStudents.map(s => {
      const sGrades = grades.filter(g => g.student_id === s.id && !g.absent && g.score != null);
      const sAvg = sGrades.length ? sGrades.reduce((a, b) => a + b.score, 0) / sGrades.length : 0;
      return { id: s.id, avg: sAvg };
    }).sort((a, b) => b.avg - a.avg);
    const rank = classAverages.findIndex(s => s.id === selectedStudentId) + 1;

    // Risk score (0-100, higher = more risk)
    const riskScore = Math.min(100, Math.max(0,
      (avg ? (avg < 8 ? 70 : avg < 10 ? 40 : avg < 12 ? 20 : 5) : 50) +
      (absenceRate > 20 ? 30 : absenceRate > 10 ? 15 : 0)
    ));

    // Progression (T1 vs T2 or T2 vs T3)
    let progression = null;
    if (byTrimester.length >= 2) {
      const last = byTrimester[byTrimester.length - 1].moyenne;
      const prev = byTrimester[byTrimester.length - 2].moyenne;
      progression = (last - prev).toFixed(1);
    }

    return { student, avg, bySubject, byTrimester, absenceRate, rank, totalInClass: classStudents.length, riskScore, progression };
  }, [selectedStudentId, students, grades, exams, subjects, attendance]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Sélectionner un élève..." />
          </SelectTrigger>
          <SelectContent>
            {activeStudents.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!profile && (
        <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-50 rounded-xl">
          Sélectionnez un élève pour voir son profil analytique
        </div>
      )}

      {profile && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-xl border">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {profile.student.first_name[0]}{profile.student.last_name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile.student.first_name} {profile.student.last_name}</h2>
              <p className="text-slate-500 text-sm">{profile.student.student_code}</p>
            </div>
            <div className="flex gap-4">
              <Metric label="Moyenne" value={profile.avg ? `${profile.avg}/20` : "—"} />
              <Metric label="Rang" value={profile.rank ? `${profile.rank}/${profile.totalInClass}` : "—"} />
              <Metric label="Absences" value={`${profile.absenceRate}%`} />
              <RiskBadge score={profile.riskScore} />
            </div>
          </div>

          {/* Progression indicator */}
          {profile.progression !== null && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${parseFloat(profile.progression) > 0 ? "bg-green-50 text-green-700" : parseFloat(profile.progression) < 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"}`}>
              {parseFloat(profile.progression) > 0 ? <TrendingUp className="w-4 h-4" /> : parseFloat(profile.progression) < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              <span className="text-sm font-medium">
                Progression : {parseFloat(profile.progression) > 0 ? "+" : ""}{profile.progression} pts par rapport au trimestre précédent
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolution */}
            <Card>
              <CardHeader><CardTitle className="text-base">📈 Évolution trimestrielle</CardTitle></CardHeader>
              <CardContent>
                {profile.byTrimester.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={profile.byTrimester}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="trimestre" />
                      <YAxis domain={[0, 20]} />
                      <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                      <Line type="monotone" dataKey="moyenne" stroke="#6366f1" strokeWidth={2} dot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* Radar */}
            <Card>
              <CardHeader><CardTitle className="text-base">🎯 Radar des compétences</CardTitle></CardHeader>
              <CardContent>
                {profile.bySubject.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={profile.bySubject}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 20]} />
                      <Radar dataKey="moyenne" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* By subject bar */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">📊 Moyennes par matière</CardTitle></CardHeader>
              <CardContent>
                {profile.bySubject.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={profile.bySubject}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 20]} />
                      <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                      <Bar dataKey="moyenne" radius={[4, 4, 0, 0]}
                        fill="#6366f1"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center px-3">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function RiskBadge({ score }) {
  let label, cls;
  if (score >= 60) { label = "🔴 Risque élevé"; cls = "bg-red-100 text-red-700"; }
  else if (score >= 30) { label = "🟡 Surveillance"; cls = "bg-yellow-100 text-yellow-700"; }
  else { label = "🟢 Stable"; cls = "bg-green-100 text-green-700"; }
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-40 text-slate-400">Données insuffisantes</div>;
}