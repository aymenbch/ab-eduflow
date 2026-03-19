/**
 * Dashboard.jsx — Tableau de bord BI multi-profils
 *
 * Un dashboard riche et adapté pour chaque rôle :
 *   admin_systeme       → Vue système : utilisateurs, entités, santé globale
 *   directeur_*         → Vue direction : pilotage pédagogique et financier
 *   cpe                 → Vie scolaire : absences, sanctions, élèves à risque
 *   enseignant          → Pilotage classe : notes, devoirs, présence
 *   secretaire          → Administratif : inscriptions, événements, communications
 *   comptable           → Finance : paiements, impayés, masse salariale
 *   eleve               → Personnel : mes notes, présence, devoirs
 *   parent              → Suivi enfant : notes, présence, comportement
 */

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, parseISO, isValid, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Users, GraduationCap, School, BookOpen, Calendar, AlertTriangle,
  MessageSquare, TrendingUp, TrendingDown, FileText, CheckCircle2, Clock,
  Award, DollarSign, CreditCard, Briefcase, ShieldCheck, Activity,
  BarChart2, UserCheck, UserX, Star, Target, Bell, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import FinanceWidget from "@/components/dashboard/FinanceWidget";

// ─── Palette de couleurs ──────────────────────────────────────────────────────
const PALETTE = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function safeAvg(grades) {
  const valid = grades.filter(g => !g.absent && g.score != null).map(g => g.score);
  return valid.length ? (avg(valid)).toFixed(1) : null;
}

function attendanceStats(records) {
  const cutoff = subDays(new Date(), 30);
  const recent = records.filter(a => {
    if (!a.date) return false;
    try { const d = parseISO(a.date); return isValid(d) && d >= cutoff; } catch { return false; }
  });
  if (!recent.length) return { rate: null, present: 0, absent: 0, late: 0, total: 0 };
  const present = recent.filter(a => a.status === "present").length;
  const late    = recent.filter(a => a.status === "late").length;
  const absent  = recent.filter(a => a.status === "absent").length;
  return { rate: Math.round(((present + late) / recent.length) * 100), present, absent, late, total: recent.length };
}

// Regroupe les paiements par mois sur les 6 derniers mois
function paymentsByMonth(payments) {
  const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
  return months.map(m => {
    const label = format(m, "MMM", { locale: fr });
    const start = startOfMonth(m);
    const end   = endOfMonth(m);
    const monthPayments = payments.filter(p => {
      if (!p.payment_date) return false;
      try { const d = parseISO(p.payment_date); return isValid(d) && d >= start && d <= end; } catch { return false; }
    });
    const collected = monthPayments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount_paid || p.amount || 0), 0);
    const expected  = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    return { label, collected: Math.round(collected), expected: Math.round(expected) };
  });
}

// ─── Composants communs ───────────────────────────────────────────────────────

