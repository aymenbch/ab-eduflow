import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  studentWeightedAvg, subjectAveragesForStudent,
  trimesterAverages, monthlyEvolution, rankStudents,
} from "@/utils/gradeUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Users, Award, AlertTriangle,
  BookOpen, Calendar, ShieldAlert, Target, Activity, User
} from "lucide-react";

const currentRole = () => localStorage.getItem("edugest_role");

function KPICard({ title, value, subtitle, icon: Icon, color = "blue", trend }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-xl opacity-80`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            {trend > 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> :
             trend < 0 ? <TrendingDown className="w-3 h-3 text-red-600" /> :
             <Minus className="w-3 h-3 text-slate-400" />}
            <span className={trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-slate-500"}>
              {trend > 0 ? "+" : ""}{trend.toFixed(1)} vs trimestre préc.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentDashboard360() {
  const role = currentRole();
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });

  // For parent: auto-select student by parent_email
  const [parentEmail] = useState(() => {
    // In demo mode we can't get real email, but we expose the selector anyway
    return null;
  });

  // Students available based on role
  const availableStudents = useMemo(() => {
    if (role === "parent" && parentEmail) {
      return students.filter(s => s.parent_email === parentEmail);
    }
    return students.filter(s => s.status === "active");
  }, [students, role, parentEmail]);

  // Auto-select first student for parent
  const effectiveStudentId = selectedStudentId || (availableStudents.length === 1 ? availableStudents[0]?.id : "");
  const student = students.find(s => s.id === effectiveStudentId);
  const studentClass = classes.find(c => c.id === student?.class_id);

  const analytics = useMemo(() => {
    if (!effectiveStudentId) return null;

    const classStudents = students.filter(s => s.class_id === student?.class_id && s.status === "active");

    // ── Moyennes (via gradeUtils) ────────────────────────────────────────────
    const overallAvg   = studentWeightedAvg(effectiveStudentId, grades, exams, subjects);
    const subjectAvgs  = subjectAveragesForStudent(effectiveStudentId, grades, exams, subjects);
    // Convertir en format attendu par les graphiques recharts existants
    const subjectAverages = subjectAvgs.map(r => ({ name: r.subject.name, avg: r.avg, coef: r.coef }));

    const evolution    = monthlyEvolution(effectiveStudentId, grades, exams);
    const byTrimester  = trimesterAverages(effectiveStudentId, grades, exams, subjects);
    const trend = byTrimester.T1 !== null && byTrimester.T2 !== null
      ? byTrimester.T2 - byTrimester.T1
      : undefined;

    // ── Assiduité ────────────────────────────────────────────────────────────
    const stuAtt    = attendance.filter(a => a.student_id === effectiveStudentId);
    const absences  = stuAtt.filter(a => a.status === "absent").length;
    const lates     = stuAtt.filter(a => a.status === "late").length;
    const absenceRate = stuAtt.length > 0 ? (absences / stuAtt.length) * 100 : 0;

    // ── Sanctions ────────────────────────────────────────────────────────────
    const stuSanctions    = sanctions.filter(s => s.student_id === effectiveStudentId);
    const activeSanctions = stuSanctions.filter(s => !s.resolved).length;
    const behaviorIndex   = Math.max(0, 10 - activeSanctions * 2 - lates * 0.2);

    // ── Classements (via gradeUtils) ─────────────────────────────────────────
    const classRankings   = rankStudents(classStudents, grades, exams, subjects);
    const classRank       = classRankings.findIndex(r => r.id === effectiveStudentId) + 1;

    const allRankings     = rankStudents(students.filter(s => s.status === "active"), grades, exams, subjects);
    const schoolRank      = allRankings.findIndex(r => r.id === effectiveStudentId) + 1;

    const progressionIndex = classRankings.length > 0
      ? Math.round(((classRankings.length - classRank) / classRankings.length) * 100)
      : 0;

    // ── Risque de décrochage ──────────────────────────────────────────────────
    let dropoutRisk = 0;
    if (overallAvg !== null && overallAvg < 8)  dropoutRisk += 40;
    else if (overallAvg !== null && overallAvg < 10) dropoutRisk += 20;
    if (absenceRate > 20)        dropoutRisk += 30;
    else if (absenceRate > 10)   dropoutRisk += 15;
    if (activeSanctions >= 3)    dropoutRisk += 20;
    else if (activeSanctions >= 1) dropoutRisk += 10;
    if (trend !== undefined && trend < -2) dropoutRisk += 10;
    dropoutRisk = Math.min(100, dropoutRisk);

    return {
      overallAvg, subjectAverages, monthlyEvolution: evolution, absences, lates, absenceRate,
      behaviorIndex, progressionIndex, dropoutRisk, classRank,
      classSize: classRankings.length, schoolRank, schoolSize: allRankings.length, trend,
    };
  }, [effectiveStudentId, students, grades, exams, subjects, attendance, sanctions, student]);

  const getRiskColor = (risk) => {
    if (risk >= 50) return "red";
    if (risk >= 25) return "orange";
    return "green";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Dashboard Élève 360°
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Profil académique complet et indicateurs clés</p>
        </div>
        {(role !== "parent" || availableStudents.length > 1) && (
          <div className="w-72">
            <Select value={effectiveStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un élève..." />
              </SelectTrigger>
              <SelectContent>
                {availableStudents.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} {s.student_code ? `(${s.student_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!effectiveStudentId ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Sélectionnez un élève pour voir son profil 360°</p>
          </CardContent>
        </Card>
      ) : !analytics ? null : (
        <>
          {/* Student info banner */}
          {student && (
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0">
              <CardContent className="p-5">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                    {student.first_name?.[0]}{student.last_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{student.first_name} {student.last_name}</h2>
                    <div className="flex items-center gap-4 mt-1 text-blue-100 text-sm">
                      {student.student_code && <span>N° {student.student_code}</span>}
                      {studentClass && <span>Classe : {studentClass.name}</span>}
                      {student.date_of_birth && (
                        <span>Né(e) le {new Date(student.date_of_birth).toLocaleDateString("fr-FR")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{analytics.overallAvg !== null ? analytics.overallAvg.toFixed(2) : "—"}</div>
                    <div className="text-blue-200 text-xs">Moyenne générale /20</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <KPICard
              title="Moyenne générale"
              value={analytics.overallAvg !== null ? `${analytics.overallAvg.toFixed(2)}/20` : "—"}
              icon={BookOpen}
              color={analytics.overallAvg !== null && analytics.overallAvg < 10 ? "red" : "blue"}
              trend={analytics.trend}
            />
            <KPICard
              title="Taux d'absence"
              value={`${analytics.absenceRate.toFixed(1)}%`}
              subtitle={`${analytics.absences} abs. · ${analytics.lates} ret.`}
              icon={Calendar}
              color={analytics.absenceRate > 15 ? "red" : analytics.absenceRate > 8 ? "orange" : "green"}
            />
            <KPICard
              title="Indice de comportement"
              value={`${analytics.behaviorIndex.toFixed(1)}/10`}
              icon={ShieldAlert}
              color={analytics.behaviorIndex < 5 ? "red" : analytics.behaviorIndex < 7 ? "orange" : "green"}
            />
            <KPICard
              title="Indice de progression"
              value={`${analytics.progressionIndex}%`}
              subtitle="Percentile dans la classe"
              icon={TrendingUp}
              color="purple"
            />
            <KPICard
              title="Risque de décrochage"
              value={`${analytics.dropoutRisk}%`}
              icon={AlertTriangle}
              color={getRiskColor(analytics.dropoutRisk)}
            />
            <KPICard
              title="Rang dans la classe"
              value={analytics.classRank > 0 ? `${analytics.classRank}/${analytics.classSize}` : "—"}
              icon={Users}
              color="slate"
            />
            <KPICard
              title="Rang dans l'établissement"
              value={analytics.schoolRank > 0 ? `${analytics.schoolRank}/${analytics.schoolSize}` : "—"}
              icon={Award}
              color="slate"
            />
            <KPICard
              title="Matières évaluées"
              value={analytics.subjectAverages.length}
              icon={Target}
              color="blue"
            />
          </div>

          {/* Dropout risk badge */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
            analytics.dropoutRisk >= 50 ? "bg-red-50 border-red-300 text-red-800" :
            analytics.dropoutRisk >= 25 ? "bg-orange-50 border-orange-300 text-orange-800" :
            "bg-green-50 border-green-300 text-green-800"
          }`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Risque de décrochage : {analytics.dropoutRisk}%</span>
              <span className="ml-2 text-sm opacity-80">
                {analytics.dropoutRisk >= 50 ? "— Intervention urgente recommandée" :
                 analytics.dropoutRisk >= 25 ? "— Surveillance renforcée conseillée" :
                 "— Profil stable"}
              </span>
            </div>
            <Badge className="ml-auto" variant="outline">
              {analytics.dropoutRisk >= 50 ? "Critique" : analytics.dropoutRisk >= 25 ? "Attention" : "Stable"}
            </Badge>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly evolution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Évolution mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.monthlyEvolution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analytics.monthlyEvolution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v.toFixed(2), "Moyenne"]} />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Pas assez de données</div>
                )}
              </CardContent>
            </Card>

            {/* Subject radar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Radar par matière</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.subjectAverages.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={analytics.subjectAverages.map(s => ({ subject: s.name.slice(0, 8), avg: s.avg }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <Radar dataKey="avg" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Pas assez de matières</div>
                )}
              </CardContent>
            </Card>

            {/* Bar chart per subject */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Moyenne par matière</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.subjectAverages.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.subjectAverages} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip formatter={(v) => [v.toFixed(2), "Moyenne"]} />
                      <Bar dataKey="avg" radius={[0, 4, 4, 0]}
                        fill="#3b82f6"
                        label={{ position: "right", formatter: (v) => v.toFixed(1), fontSize: 11 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Aucune note disponible</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}