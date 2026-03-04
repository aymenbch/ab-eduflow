import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Users, Award, AlertTriangle,
  BookOpen, Calendar, ShieldAlert, Target, Activity, User,
  BarChart2, GraduationCap, CheckCircle, Clock, Loader2, Sparkles, Filter
} from "lucide-react";
import EarlyWarningSystem from "@/components/analytics/EarlyWarningSystem";
import TeacherAnalytics from "@/components/analytics/TeacherAnalytics";
import TeacherPerformanceView from "@/components/analytics/TeacherPerformanceView";

const currentRole = () => localStorage.getItem("edugest_role");

// ─── Shared helpers ────────────────────────────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, color = "blue", trend }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <Card className={`border ${colors[color] || colors.blue}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-xl opacity-80">
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

// ─── Filters bar for teacher/director ──────────────────────────────────────────
// Order: année scolaire → niveau → classe → matière → élève
function FiltersBar({ schoolYears, classes, subjects, students, filters, onChange }) {
  // Levels available given selected school year
  const availableLevels = useMemo(() => {
    const base = filters.schoolYear
      ? classes.filter(c => c.school_year === filters.schoolYear)
      : classes;
    return [...new Set(base.map(c => c.level).filter(Boolean))].sort();
  }, [classes, filters.schoolYear]);

  // Classes available given selected school year + level
  const filteredClasses = useMemo(() => {
    let base = filters.schoolYear
      ? classes.filter(c => c.school_year === filters.schoolYear)
      : classes;
    if (filters.level) base = base.filter(c => c.level === filters.level);
    return base;
  }, [classes, filters.schoolYear, filters.level]);

  // Students available given selected class (or all active if no class)
  const filteredStudents = useMemo(() => {
    return filters.classId
      ? students.filter(s => s.class_id === filters.classId && s.status === "active")
      : students.filter(s => s.status === "active");
  }, [students, filters.classId]);

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 rounded-xl border">
      <Filter className="w-4 h-4 text-slate-400" />

      {/* 1. Année scolaire */}
      <Select
        value={filters.schoolYear || ""}
        onValueChange={v => onChange({ schoolYear: v || null, level: null, classId: null, subjectId: null, studentId: null })}
      >
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="Année scolaire" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>Toutes les années</SelectItem>
          {schoolYears.map(sy => <SelectItem key={sy.id} value={sy.name}>{sy.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* 2. Niveau */}
      <Select
        value={filters.level || ""}
        onValueChange={v => onChange({ ...filters, level: v || null, classId: null, studentId: null })}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Niveau" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>Tous les niveaux</SelectItem>
          {availableLevels.map(l => (
            <SelectItem key={l} value={l}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 3. Classe */}
      <Select
        value={filters.classId || ""}
        onValueChange={v => onChange({ ...filters, classId: v || null, studentId: null })}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Classe" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>Toutes les classes</SelectItem>
          {filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* 4. Matière */}
      <Select
        value={filters.subjectId || ""}
        onValueChange={v => onChange({ ...filters, subjectId: v || null })}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Matière" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>Toutes les matières</SelectItem>
          {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* 5. Élève */}
      <Select
        value={filters.studentId || ""}
        onValueChange={v => onChange({ ...filters, studentId: v || null })}
      >
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Élève" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>Tous les élèves</SelectItem>
          {filteredStudents.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {Object.values(filters).some(Boolean) && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500"
          onClick={() => onChange({ schoolYear: null, level: null, classId: null, subjectId: null, studentId: null })}>
          Réinitialiser
        </Button>
      )}
    </div>
  );
}

// ─── Student 360 card ──────────────────────────────────────────────────────────
function Student360({ student, grades, exams, subjects, attendance, sanctions, classes, allStudents }) {
  const studentClass = classes.find(c => c.id === student?.class_id);

  const analytics = useMemo(() => {
    if (!student) return null;
    const studentGrades = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
    const classStudents = allStudents.filter(s => s.class_id === student.class_id && s.status === "active");

    const weightedSum = studentGrades.reduce((sum, g) => {
      const exam = exams.find(e => e.id === g.exam_id);
      const subj = subjects.find(s => s.id === exam?.subject_id);
      return sum + g.score * (subj?.coefficient || 1);
    }, 0);
    const weightedCoef = studentGrades.reduce((sum, g) => {
      const exam = exams.find(e => e.id === g.exam_id);
      const subj = subjects.find(s => s.id === exam?.subject_id);
      return sum + (subj?.coefficient || 1);
    }, 0);
    const overallAvg = weightedCoef > 0 ? weightedSum / weightedCoef : null;

    const subjectAverages = subjects.map(sub => {
      const subExams = exams.filter(e => e.subject_id === sub.id);
      const subGrades = grades.filter(g => g.student_id === student.id && subExams.some(e => e.id === g.exam_id) && !g.absent && g.score != null);
      const avg = subGrades.length ? subGrades.reduce((s, g) => s + g.score, 0) / subGrades.length : null;
      return { name: sub.name, avg, coef: sub.coefficient || 1 };
    }).filter(s => s.avg !== null);

    const monthlyData = {};
    studentGrades.forEach(g => {
      const exam = exams.find(e => e.id === g.exam_id);
      if (!exam?.date) return;
      const month = exam.date.slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { scores: [] };
      monthlyData[month].scores.push(g.score);
    });
    const monthlyEvolution = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month: month.slice(5) + "/" + month.slice(2, 4),
        avg: d.scores.reduce((a, b) => a + b, 0) / d.scores.length
      }));

    const t1G = studentGrades.filter(g => exams.find(e => e.id === g.exam_id)?.trimester === "T1");
    const t2G = studentGrades.filter(g => exams.find(e => e.id === g.exam_id)?.trimester === "T2");
    const t1Avg = t1G.length ? t1G.reduce((s, g) => s + g.score, 0) / t1G.length : null;
    const t2Avg = t2G.length ? t2G.reduce((s, g) => s + g.score, 0) / t2G.length : null;
    const trend = t1Avg !== null && t2Avg !== null ? t2Avg - t1Avg : undefined;

    const stuAtt = attendance.filter(a => a.student_id === student.id);
    const absences = stuAtt.filter(a => a.status === "absent").length;
    const lates = stuAtt.filter(a => a.status === "late").length;
    const absenceRate = stuAtt.length > 0 ? (absences / stuAtt.length) * 100 : 0;

    const stuSanctions = sanctions.filter(s => s.student_id === student.id);
    const activeSanctions = stuSanctions.filter(s => !s.resolved).length;
    const behaviorIndex = Math.max(0, 10 - activeSanctions * 2 - lates * 0.2);

    const calcAvg = (sid) => {
      const sg = grades.filter(g => g.student_id === sid && !g.absent && g.score != null);
      const ws = sg.reduce((sum, g) => {
        const exam = exams.find(e => e.id === g.exam_id);
        const subj = subjects.find(su => su.id === exam?.subject_id);
        return sum + g.score * (subj?.coefficient || 1);
      }, 0);
      const wc = sg.reduce((sum, g) => {
        const exam = exams.find(e => e.id === g.exam_id);
        const subj = subjects.find(su => su.id === exam?.subject_id);
        return sum + (subj?.coefficient || 1);
      }, 0);
      return wc > 0 ? ws / wc : 0;
    };

    const classRankings = classStudents.map(s => ({ id: s.id, avg: calcAvg(s.id) })).sort((a, b) => b.avg - a.avg);
    const classRank = classRankings.findIndex(r => r.id === student.id) + 1;

    const allActive = allStudents.filter(s => s.status === "active");
    const allRankings = allActive.map(s => ({ id: s.id, avg: calcAvg(s.id) })).sort((a, b) => b.avg - a.avg);
    const schoolRank = allRankings.findIndex(r => r.id === student.id) + 1;

    const progressionIndex = classRankings.length > 0
      ? Math.round(((classRankings.length - classRank) / classRankings.length) * 100) : 0;

    let dropoutRisk = 0;
    if (overallAvg !== null && overallAvg < 8) dropoutRisk += 40;
    else if (overallAvg !== null && overallAvg < 10) dropoutRisk += 20;
    if (absenceRate > 20) dropoutRisk += 30;
    else if (absenceRate > 10) dropoutRisk += 15;
    if (activeSanctions >= 3) dropoutRisk += 20;
    else if (activeSanctions >= 1) dropoutRisk += 10;
    if (trend !== undefined && trend < -2) dropoutRisk += 10;
    dropoutRisk = Math.min(100, dropoutRisk);

    return {
      overallAvg, subjectAverages, monthlyEvolution, absences, lates, absenceRate,
      behaviorIndex, progressionIndex, dropoutRisk, classRank,
      classSize: classRankings.length, schoolRank, schoolSize: allRankings.length, trend
    };
  }, [student, grades, exams, subjects, attendance, sanctions, allStudents]);

  if (!analytics) return null;

  const getRiskColor = (r) => r >= 50 ? "red" : r >= 25 ? "orange" : "green";

  return (
    <div className="space-y-5">
      {/* Banner */}
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
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{analytics.overallAvg !== null ? analytics.overallAvg.toFixed(2) : "—"}</div>
              <div className="text-blue-200 text-xs">Moyenne générale /20</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Moyenne générale" value={analytics.overallAvg !== null ? `${analytics.overallAvg.toFixed(2)}/20` : "—"} icon={BookOpen} color={analytics.overallAvg !== null && analytics.overallAvg < 10 ? "red" : "blue"} trend={analytics.trend} />
        <KPICard title="Taux d'absence" value={`${analytics.absenceRate.toFixed(1)}%`} subtitle={`${analytics.absences} abs. · ${analytics.lates} ret.`} icon={Calendar} color={analytics.absenceRate > 15 ? "red" : analytics.absenceRate > 8 ? "orange" : "green"} />
        <KPICard title="Comportement" value={`${analytics.behaviorIndex.toFixed(1)}/10`} icon={ShieldAlert} color={analytics.behaviorIndex < 5 ? "red" : analytics.behaviorIndex < 7 ? "orange" : "green"} />
        <KPICard title="Risque décrochage" value={`${analytics.dropoutRisk}%`} icon={AlertTriangle} color={getRiskColor(analytics.dropoutRisk)} />
        <KPICard title="Progression" value={`${analytics.progressionIndex}%`} subtitle="Percentile classe" icon={TrendingUp} color="purple" />
        <KPICard title="Rang classe" value={analytics.classRank > 0 ? `${analytics.classRank}/${analytics.classSize}` : "—"} icon={Users} color="slate" />
        <KPICard title="Rang établissement" value={analytics.schoolRank > 0 ? `${analytics.schoolRank}/${analytics.schoolSize}` : "—"} icon={Award} color="slate" />
        <KPICard title="Matières évaluées" value={analytics.subjectAverages.length} icon={Target} color="indigo" />
      </div>

      {/* Dropout alert */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${analytics.dropoutRisk >= 50 ? "bg-red-50 border-red-300 text-red-800" : analytics.dropoutRisk >= 25 ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-green-50 border-green-300 text-green-800"}`}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm">Risque de décrochage : {analytics.dropoutRisk}%</span>
        <span className="text-sm opacity-80">
          {analytics.dropoutRisk >= 50 ? "— Intervention urgente" : analytics.dropoutRisk >= 25 ? "— Surveillance renforcée" : "— Profil stable"}
        </span>
        <Badge className="ml-auto" variant="outline">{analytics.dropoutRisk >= 50 ? "Critique" : analytics.dropoutRisk >= 25 ? "Attention" : "Stable"}</Badge>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution mensuelle</CardTitle></CardHeader>
          <CardContent>
            {analytics.monthlyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics.monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v.toFixed(2), "Moyenne"]} />
                  <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Radar par matière</CardTitle></CardHeader>
          <CardContent>
            {analytics.subjectAverages.length >= 3 ? (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={analytics.subjectAverages.map(s => ({ subject: s.name.slice(0, 8), avg: s.avg }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <Radar dataKey="avg" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Moyenne par matière</CardTitle></CardHeader>
          <CardContent>
            {analytics.subjectAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics.subjectAverages} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v) => [v.toFixed(2), "Moyenne"]} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} fill="#3b82f6" label={{ position: "right", formatter: (v) => v.toFixed(1), fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Données insuffisantes</div>;
}

// ─── Direction overview (global KPIs + charts) ─────────────────────────────────
function DirectionOverview({ students, grades, exams, subjects, classes, attendance, sanctions, filters }) {
  const stats = useMemo(() => {
    let filtStudents = students.filter(s => s.status === "active");
    if (filters.classId) filtStudents = filtStudents.filter(s => s.class_id === filters.classId);
    if (filters.level) {
      const lvlClassIds = classes.filter(c => c.level === filters.level).map(c => c.id);
      filtStudents = filtStudents.filter(s => lvlClassIds.includes(s.class_id));
    }
    if (filters.schoolYear) {
      const syClassIds = classes.filter(c => c.school_year === filters.schoolYear).map(c => c.id);
      filtStudents = filtStudents.filter(s => syClassIds.includes(s.class_id));
    }

    const studentIds = filtStudents.map(s => s.id);

    let filtExams = exams;
    if (filters.subjectId) filtExams = filtExams.filter(e => e.subject_id === filters.subjectId);
    if (filters.classId) filtExams = filtExams.filter(e => e.class_id === filters.classId);

    const examIds = filtExams.map(e => e.id);
    const filtGrades = grades.filter(g => studentIds.includes(g.student_id) && examIds.includes(g.exam_id) && !g.absent && g.score != null);

    const allScores = filtGrades.map(g => g.score);
    const globalAvg = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : "—";
    const successRate = allScores.length ? ((allScores.filter(s => s >= 10).length / allScores.length) * 100).toFixed(1) : "—";

    const filtAtt = attendance.filter(a => studentIds.includes(a.student_id));
    const absentCount = filtAtt.filter(a => a.status === "absent").length;
    const absentRate = filtAtt.length ? ((absentCount / filtAtt.length) * 100).toFixed(1) : "—";
    const activeSanctions = sanctions.filter(s => studentIds.includes(s.student_id) && !s.resolved).length;

    const displayClasses = filters.classId
      ? classes.filter(c => c.id === filters.classId)
      : filters.level ? classes.filter(c => c.level === filters.level)
      : classes;

    const byClass = displayClasses.map(cls => {
      const cs = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const ce = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const cg = grades.filter(g => cs.includes(g.student_id) && ce.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = cg.length ? (cg.reduce((a, b) => a + b.score, 0) / cg.length).toFixed(1) : 0;
      return { name: cls.name, moyenne: parseFloat(avg), effectif: cs.length };
    }).filter(c => c.effectif > 0);

    const bySubject = subjects.map(sub => {
      const se = filtExams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const sg = filtGrades.filter(g => se.includes(g.exam_id));
      const avg = sg.length ? (sg.reduce((a, b) => a + b.score, 0) / sg.length).toFixed(1) : 0;
      return { name: sub.name, moyenne: parseFloat(avg), count: se.length };
    }).filter(s => s.count > 0);

    const byTrimester = ["T1", "T2", "T3"].map(t => {
      const te = filtExams.filter(e => e.trimester === t).map(e => e.id);
      const tg = filtGrades.filter(g => te.includes(g.exam_id));
      const avg = tg.length ? (tg.reduce((a, b) => a + b.score, 0) / tg.length).toFixed(1) : null;
      return { name: t, moyenne: avg ? parseFloat(avg) : null };
    }).filter(t => t.moyenne !== null);

    const boys = filtStudents.filter(s => s.gender === "M").length;
    const girls = filtStudents.filter(s => s.gender === "F").length;

    return { globalAvg, successRate, absentRate, activeSanctions, byClass, bySubject, byTrimester, boys, girls, total: filtStudents.length };
  }, [students, grades, exams, subjects, classes, attendance, sanctions, filters]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Moyenne générale" value={`${stats.globalAvg}/20`} icon={Award} color="indigo" />
        <KPICard title="Taux de réussite" value={`${stats.successRate}%`} icon={TrendingUp} color="green" />
        <KPICard title="Absentéisme" value={`${stats.absentRate}%`} icon={Calendar} color="orange" />
        <KPICard title="Sanctions actives" value={stats.activeSanctions} icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {stats.byClass.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Moyenne par classe</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
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
        )}

        {stats.byTrimester.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution trimestrielle</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.byTrimester}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 20]} />
                  <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                  <Line type="monotone" dataKey="moyenne" stroke="#6366f1" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {stats.bySubject.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Performance par matière</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.bySubject} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                  <Bar dataKey="moyenne" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition des élèves</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={[{ name: "Garçons", value: stats.boys }, { name: "Filles", value: stats.girls }]} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    <Cell fill="#6366f1" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-xs text-slate-500">élèves actifs</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center"><p className="font-bold text-indigo-600">{stats.boys}</p><p className="text-slate-500 text-xs">Garçons</p></div>
                  <div className="text-center"><p className="font-bold text-pink-600">{stats.girls}</p><p className="text-slate-500 text-xs">Filles</p></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Pilotage() {
  const role = currentRole();
  const [filters, setFilters] = useState({ schoolYear: null, classId: null, level: null, subjectId: null, studentId: null });

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: schoolYears = [] } = useQuery({ queryKey: ["schoolYears"], queryFn: () => base44.entities.SchoolYear.list() });

  const isParent = role === "parent";
  const isTeacher = role === "enseignant";
  const isDirector = ["directeur_general", "directeur_primaire", "directeur_college", "directeur_lycee"].includes(role);
  const isGeneralDirector = role === "directeur_general";

  // For parent: find student(s) by parent_email
  const parentStudents = useMemo(() => {
    if (!isParent) return [];
    // In demo mode, show first active students as fallback
    return students.filter(s => s.status === "active").slice(0, 3);
  }, [students, isParent]);

  // The student to display (for parent auto-select, for others via filter)
  const selectedStudent = useMemo(() => {
    if (isParent) return parentStudents[0] || null;
    if (filters.studentId) return students.find(s => s.id === filters.studentId) || null;
    return null;
  }, [isParent, parentStudents, filters.studentId, students]);

  const showFilters = isTeacher || isDirector;

  // Determine tabs based on role
  const tabs = useMemo(() => {
    if (isParent) return ["eleve"];
    if (isTeacher) return ["performance", "eleve", "alertes"];
    if (isDirector) return ["vue_globale", "eleve", "enseignants", "alertes"];
    return ["vue_globale", "eleve", "enseignants", "alertes"];
  }, [isParent, isTeacher, isDirector]);

  const defaultTab = tabs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="text-4xl">📊</div>
          <div>
            <h1 className="text-2xl font-bold">Pilotage & Performance</h1>
            <p className="text-white/80 text-sm">Tableau de bord analytique — Suivi des élèves, classes et établissement</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className={`grid w-full grid-cols-${tabs.length}`}>
          {tabs.includes("vue_globale") && (
            <TabsTrigger value="vue_globale" className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Vue globale
            </TabsTrigger>
          )}
          {tabs.includes("performance") && (
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Performance classes
            </TabsTrigger>
          )}
          {tabs.includes("eleve") && (
            <TabsTrigger value="eleve" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> {isParent ? "Mon enfant" : "Élève 360°"}
            </TabsTrigger>
          )}
          {tabs.includes("enseignants") && (
            <TabsTrigger value="enseignants" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Enseignants
            </TabsTrigger>
          )}
          {tabs.includes("alertes") && (
            <TabsTrigger value="alertes" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alertes
            </TabsTrigger>
          )}
        </TabsList>

        {/* Vue globale */}
        {tabs.includes("vue_globale") && (
          <TabsContent value="vue_globale" className="mt-4 space-y-4">
            {showFilters && (
              <FiltersBar schoolYears={schoolYears} classes={classes} subjects={subjects} students={students} filters={filters} onChange={setFilters} />
            )}
            <DirectionOverview students={students} grades={grades} exams={exams} subjects={subjects} classes={classes} attendance={attendance} sanctions={sanctions} filters={filters} />
          </TabsContent>
        )}

        {/* Élève 360° */}
        {tabs.includes("eleve") && (
          <TabsContent value="eleve" className="mt-4 space-y-4">
            {/* Parent: multi-child selector */}
            {isParent && parentStudents.length > 1 && (
              <div className="flex gap-2">
                {parentStudents.map(s => (
                  <Button key={s.id} variant={selectedStudent?.id === s.id ? "default" : "outline"} size="sm"
                    onClick={() => setFilters(f => ({ ...f, studentId: s.id }))}>
                    {s.first_name} {s.last_name}
                  </Button>
                ))}
              </div>
            )}

            {/* Teacher/Director: full filters */}
            {showFilters && (
              <FiltersBar schoolYears={schoolYears} classes={classes} subjects={subjects} students={students} filters={filters} onChange={setFilters} />
            )}

            {selectedStudent ? (
              <Student360 student={selectedStudent} grades={grades} exams={exams} subjects={subjects} attendance={attendance} sanctions={sanctions} classes={classes} allStudents={students} />
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Sélectionnez un élève pour voir son profil 360°</p>
                  <p className="text-sm mt-1">Utilisez les filtres ci-dessus pour choisir une classe puis un élève</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Enseignants */}
        {tabs.includes("enseignants") && (
          <TabsContent value="enseignants" className="mt-4">
            <TeacherAnalytics />
          </TabsContent>
        )}

        {/* Alertes */}
        {tabs.includes("alertes") && (
          <TabsContent value="alertes" className="mt-4">
            <EarlyWarningSystem />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}