function KPI({ icon, label, value, sub, color = "indigo", trend, trendUp }) {
  const bg = {
    indigo: "bg-indigo-50 border-indigo-100", green: "bg-emerald-50 border-emerald-100",
    blue: "bg-blue-50 border-blue-100", orange: "bg-orange-50 border-orange-100",
    red: "bg-red-50 border-red-100", purple: "bg-purple-50 border-purple-100",
    teal: "bg-teal-50 border-teal-100", pink: "bg-pink-50 border-pink-100",
    amber: "bg-amber-50 border-amber-100", gray: "bg-slate-50 border-slate-100",
  };
  const ic = {
    indigo: "text-indigo-600", green: "text-emerald-600", blue: "text-blue-600",
    orange: "text-orange-600", red: "text-red-600", purple: "text-purple-600",
    teal: "text-teal-600", pink: "text-pink-600", amber: "text-amber-600", gray: "text-slate-500",
  };
  return (
    <Card className={`border ${bg[color]}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900 truncate">{value ?? "—"}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
              </div>
            )}
          </div>
          <div className={`p-2.5 bg-white rounded-xl shadow-sm flex-shrink-0 ml-3 ${ic[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ gradient, emoji, title, subtitle }) {
  return (
    <div className={`rounded-2xl p-7 text-white bg-gradient-to-r ${gradient} mb-6`}>
      <div className="flex items-center gap-4">
        <span className="text-5xl">{emoji}</span>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-white/75 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ h = 200 }) {
  return <div className={`flex items-center justify-center text-slate-400 text-sm`} style={{ height: h }}>Données insuffisantes</div>;
}

function AttendanceBar({ present, absent, late, total }) {
  if (!total) return <p className="text-slate-400 text-sm">Aucun pointage</p>;
  return (
    <div className="space-y-3">
      {[
        { label: "Présents", count: present, color: "bg-emerald-500", pct: Math.round((present / total) * 100) },
        { label: "Retards",  count: late,    color: "bg-amber-400",   pct: Math.round((late    / total) * 100) },
        { label: "Absents",  count: absent,  color: "bg-red-500",     pct: Math.round((absent  / total) * 100) },
      ].map(({ label, count, color, pct }) => (
        <div key={label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400">{total} pointages · 30 derniers jours</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ADMIN SYSTÈME
// ═══════════════════════════════════════════════════════════════════════════════

function AdminSystemeDashboard() {
  const { data: users     = [] } = useQuery({ queryKey: ["appusers"],   queryFn: () => base44.entities.AppUser.list() });
  const { data: students  = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: teachers  = [] } = useQuery({ queryKey: ["teachers"],   queryFn: () => base44.entities.Teacher.list() });
  const { data: staff     = [] } = useQuery({ queryKey: ["staff"],      queryFn: () => base44.entities.Staff.list() });
  const { data: classes   = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });
  const { data: subjects  = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });

  const stats = useMemo(() => {
    const active    = users.filter(u => u.status === "active").length;
    const suspended = users.filter(u => u.status === "suspended").length;
    const byRole    = Object.entries(
      users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {})
    ).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);

    const byType = [
      { name: "Élèves",      value: students.filter(s => s.status === "active").length,  fill: "#6366f1" },
      { name: "Enseignants", value: teachers.filter(t => t.status === "active").length,  fill: "#10b981" },
      { name: "Personnel",   value: staff.filter(s => s.status === "active").length,     fill: "#f59e0b" },
    ];

    return { active, suspended, total: users.length, byRole, byType };
  }, [users, students, teachers, staff]);

  const ROLE_LABELS = {
    admin_systeme: "Admin Système", admin: "Admin", directeur_general: "Dir. Général",
    directeur_primaire: "Dir. Primaire", directeur_college: "Dir. Collège",
    directeur_lycee: "Dir. Lycée", cpe: "CPE", enseignant: "Enseignant",
    secretaire: "Secrétaire", comptable: "Comptable", eleve: "Élève", parent: "Parent",
  };

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-slate-700 to-slate-900" emoji="🛡️"
        title="Administration Système" subtitle="Vue globale de la plateforme · Tous modules" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<Users className="w-5 h-5" />}        label="Comptes actifs"    value={stats.active}    sub={`${stats.total} total`}     color="indigo" />
        <KPI icon={<UserX className="w-5 h-5" />}         label="Comptes suspendus" value={stats.suspended}                                   color={stats.suspended > 0 ? "red" : "green"} />
        <KPI icon={<School className="w-5 h-5" />}        label="Classes"           value={classes.length}                                    color="blue" />
        <KPI icon={<BookOpen className="w-5 h-5" />}      label="Matières"          value={subjects.length}                                   color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comptes par rôle */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" />Comptes par rôle</CardTitle></CardHeader>
          <CardContent>
            {stats.byRole.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.byRole} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="role" type="category" width={110}
                    tickFormatter={r => ROLE_LABELS[r] || r} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n, p) => [v, ROLE_LABELS[p.payload.role] || p.payload.role]} />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Répartition des membres actifs */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-green-500" />Membres actifs</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={stats.byType} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {stats.byType.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {stats.byType.map(e => (
                  <div key={e.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: e.fill }} />
                    <span className="text-sm text-slate-600">{e.name}</span>
                    <span className="ml-auto font-bold text-slate-900">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entités du système */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-500" />Santé du système</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Élèves",           val: students.length,  icon: "👨‍🎓", color: "bg-indigo-100 text-indigo-700" },
              { label: "Enseignants",      val: teachers.length,  icon: "👨‍🏫", color: "bg-green-100 text-green-700" },
              { label: "Personnel admin",  val: staff.length,     icon: "🏢",   color: "bg-amber-100 text-amber-700" },
              { label: "Comptes totaux",   val: users.length,     icon: "🔑",   color: "bg-purple-100 text-purple-700" },
            ].map(({ label, val, icon, color }) => (
              <div key={label} className={`rounded-xl p-4 ${color} flex items-center gap-3`}>
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-xs font-medium opacity-75">{label}</p>
                  <p className="text-xl font-bold">{val}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DIRECTION (directeur_* + secretaire)
// ═══════════════════════════════════════════════════════════════════════════════

function DirectionDashboard() {
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: teachers   = [] } = useQuery({ queryKey: ["teachers"],   queryFn: () => base44.entities.Teacher.list() });
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });
  const { data: grades     = [] } = useQuery({ queryKey: ["grades"],     queryFn: () => base44.entities.Grade.list() });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],      queryFn: () => base44.entities.Exam.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions  = [] } = useQuery({ queryKey: ["sanctions"],  queryFn: () => base44.entities.Sanction.list() });
  const { data: events     = [] } = useQuery({ queryKey: ["events"],     queryFn: () => base44.entities.Event.list() });
  const { data: payments   = [] } = useQuery({ queryKey: ["payments"],   queryFn: () => base44.entities.Payment.list() });

  const stats = useMemo(() => {
    const activeStudents = students.filter(s => s.status === "active");
    const validGrades    = grades.filter(g => !g.absent && g.score != null);
    const globalAvg      = safeAvg(grades);
    const successRate    = validGrades.length ? ((validGrades.filter(g => g.score >= 10).length / validGrades.length) * 100).toFixed(1) : 0;

    const att = attendanceStats(attendance);

    // Moyenne par classe
    const byClass = classes.map(cls => {
      const ids      = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const examIds  = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const cGrades  = grades.filter(g => ids.includes(g.student_id) && examIds.includes(g.exam_id) && !g.absent && g.score != null);
      return { name: cls.name, moyenne: cGrades.length ? parseFloat((avg(cGrades.map(g => g.score))).toFixed(1)) : 0, effectif: ids.length };
    }).filter(c => c.effectif > 0);

    // Moyenne par matière
    const bySubject = subjects.map(sub => {
      const eIds    = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const sGrades = grades.filter(g => eIds.includes(g.exam_id) && !g.absent && g.score != null);
      return { name: sub.name.length > 12 ? sub.name.slice(0, 12) + "…" : sub.name, moyenne: sGrades.length ? parseFloat((avg(sGrades.map(g => g.score))).toFixed(1)) : 0, nb: eIds.length };
    }).filter(s => s.nb > 0).sort((a, b) => b.moyenne - a.moyenne);

    // Évolution trimestrielle
    const byTrimester = ["T1", "T2", "T3"].map(t => {
      const eIds = exams.filter(e => e.trimester === t).map(e => e.id);
      const tG   = grades.filter(g => eIds.includes(g.exam_id) && !g.absent && g.score != null);
      return { name: t, moyenne: tG.length ? parseFloat((avg(tG.map(g => g.score))).toFixed(1)) : null };
    }).filter(t => t.moyenne !== null);

    // Genre
    const boys  = activeStudents.filter(s => s.gender === "M").length;
    const girls = activeStudents.filter(s => s.gender === "F").length;

    // Absences par classe (30j)
    const cutoff = subDays(new Date(), 30);
    const byClassAtt = classes.map(cls => {
      const ids = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const absents = attendance.filter(a => {
        if (!a.date || !ids.includes(a.student_id)) return false;
        try { const d = parseISO(a.date); return isValid(d) && d >= cutoff && a.status === "absent"; } catch { return false; }
      }).length;
      return { name: cls.name, absences: absents };
    }).filter(c => c.absences > 0).sort((a, b) => b.absences - a.absences).slice(0, 8);

    // Finances
    const paid       = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount_paid || p.amount || 0), 0);
    const outstanding = payments.filter(p => p.status !== "paid").reduce((s, p) => s + (p.amount || 0), 0);
    const collectionRate = payments.length ? ((payments.filter(p => p.status === "paid").length / payments.length) * 100).toFixed(1) : 0;

    return {
      activeStudents: activeStudents.length, totalStudents: students.length,
      activeTeachers: teachers.filter(t => t.status === "active").length,
      totalClasses: classes.length, totalSubjects: subjects.length,
      globalAvg, successRate, att, byClass, bySubject, byTrimester,
      boys, girls, byClassAtt,
      sanctionsActive: sanctions.filter(s => !s.resolved).length,
      upcomingEvents: (events || []).filter(e => e.date && new Date(e.date) >= new Date()).length,
      paid: Math.round(paid), outstanding: Math.round(outstanding), collectionRate,
    };
  }, [students, teachers, classes, subjects, grades, exams, attendance, sanctions, events, payments]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-indigo-600 to-violet-600" emoji="🎓"
        title="Tableau de bord Direction" subtitle="Pilotage pédagogique et administratif en temps réel" />

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<Users className="w-5 h-5" />}        label="Élèves actifs"     value={stats.activeStudents}      sub={`${stats.totalStudents} inscrits`}       color="indigo" />
        <KPI icon={<GraduationCap className="w-5 h-5" />} label="Enseignants"       value={stats.activeTeachers}                                                   color="green" />
        <KPI icon={<Award className="w-5 h-5" />}         label="Moyenne générale"  value={stats.globalAvg ? `${stats.globalAvg}/20` : "—"}                       color="purple" />
        <KPI icon={<TrendingUp className="w-5 h-5" />}    label="Taux de réussite"  value={`${stats.successRate}%`}                                                color="teal" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<UserCheck className="w-5 h-5" />}     label="Présence (30j)"    value={stats.att.rate != null ? `${stats.att.rate}%` : "—"}
          sub={stats.att.total ? `${stats.att.absent} absences` : undefined}
          color={stats.att.rate == null ? "gray" : stats.att.rate >= 90 ? "green" : stats.att.rate >= 75 ? "amber" : "red"} />
        <KPI icon={<AlertTriangle className="w-5 h-5" />} label="Sanctions actives" value={stats.sanctionsActive}  color={stats.sanctionsActive > 0 ? "orange" : "green"} />
        <KPI icon={<CreditCard className="w-5 h-5" />}    label="Taux de recouvr."  value={`${stats.collectionRate}%`}  sub={`${stats.outstanding.toLocaleString()} DA impayés`}  color="blue" />
        <KPI icon={<Calendar className="w-5 h-5" />}      label="Événements à venir" value={stats.upcomingEvents}  color="pink" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyenne par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Moyenne par classe</CardTitle></CardHeader>
          <CardContent>
            {stats.byClass.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.byClass}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} />
                  <Tooltip formatter={v => [`${v}/20`, "Moyenne"]} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Seuil 10", position: "right", fontSize: 10 }} />
                  <Bar dataKey="moyenne" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {stats.byClass.map((e, i) => <Cell key={i} fill={e.moyenne >= 10 ? "#6366f1" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
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
                  <Tooltip formatter={v => [`${v}/20`, "Moyenne"]} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="moyenne" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: "#6366f1" }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Performance par matière */}
        <Card>
          <CardHeader><CardTitle className="text-base">📚 Performance par matière</CardTitle></CardHeader>
          <CardContent>
            {stats.bySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.bySubject} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [`${v}/20`, "Moyenne"]} />
                  <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="moyenne" radius={[0, 4, 4, 0]}>
                    {stats.bySubject.map((e, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Absences par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">🚨 Absences par classe (30j)</CardTitle></CardHeader>
          <CardContent>
            {stats.byClassAtt.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.byClassAtt}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={v => [v, "Absences"]} />
                  <Bar dataKey="absences" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Aucune absence enregistrée ces 30 derniers jours</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Répartition genre + Présence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">👥 Répartition par genre</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={[{ name: "Garçons", value: stats.boys }, { name: "Filles", value: stats.girls }]}
                    cx="50%" cy="50%" outerRadius={75} dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    <Cell fill="#6366f1" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.activeStudents}</p>
                  <p className="text-xs text-slate-500">élèves actifs</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center"><p className="font-bold text-indigo-600">{stats.boys}</p><p className="text-slate-500 text-xs">Garçons</p></div>
                  <div className="text-center"><p className="font-bold text-pink-600">{stats.girls}</p><p className="text-slate-500 text-xs">Filles</p></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">✅ Présence — 30 derniers jours</CardTitle></CardHeader>
          <CardContent>
            <AttendanceBar {...stats.att} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CPE
// ═══════════════════════════════════════════════════════════════════════════════

function CPEDashboard() {
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: sanctions  = [] } = useQuery({ queryKey: ["sanctions"],  queryFn: () => base44.entities.Sanction.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });
  const { data: messages   = [] } = useQuery({ queryKey: ["messages"],   queryFn: () => base44.entities.Message.list() });

  const stats = useMemo(() => {
    const att = attendanceStats(attendance);
    const activeSanctions = sanctions.filter(s => !s.resolved);

    // Sanctions par type
    const bySanctionType = Object.entries(
      sanctions.reduce((acc, s) => { acc[s.type || "Autre"] = (acc[s.type || "Autre"] || 0) + 1; return acc; }, {})
    ).map(([type, value]) => ({ type, value }));

    // Absences par classe (30j)
    const cutoff = subDays(new Date(), 30);
    const byClassAtt = classes.map(cls => {
      const ids = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const absents = attendance.filter(a => {
        if (!a.date || !ids.includes(a.student_id)) return false;
        try { const d = parseISO(a.date); return isValid(d) && d >= cutoff && a.status === "absent"; } catch { return false; }
      }).length;
      return { name: cls.name, absences: absents };
    }).filter(c => c.absences > 0).sort((a, b) => b.absences - a.absences);

    // Élèves à risque (> 5 absences sur 30j)
    const absentsByStudent = attendance.filter(a => {
      if (!a.date || a.status !== "absent") return false;
      try { const d = parseISO(a.date); return isValid(d) && d >= cutoff; } catch { return false; }
    }).reduce((acc, a) => { acc[a.student_id] = (acc[a.student_id] || 0) + 1; return acc; }, {});

    const atRisk = Object.entries(absentsByStudent)
      .filter(([, count]) => count >= 5)
      .map(([id, count]) => {
        const s = students.find(s => s.id === id);
        const cls = s ? classes.find(c => c.id === s.class_id) : null;
        return { name: s ? `${s.first_name} ${s.last_name}` : "—", absences: count, classe: cls?.name || "—" };
      })
      .sort((a, b) => b.absences - a.absences).slice(0, 10);

    // Évolution hebdomadaire des absences (4 dernières semaines)
    const weeklyTrend = [3, 2, 1, 0].map(weeksAgo => {
      const start = subDays(new Date(), (weeksAgo + 1) * 7);
      const end   = subDays(new Date(), weeksAgo * 7);
      const absents = attendance.filter(a => {
        if (!a.date || a.status !== "absent") return false;
        try { const d = parseISO(a.date); return isValid(d) && d >= start && d < end; } catch { return false; }
      }).length;
      return { semaine: `S-${weeksAgo === 0 ? "Actuelle" : weeksAgo * 7 + "j"}`, absences: absents };
    });

    return { att, activeSanctions, bySanctionType, byClassAtt, atRisk, weeklyTrend, unreadMessages: messages.filter(m => !m.read).length };
  }, [students, sanctions, attendance, classes, messages]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-orange-500 to-rose-600" emoji="🏫"
        title="Vie Scolaire — CPE" subtitle="Suivi des présences, sanctions et élèves en difficulté" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<UserCheck className="w-5 h-5" />}     label="Présence (30j)"    value={stats.att.rate != null ? `${stats.att.rate}%` : "—"}  color={stats.att.rate == null ? "gray" : stats.att.rate >= 90 ? "green" : "orange"} />
        <KPI icon={<UserX className="w-5 h-5" />}          label="Absences (30j)"    value={stats.att.absent}  sub={`${stats.att.late} retards`}  color="red" />
        <KPI icon={<AlertTriangle className="w-5 h-5" />}  label="Sanctions actives" value={stats.activeSanctions.length}                          color={stats.activeSanctions.length > 0 ? "orange" : "green"} />
        <KPI icon={<MessageSquare className="w-5 h-5" />}  label="Messages non lus"  value={stats.unreadMessages}                                  color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Absences par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">🏫 Absences par classe (30j)</CardTitle></CardHeader>
          <CardContent>
            {stats.byClassAtt.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byClassAtt}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={v => [v, "Absences"]} />
                  <Bar dataKey="absences" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 flex-col gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-slate-500 text-sm">Aucune absence ces 30 derniers jours</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tendance hebdomadaire */}
        <Card>
          <CardHeader><CardTitle className="text-base">📉 Tendance des absences (4 semaines)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semaine" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={v => [v, "Absences"]} />
                <Line type="monotone" dataKey="absences" stroke="#f97316" strokeWidth={2} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sanctions par type */}
        <Card>
          <CardHeader><CardTitle className="text-base">⚠️ Sanctions par type</CardTitle></CardHeader>
          <CardContent>
            {stats.bySanctionType.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={stats.bySanctionType} dataKey="value" nameKey="type" cx="50%" cy="50%" outerRadius={75}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.bySanctionType.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {stats.bySanctionType.map((s, i) => (
                    <div key={s.type} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-sm text-slate-600 truncate">{s.type}</span>
                      <span className="ml-auto font-bold text-slate-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Élèves à risque */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Élèves à risque (≥5 absences)</CardTitle></CardHeader>
          <CardContent>
            {stats.atRisk.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-auto">
                {stats.atRisk.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.classe}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 font-bold">{s.absences} abs.</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 flex-col gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-slate-500 text-sm">Aucun élève à risque</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sanctions récentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Sanctions actives récentes</CardTitle></CardHeader>
        <CardContent>
          {stats.activeSanctions.length > 0 ? (
            <div className="space-y-2">
              {stats.activeSanctions.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100">
                  <div>
                    <p className="font-medium text-sm">{s.reason}</p>
                    <p className="text-xs text-slate-500">{s.type} · {s.date}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700">En cours</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">Aucune sanction active 🎉</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ENSEIGNANT
// ═══════════════════════════════════════════════════════════════════════════════

function EnseignantDashboard({ session }) {
  const memberId = session?.member_id;
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });
  const { data: grades     = [] } = useQuery({ queryKey: ["grades"],     queryFn: () => base44.entities.Grade.list() });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],      queryFn: () => base44.entities.Exam.list() });
  const { data: homework   = [] } = useQuery({ queryKey: ["homework"],   queryFn: () => base44.entities.Homework.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: messages   = [] } = useQuery({ queryKey: ["messages"],   queryFn: () => base44.entities.Message.list() });

  const stats = useMemo(() => {
    // Examens de cet enseignant
    const myExams   = memberId ? exams.filter(e => e.teacher_id === memberId) : exams;
    const myExamIds = myExams.map(e => e.id);

    // Classes où il enseigne
    const myClassIds = [...new Set(myExams.map(e => e.class_id).filter(Boolean))];
    const myClasses  = classes.filter(c => myClassIds.includes(c.id));

    // Notes de ses examens
    const myGrades = grades.filter(g => myExamIds.includes(g.exam_id));
    const globalAvg = safeAvg(myGrades);

    // Moyenne par classe
    const byClass = myClasses.map(cls => {
      const clsExamIds = myExams.filter(e => e.class_id === cls.id).map(e => e.id);
      const clsGrades  = myGrades.filter(g => clsExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      const studentIds = students.filter(s => s.class_id === cls.id).map(s => s.id);
      return {
        name: cls.name,
        moyenne: clsGrades.length ? parseFloat((avg(clsGrades.map(g => g.score))).toFixed(1)) : 0,
        effectif: studentIds.length,
      };
    }).filter(c => c.effectif > 0);

    // Distribution des notes
    const validScores = myGrades.filter(g => !g.absent && g.score != null).map(g => g.score);
    const distribution = [
      { range: "0–5",   count: validScores.filter(s => s < 5).length },
      { range: "5–10",  count: validScores.filter(s => s >= 5 && s < 10).length },
      { range: "10–15", count: validScores.filter(s => s >= 10 && s < 15).length },
      { range: "15–20", count: validScores.filter(s => s >= 15).length },
    ];

    // Devoirs de cet enseignant
    const myHomework = memberId ? homework.filter(h => h.teacher_id === memberId) : homework;
    const upcomingHW = myHomework.filter(h => h.due_date && new Date(h.due_date) >= new Date()).slice(0, 5);

    // Examens à venir
    const upcomingExams = myExams.filter(e => e.date && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);

    // Présence dans ses classes (30j)
    const att = attendanceStats(attendance.filter(a => {
      const s = students.find(st => st.id === a.student_id);
      return s && myClassIds.includes(s.class_id);
    }));

    return {
      myClasses, myExams, globalAvg,
      byClass, distribution, upcomingHW, upcomingExams, att,
      unreadMessages: messages.filter(m => !m.read).length,
    };
  }, [classes, subjects, grades, exams, homework, attendance, students, messages, memberId]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-green-500 to-teal-600" emoji="👨‍🏫"
        title="Tableau de bord Enseignant" subtitle="Suivi de vos classes, notes et devoirs" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<School className="w-5 h-5" />}         label="Mes classes"      value={stats.myClasses.length}                                                   color="green" />
        <KPI icon={<FileText className="w-5 h-5" />}        label="Examens créés"    value={stats.myExams.length}                                                     color="blue" />
        <KPI icon={<Award className="w-5 h-5" />}           label="Moyenne classes"  value={stats.globalAvg ? `${stats.globalAvg}/20` : "—"}                         color="purple" />
        <KPI icon={<MessageSquare className="w-5 h-5" />}   label="Messages non lus" value={stats.unreadMessages}                                                     color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyenne par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Moyenne par classe</CardTitle></CardHeader>
          <CardContent>
            {stats.byClass.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byClass}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} />
                  <Tooltip formatter={v => [`${v}/20`, "Moyenne"]} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="moyenne" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {stats.byClass.map((e, i) => <Cell key={i} fill={e.moyenne >= 10 ? "#10b981" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Distribution des notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">📉 Distribution des notes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={v => [v, "Élèves"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <Cell fill="#ef4444" />
                  <Cell fill="#f97316" />
                  <Cell fill="#10b981" />
                  <Cell fill="#6366f1" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Présence dans mes classes */}
        <Card>
          <CardHeader><CardTitle className="text-base">✅ Présence dans mes classes (30j)</CardTitle></CardHeader>
          <CardContent>
            <AttendanceBar {...stats.att} />
          </CardContent>
        </Card>

        {/* Devoirs à venir */}
        <Card>
          <CardHeader><CardTitle className="text-base">📝 Mes devoirs à venir</CardTitle></CardHeader>
          <CardContent>
            {stats.upcomingHW.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingHW.map(hw => (
                  <div key={hw.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="font-medium text-sm truncate">{hw.title}</span>
                    <Badge variant="outline">{hw.due_date ? format(new Date(hw.due_date), "d MMM", { locale: fr }) : "—"}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucun devoir à venir</p>}
          </CardContent>
        </Card>
      </div>

      {/* Examens à venir */}
      {stats.upcomingExams.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">🗓️ Prochains examens</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.upcomingExams.map(e => {
                const cls = classes.find(c => c.id === e.class_id);
                const sub = subjects.find(s => s.id === e.subject_id);
                return (
                  <div key={e.id} className="p-3 rounded-lg border border-teal-100 bg-teal-50">
                    <p className="font-semibold text-sm text-teal-800">{e.title}</p>
                    <p className="text-xs text-teal-600">{cls?.name} · {sub?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{e.date ? format(new Date(e.date), "d MMM yyyy", { locale: fr }) : "—"}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SECRÉTAIRE
// ═══════════════════════════════════════════════════════════════════════════════

function SecretaireDashboard() {
  const { data: students  = [] } = useQuery({ queryKey: ["students"],  queryFn: () => base44.entities.Student.list() });
  const { data: classes   = [] } = useQuery({ queryKey: ["classes"],   queryFn: () => base44.entities.Class.list() });
  const { data: events    = [] } = useQuery({ queryKey: ["events"],    queryFn: () => base44.entities.Event.list() });
  const { data: messages  = [] } = useQuery({ queryKey: ["messages"],  queryFn: () => base44.entities.Message.list() });
  const { data: teachers  = [] } = useQuery({ queryKey: ["teachers"],  queryFn: () => base44.entities.Teacher.list() });

  const stats = useMemo(() => {
    const active   = students.filter(s => s.status === "active").length;
    const inactive = students.filter(s => s.status !== "active").length;

    // Inscriptions par niveau (basé sur le nom de la classe)
    const byLevel = [
      { level: "Primaire",  count: students.filter(s => { const c = classes.find(cl => cl.id === s.class_id); return c?.name?.match(/[1-5]ème?\s*[Aa]P|primaire/i); }).length },
      { level: "Collège",   count: students.filter(s => { const c = classes.find(cl => cl.id === s.class_id); return c?.name?.match(/[1-4]ème?\s*[Aa]M|collège/i); }).length },
      { level: "Lycée",     count: students.filter(s => { const c = classes.find(cl => cl.id === s.class_id); return c?.name?.match(/1ère?|[2-3]ème?\s*AS|lycée/i); }).length },
      { level: "Sans classe", count: students.filter(s => !s.class_id).length },
    ].filter(l => l.count > 0);

    // Par classe
    const byClass = classes.map(c => ({
      name: c.name, effectif: students.filter(s => s.class_id === c.id).length,
    })).filter(c => c.effectif > 0).sort((a, b) => b.effectif - a.effectif);

    // Événements à venir
    const upcomingEvents = events.filter(e => e.date && new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);

    // Derniers inscrits
    const recentStudents = [...students]
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)).slice(0, 5);

    return {
      active, inactive, total: students.length,
      byLevel, byClass, upcomingEvents, recentStudents,
      activeTeachers: teachers.filter(t => t.status === "active").length,
      unreadMessages: messages.filter(m => !m.read).length,
      totalClasses: classes.length,
    };
  }, [students, classes, events, messages, teachers]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-sky-500 to-blue-600" emoji="📋"
        title="Tableau de bord Secrétariat" subtitle="Gestion administrative · Inscriptions & communications" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<Users className="w-5 h-5" />}        label="Élèves inscrits"    value={stats.active}           sub={`${stats.total} total`}            color="blue" />
        <KPI icon={<School className="w-5 h-5" />}        label="Classes"            value={stats.totalClasses}                                              color="purple" />
        <KPI icon={<GraduationCap className="w-5 h-5" />} label="Enseignants actifs" value={stats.activeTeachers}                                            color="green" />
        <KPI icon={<MessageSquare className="w-5 h-5" />} label="Messages non lus"   value={stats.unreadMessages}                                            color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Effectif par classe */}
        <Card>
          <CardHeader><CardTitle className="text-base">👥 Effectif par classe</CardTitle></CardHeader>
          <CardContent>
            {stats.byClass.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.byClass.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={v => [v, "Élèves"]} />
                  <Bar dataKey="effectif" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Répartition par niveau */}
        <Card>
          <CardHeader><CardTitle className="text-base">🏫 Répartition par niveau</CardTitle></CardHeader>
          <CardContent>
            {stats.byLevel.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={stats.byLevel} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={75}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.byLevel.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {stats.byLevel.map((l, i) => (
                    <div key={l.level} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-sm text-slate-600">{l.level}</span>
                      <span className="ml-auto font-bold text-slate-900">{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.byClass.slice(0, 5).map(c => (
                  <div key={c.name} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge variant="outline">{c.effectif} élèves</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Événements à venir */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" />Événements à venir</CardTitle></CardHeader>
          <CardContent>
            {stats.upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingEvents.map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 text-sm">{new Date(e.date).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{e.title}</p>
                      <p className="text-xs text-slate-500">{format(new Date(e.date), "EEEE d MMMM", { locale: fr })}</p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{e.type}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucun événement à venir</p>}
          </CardContent>
        </Card>

        {/* Derniers inscrits */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck className="w-4 h-4 text-green-500" />Derniers inscrits</CardTitle></CardHeader>
          <CardContent>
            {stats.recentStudents.length > 0 ? (
              <div className="space-y-2">
                {stats.recentStudents.map(s => {
                  const cls = classes.find(c => c.id === s.class_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-slate-500">{cls?.name || "Classe non assignée"}</p>
                      </div>
                      <Badge className={s.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>{s.status}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucun élève inscrit</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COMPTABLE
// ═══════════════════════════════════════════════════════════════════════════════

function ComptableDashboard() {
  const { data: payments   = [] } = useQuery({ queryKey: ["payments"],   queryFn: () => base44.entities.Payment.list() });
  const { data: litigations= [] } = useQuery({ queryKey: ["litigations"],queryFn: () => base44.entities.Litigation.list() });
  const { data: teachers   = [] } = useQuery({ queryKey: ["teachers"],   queryFn: () => base44.entities.Teacher.list() });
  const { data: staff      = [] } = useQuery({ queryKey: ["staff"],      queryFn: () => base44.entities.Staff.list() });
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });

  const stats = useMemo(() => {
    const paid        = payments.filter(p => p.status === "paid");
    const unpaid      = payments.filter(p => p.status === "unpaid" || p.status === "pending");
    const totalPaid   = paid.reduce((s, p) => s + (p.amount_paid || p.amount || 0), 0);
    const totalUnpaid = unpaid.reduce((s, p) => s + (p.amount || 0), 0);
    const collRate    = payments.length ? ((paid.length / payments.length) * 100).toFixed(1) : 0;

    // Statut des paiements
    const statusDist = [
      { name: "Payé",     value: paid.length,   fill: "#10b981" },
      { name: "Impayé",   value: unpaid.filter(p => p.status === "unpaid").length, fill: "#ef4444" },
      { name: "En attente", value: unpaid.filter(p => p.status === "pending").length, fill: "#f59e0b" },
    ].filter(s => s.value > 0);

    // Évolution mensuelle
    const monthly = paymentsByMonth(payments);

    // Masse salariale
    const teacherSalary = teachers.filter(t => t.status === "active").reduce((s, t) => s + (t.salary || 0), 0);
    const staffSalary   = staff.filter(s => s.status === "active").reduce((s, st) => s + (st.salary || 0), 0);
    const totalSalary   = teacherSalary + staffSalary;

    const contractTypes = [
      { label: "CDI",          key: "permanent" },
      { label: "CDD",          key: "contract" },
      { label: "Temps partiel",key: "part_time" },
    ];

    return {
      totalPaid: Math.round(totalPaid), totalUnpaid: Math.round(totalUnpaid),
      collRate, statusDist, monthly,
      totalSalary: Math.round(totalSalary), teacherSalary: Math.round(teacherSalary), staffSalary: Math.round(staffSalary),
      totalPayments: payments.length, paidCount: paid.length,
      litigationsActive: litigations.filter(l => l.status !== "resolved").length,
      contractTypes,
      teachers, staff,
    };
  }, [payments, litigations, teachers, staff]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-emerald-500 to-teal-600" emoji="💰"
        title="Tableau de bord Comptabilité" subtitle="Suivi financier · Paiements, masse salariale & litiges" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<DollarSign className="w-5 h-5" />}     label="Montant encaissé"   value={`${stats.totalPaid.toLocaleString()} DA`}    sub={`${stats.paidCount} paiements`}         color="green" />
        <KPI icon={<CreditCard className="w-5 h-5" />}      label="Impayés"            value={`${stats.totalUnpaid.toLocaleString()} DA`}  sub={`${stats.totalPayments - stats.paidCount} dossiers`}  color="red" />
        <KPI icon={<TrendingUp className="w-5 h-5" />}      label="Taux de recouvr."   value={`${stats.collRate}%`}                                                                       color={parseFloat(stats.collRate) >= 80 ? "teal" : "orange"} />
        <KPI icon={<AlertTriangle className="w-5 h-5" />}   label="Litiges actifs"     value={stats.litigationsActive}                                                                    color={stats.litigationsActive > 0 ? "orange" : "green"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <Card>
          <CardHeader><CardTitle className="text-base">📈 Recouvrement mensuel (6 mois)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`${v.toLocaleString()} DA`]} />
                <Legend />
                <Bar dataKey="collected" name="Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expected"  name="Attendu"  fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Répartition statuts */}
        <Card>
          <CardHeader><CardTitle className="text-base">🟢 Statut des paiements</CardTitle></CardHeader>
          <CardContent>
            {stats.statusDist.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={stats.statusDist} dataKey="value" cx="50%" cy="50%" outerRadius={75}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.statusDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {stats.statusDist.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.fill }} />
                      <span className="text-sm text-slate-600">{s.name}</span>
                      <span className="ml-auto font-bold text-slate-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Masse salariale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">👔 Masse salariale</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-xl bg-teal-50 p-4 text-center">
                <p className="text-xs text-teal-600 font-medium">Enseignants</p>
                <p className="text-lg font-bold text-teal-800">{stats.teacherSalary.toLocaleString()} DA</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <p className="text-xs text-blue-600 font-medium">Personnel</p>
                <p className="text-lg font-bold text-blue-800">{stats.staffSalary.toLocaleString()} DA</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-4 text-center border-2 border-indigo-200">
                <p className="text-xs text-indigo-600 font-medium">Total</p>
                <p className="text-lg font-bold text-indigo-800">{stats.totalSalary.toLocaleString()} DA</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { name: "Enseignants", montant: stats.teacherSalary },
                { name: "Personnel",   montant: stats.staffSalary },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`${v.toLocaleString()} DA`]} />
                <Bar dataKey="montant" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contrats */}
        <Card>
          <CardHeader><CardTitle className="text-base">📄 Types de contrats</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.contractTypes.map(({ label, key }) => {
                const tc = stats.teachers.filter(t => t.contract_type === key).length;
                const sc = stats.staff.filter(s => s.contract_type === key).length;
                return (
                  <div key={key}>
                    <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enseignants : {tc}</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Personnel : {sc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ÉLÈVE
// ═══════════════════════════════════════════════════════════════════════════════

function EleveDashboard({ session }) {
  const memberId = session?.member_id;
  const { data: grades     = [] } = useQuery({ queryKey: ["my-grades"],     queryFn: () => base44.entities.Grade.filter(memberId ? { student_id: memberId } : {}) });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],         queryFn: () => base44.entities.Exam.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],      queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["my-attendance"], queryFn: () => base44.entities.Attendance.filter(memberId ? { student_id: memberId } : {}) });
  const { data: homework   = [] } = useQuery({ queryKey: ["homework"],      queryFn: () => base44.entities.Homework.list() });
  const { data: events     = [] } = useQuery({ queryKey: ["events"],        queryFn: () => base44.entities.Event.list() });
  const { data: messages   = [] } = useQuery({ queryKey: ["messages"],      queryFn: () => base44.entities.Message.list() });

  const stats = useMemo(() => {
    const myGrades = memberId ? grades : grades;
    const validGrades = myGrades.filter(g => !g.absent && g.score != null);
    const globalAvg = safeAvg(myGrades);

    // Moyenne par matière
    const bySubject = subjects.map(sub => {
      const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const subGrades  = myGrades.filter(g => subExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      if (!subGrades.length) return null;
      return {
        subject: sub.name.length > 14 ? sub.name.slice(0, 14) + "…" : sub.name,
        moyenne: parseFloat((avg(subGrades.map(g => g.score))).toFixed(1)),
        fullName: sub.name,
      };
    }).filter(Boolean).sort((a, b) => b.moyenne - a.moyenne);

    // Évolution par trimestre
    const byTrimester = ["T1", "T2", "T3"].map(t => {
      const tExamIds = exams.filter(e => e.trimester === t).map(e => e.id);
      const tGrades  = myGrades.filter(g => tExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      return { name: t, moyenne: tGrades.length ? parseFloat((avg(tGrades.map(g => g.score))).toFixed(1)) : null };
    }).filter(t => t.moyenne !== null);

    // Présence
    const att = attendanceStats(attendance);

    // Taux de réussite
    const successRate = validGrades.length ? Math.round((validGrades.filter(g => g.score >= 10).length / validGrades.length) * 100) : null;

    // Devoirs à venir
    const upcomingHW = homework.filter(h => h.due_date && new Date(h.due_date) >= new Date()).slice(0, 5);

    // Prochain examen
    const upcomingExams = exams.filter(e => e.date && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);

    return {
      globalAvg, bySubject, byTrimester, att, successRate,
      upcomingHW, upcomingExams,
      unreadMessages: messages.filter(m => !m.read).length,
      upcomingEvents: events.filter(e => e.date && new Date(e.date) >= new Date()).length,
      totalGrades: validGrades.length,
    };
  }, [grades, exams, subjects, attendance, homework, events, messages, memberId]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-pink-500 to-rose-500" emoji="🎒"
        title="Mon Espace Élève" subtitle="Suivi de mes notes, présences et devoirs" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<Award className="w-5 h-5" />}          label="Ma moyenne"        value={stats.globalAvg ? `${stats.globalAvg}/20` : "—"}   color={stats.globalAvg >= 10 ? "green" : stats.globalAvg > 0 ? "orange" : "gray"} />
        <KPI icon={<TrendingUp className="w-5 h-5" />}     label="Taux de réussite"  value={stats.successRate != null ? `${stats.successRate}%` : "—"}  color={stats.successRate >= 50 ? "teal" : "orange"} />
        <KPI icon={<UserCheck className="w-5 h-5" />}      label="Présence (30j)"    value={stats.att.rate != null ? `${stats.att.rate}%` : "—"}  sub={stats.att.total ? `${stats.att.absent} absences` : undefined}  color={stats.att.rate == null ? "gray" : stats.att.rate >= 90 ? "green" : "orange"} />
        <KPI icon={<FileText className="w-5 h-5" />}       label="Devoirs à rendre"  value={stats.upcomingHW.length}                               color="pink" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyennes par matière */}
        <Card>
          <CardHeader><CardTitle className="text-base">📚 Mes moyennes par matière</CardTitle></CardHeader>
          <CardContent>
            {stats.bySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.bySubject} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="subject" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n, p) => [`${v}/20`, p.payload.fullName || n]} />
                  <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="moyenne" radius={[0, 4, 4, 0]}>
                    {stats.bySubject.map((e, i) => <Cell key={i} fill={e.moyenne >= 10 ? "#6366f1" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Évolution trimestrielle */}
        <Card>
          <CardHeader><CardTitle className="text-base">📈 Mon évolution</CardTitle></CardHeader>
          <CardContent>
            {stats.byTrimester.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={stats.byTrimester}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 20]} />
                  <Tooltip formatter={v => [`${v}/20`, "Moyenne"]} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "10", position: "right", fontSize: 10 }} />
                  <Line type="monotone" dataKey="moyenne" stroke="#ec4899" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Devoirs à rendre */}
        <Card>
          <CardHeader><CardTitle className="text-base">📝 Devoirs à rendre</CardTitle></CardHeader>
          <CardContent>
            {stats.upcomingHW.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingHW.map(hw => {
                  const daysLeft = hw.due_date ? Math.ceil((new Date(hw.due_date) - new Date()) / 86400000) : null;
                  return (
                    <div key={hw.id} className="flex items-center justify-between p-2.5 rounded-lg border border-pink-100 bg-pink-50">
                      <p className="font-medium text-sm text-pink-900 truncate">{hw.title}</p>
                      <Badge className={daysLeft <= 2 ? "bg-red-100 text-red-700" : "bg-pink-100 text-pink-700"}>
                        {daysLeft != null ? (daysLeft <= 0 ? "Aujourd'hui" : `J-${daysLeft}`) : "—"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 flex-col gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-slate-500 text-sm">Aucun devoir à rendre 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prochains examens */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-500" />Prochains examens</CardTitle></CardHeader>
          <CardContent>
            {stats.upcomingExams.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingExams.map(e => {
                  const sub = subjects.find(s => s.id === e.subject_id);
                  const daysLeft = e.date ? Math.ceil((new Date(e.date) - new Date()) / 86400000) : null;
                  return (
                    <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-100 bg-indigo-50">
                      <div>
                        <p className="font-medium text-sm text-indigo-900">{e.title}</p>
                        <p className="text-xs text-indigo-600">{sub?.name}</p>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {daysLeft != null ? (daysLeft <= 0 ? "Aujourd'hui" : `J-${daysLeft}`) : "—"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucun examen à venir</p>}
          </CardContent>
        </Card>
      </div>

      {/* Présence */}
      <Card>
        <CardHeader><CardTitle className="text-base">✅ Ma présence — 30 derniers jours</CardTitle></CardHeader>
        <CardContent>
          <AttendanceBar {...stats.att} />
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PARENT
// ═══════════════════════════════════════════════════════════════════════════════

function ParentDashboard({ session }) {
  const parentId = session?.member_id;
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: grades     = [] } = useQuery({ queryKey: ["grades"],     queryFn: () => base44.entities.Grade.list() });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],      queryFn: () => base44.entities.Exam.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions  = [] } = useQuery({ queryKey: ["sanctions"],  queryFn: () => base44.entities.Sanction.list() });
  const { data: homework   = [] } = useQuery({ queryKey: ["homework"],   queryFn: () => base44.entities.Homework.list() });
  const { data: messages   = [] } = useQuery({ queryKey: ["messages"],   queryFn: () => base44.entities.Message.list() });
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });

  const stats = useMemo(() => {
    // Trouver les enfants liés à ce parent
    const myChildren = parentId
      ? students.filter(s => s.parent_id === parentId)
      : students.slice(0, 1); // fallback : 1er élève si pas de lien

    const childIds = myChildren.map(c => c.id);

    // Notes des enfants
    const myGrades = grades.filter(g => childIds.includes(g.student_id));
    const globalAvg = safeAvg(myGrades);

    // Moyenne par matière (pour le 1er enfant)
    const child = myChildren[0];
    const bySubject = child ? subjects.map(sub => {
      const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const subGrades  = myGrades.filter(g => subExamIds.includes(g.exam_id) && g.student_id === child.id && !g.absent && g.score != null);
      if (!subGrades.length) return null;
      return {
        subject: sub.name.length > 14 ? sub.name.slice(0, 14) + "…" : sub.name,
        moyenne: parseFloat((avg(subGrades.map(g => g.score))).toFixed(1)),
        fullName: sub.name,
      };
    }).filter(Boolean) : [];

    // Présence des enfants
    const childAttendance = attendance.filter(a => childIds.includes(a.student_id));
    const att = attendanceStats(childAttendance);

    // Sanctions
    const mySanctions = sanctions.filter(s => childIds.includes(s.student_id) && !s.resolved);

    // Devoirs à venir
    const upcomingHW = homework.filter(h => h.due_date && new Date(h.due_date) >= new Date()).slice(0, 5);

    // Dernières notes (récentes)
    const recentGrades = myGrades
      .filter(g => !g.absent && g.score != null)
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, 6);

    return {
      myChildren, child, globalAvg,
      bySubject, att, mySanctions, upcomingHW, recentGrades,
      unreadMessages: messages.filter(m => !m.read).length,
      classes,
    };
  }, [students, grades, exams, subjects, attendance, sanctions, homework, messages, classes, parentId]);

  return (
    <div className="space-y-6">
      <SectionHeader gradient="from-amber-500 to-orange-500" emoji="👨‍👩‍👧"
        title="Espace Parent" subtitle={`Suivi scolaire${stats.child ? ` · ${stats.child.first_name} ${stats.child.last_name}` : ""}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<Award className="w-5 h-5" />}           label="Moyenne générale"   value={stats.globalAvg ? `${stats.globalAvg}/20` : "—"}   color={parseFloat(stats.globalAvg) >= 10 ? "green" : "orange"} />
        <KPI icon={<UserCheck className="w-5 h-5" />}        label="Présence (30j)"     value={stats.att.rate != null ? `${stats.att.rate}%` : "—"}  sub={stats.att.absent ? `${stats.att.absent} absences` : undefined}  color={stats.att.rate == null ? "gray" : stats.att.rate >= 90 ? "green" : "orange"} />
        <KPI icon={<AlertTriangle className="w-5 h-5" />}    label="Sanctions actives"  value={stats.mySanctions.length}                              color={stats.mySanctions.length > 0 ? "red" : "green"} />
        <KPI icon={<MessageSquare className="w-5 h-5" />}    label="Messages non lus"   value={stats.unreadMessages}                                  color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyennes par matière */}
        <Card>
          <CardHeader><CardTitle className="text-base">📚 Notes par matière</CardTitle></CardHeader>
          <CardContent>
            {stats.bySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.bySubject} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="subject" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n, p) => [`${v}/20`, p.payload.fullName || n]} />
                  <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="moyenne" radius={[0, 4, 4, 0]}>
                    {stats.bySubject.map((e, i) => <Cell key={i} fill={e.moyenne >= 10 ? "#f59e0b" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Présence */}
        <Card>
          <CardHeader><CardTitle className="text-base">✅ Présence de mon enfant (30j)</CardTitle></CardHeader>
          <CardContent>
            <AttendanceBar {...stats.att} />
          </CardContent>
        </Card>

        {/* Dernières notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Dernières notes</CardTitle></CardHeader>
          <CardContent>
            {stats.recentGrades.length > 0 ? (
              <div className="space-y-2">
                {stats.recentGrades.map(g => {
                  const exam = exams.find(e => e.id === g.exam_id);
                  const sub  = exam ? subjects.find(s => s.id === exam.subject_id) : null;
                  return (
                    <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{exam?.title || "Examen"}</p>
                        <p className="text-xs text-slate-500">{sub?.name}</p>
                      </div>
                      <Badge className={g.score >= 10 ? "bg-green-100 text-green-700 font-bold text-base px-3" : "bg-red-100 text-red-700 font-bold text-base px-3"}>
                        {g.score}/20
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucune note disponible</p>}
          </CardContent>
        </Card>

        {/* Sanctions + Devoirs */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" />Sanctions en cours</CardTitle></CardHeader>
            <CardContent>
              {stats.mySanctions.length > 0 ? (
                <div className="space-y-2">
                  {stats.mySanctions.slice(0, 4).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-100">
                      <div>
                        <p className="text-sm font-medium">{s.reason}</p>
                        <p className="text-xs text-slate-500">{s.type} · {s.date}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-700">Actif</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 py-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm">Aucune sanction active</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">📝 Devoirs à venir</CardTitle></CardHeader>
            <CardContent>
              {stats.upcomingHW.length > 0 ? (
                <div className="space-y-1.5">
                  {stats.upcomingHW.slice(0, 4).map(hw => (
                    <div key={hw.id} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <p className="text-sm truncate">{hw.title}</p>
                      <Badge variant="outline" className="flex-shrink-0 ml-2">
                        {hw.due_date ? format(new Date(hw.due_date), "d MMM", { locale: fr }) : "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm text-center py-4">Aucun devoir à venir</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTEUR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const session = getSession();
  const role    = session?.role || localStorage.getItem("edugest_role") || "";

  if (role === "admin_systeme") return <AdminSystemeDashboard />;

  if (["directeur_general", "directeur_primaire", "directeur_college", "directeur_lycee", "secretaire"].includes(role))
    return <DirectionDashboard />;

  if (role === "cpe")       return <CPEDashboard />;
  if (role === "enseignant") return <EnseignantDashboard session={session} />;
  if (role === "comptable")  return <ComptableDashboard />;
  if (role === "eleve")      return <EleveDashboard session={session} />;
  if (role === "parent")     return <ParentDashboard session={session} />;

  // Fallback : direction par défaut
  return <DirectionDashboard />;
}
