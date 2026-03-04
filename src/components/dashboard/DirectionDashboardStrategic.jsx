import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Users, Award, AlertTriangle,
  BarChart2, Activity, BookOpen, Target
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie, ReferenceLine
} from "recharts";

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color, trend }) {
  const colors = {
    blue: "from-blue-500 to-blue-700 shadow-blue-200",
    green: "from-green-500 to-green-700 shadow-green-200",
    red: "from-red-500 to-red-700 shadow-red-200",
    orange: "from-orange-500 to-orange-700 shadow-orange-200",
    violet: "from-violet-500 to-violet-700 shadow-violet-200",
    pink: "from-pink-500 to-pink-700 shadow-pink-200",
    indigo: "from-indigo-500 to-indigo-700 shadow-indigo-200",
    teal: "from-teal-500 to-teal-700 shadow-teal-200",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} text-white shadow-lg`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="text-xs">{trend >= 0 ? "+" : ""}{trend}% vs. période préc.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Title ──────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, color = "text-slate-700" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-5 h-5 ${color}`} />
      <h3 className={`text-base font-semibold ${color}`}>{title}</h3>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function DirectionDashboardStrategic({ students, teachers, classes, subjects, events, sanctions, messages }) {
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: schoolYears = [] } = useQuery({ queryKey: ["schoolYears"], queryFn: () => base44.entities.SchoolYear.list() });
  const { data: promotions = [] } = useQuery({ queryKey: ["promotions"], queryFn: () => base44.entities.Promotion.list() });

  const activeStudents = useMemo(() => students.filter(s => s.status === "active"), [students]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const allGradesValid = grades.filter(g => !g.absent && g.score != null);
    const globalAvg = allGradesValid.length
      ? allGradesValid.reduce((a, b) => a + b.score, 0) / allGradesValid.length
      : null;
    const successRate = allGradesValid.length
      ? (allGradesValid.filter(g => g.score >= 10).length / allGradesValid.length) * 100
      : null;

    // Absentéisme
    const totalAtt = attendance.length;
    const absCount = attendance.filter(a => a.status === "absent").length;
    const absRate = totalAtt > 0 ? (absCount / totalAtt) * 100 : 0;

    // Redoublement
    const repeating = promotions.filter(p => p.decision === "repeating").length;
    const total = promotions.length;
    const redoublementRate = total > 0 ? (repeating / total) * 100 : null;

    return { globalAvg, successRate, absRate, redoublementRate, repeating, total };
  }, [grades, attendance, promotions]);

  // ── Performance par niveau (classe) ──────────────────────────────────────
  const byLevel = useMemo(() => {
    const levelMap = {};
    classes.forEach(cls => {
      const level = cls.level || cls.name.split(" ")[0] || "Autre";
      const classStudentIds = activeStudents.filter(s => s.class_id === cls.id).map(s => s.id);
      const classExamIds = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const cg = grades.filter(g => classStudentIds.includes(g.student_id) && classExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      if (!levelMap[level]) levelMap[level] = { scores: [], success: 0 };
      cg.forEach(g => {
        levelMap[level].scores.push(g.score);
        if (g.score >= 10) levelMap[level].success++;
      });
    });
    return Object.entries(levelMap).map(([level, { scores, success }]) => ({
      level,
      moyenne: scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
      tauxReussite: scores.length ? parseFloat(((success / scores.length) * 100).toFixed(0)) : 0,
    })).filter(l => l.moyenne > 0);
  }, [classes, activeStudents, exams, grades]);

  // ── Analyse par genre ─────────────────────────────────────────────────────
  const byGender = useMemo(() => {
    const result = { M: { scores: [], name: "Garçons" }, F: { scores: [], name: "Filles" } };
    activeStudents.forEach(s => {
      const sg = grades.filter(g => g.student_id === s.id && !g.absent && g.score != null);
      sg.forEach(g => {
        if (s.gender === "M") result.M.scores.push(g.score);
        else if (s.gender === "F") result.F.scores.push(g.score);
      });
    });
    return Object.entries(result).map(([gender, { name, scores }]) => ({
      gender: name,
      moyenne: scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
      tauxReussite: scores.length ? parseFloat(((scores.filter(s => s >= 10).length / scores.length) * 100).toFixed(0)) : 0,
      count: scores.length,
      fill: gender === "M" ? "#6366f1" : "#ec4899"
    })).filter(g => g.count > 0);
  }, [activeStudents, grades]);

  // ── Corrélation Discipline / Résultats ────────────────────────────────────
  const disciplineCorrelation = useMemo(() => {
    return activeStudents.slice(0, 50).map(student => {
      const sg = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
      const avg = sg.length ? sg.reduce((a, b) => a + b.score, 0) / sg.length : null;
      const sanctionCount = sanctions.filter(s => s.student_id === student.id && !s.resolved).length;
      if (avg === null) return null;
      return { avg: parseFloat(avg.toFixed(1)), sanctions: sanctionCount };
    }).filter(Boolean);
  }, [activeStudents, grades, sanctions]);

  // ── Courbe de tendance multi-trimestres ──────────────────────────────────
  const trendData = useMemo(() => {
    const trimesters = ["T1", "T2", "T3"];
    return trimesters.map(t => {
      const tExams = exams.filter(e => e.trimester === t).map(e => e.id);
      const tGrades = grades.filter(g => tExams.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = tGrades.length ? parseFloat((tGrades.reduce((a, b) => a + b.score, 0) / tGrades.length).toFixed(1)) : null;
      const successRate = tGrades.length ? parseFloat(((tGrades.filter(g => g.score >= 10).length / tGrades.length) * 100).toFixed(0)) : null;
      const absRate = (() => {
        const att = attendance.filter(a => {
          // approximate: all attendance records for this period - rough split
          return true;
        });
        return null; // simplified for now
      })();
      return { trimestre: t, moyenne: avg, tauxReussite: successRate };
    }).filter(d => d.moyenne !== null);
  }, [exams, grades, attendance]);

  // ── Prévision T suivant ───────────────────────────────────────────────────
  const forecast = useMemo(() => {
    if (trendData.length < 2) return null;
    const last = trendData[trendData.length - 1];
    const prev = trendData[trendData.length - 2];
    const delta = last.tauxReussite - prev.tauxReussite;
    return {
      label: `T${trendData.length + 1} (prévision)`,
      tauxReussite: Math.min(100, Math.max(0, parseFloat((last.tauxReussite + delta * 0.8).toFixed(0)))),
      moyenne: parseFloat(Math.min(20, Math.max(0, last.moyenne + (last.moyenne - prev.moyenne) * 0.8)).toFixed(1))
    };
  }, [trendData]);

  const fullTrend = forecast
    ? [...trendData, { trimestre: forecast.label, moyenne: forecast.moyenne, tauxReussite: forecast.tauxReussite, forecast: true }]
    : trendData;

  // ── Radar matières ────────────────────────────────────────────────────────
  const subjectRadar = useMemo(() => {
    return subjects.slice(0, 8).map(sub => {
      const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
      const sg = grades.filter(g => subExamIds.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = sg.length ? parseFloat((sg.reduce((a, b) => a + b.score, 0) / sg.length).toFixed(1)) : 0;
      return { subject: sub.code || sub.name.slice(0, 8), moyenne: avg };
    }).filter(s => s.moyenne > 0);
  }, [subjects, exams, grades]);

  // ── Analyse socio-éco (proxy: paiements) ─────────────────────────────────
  // We use presence of parent info as a proxy
  const socioData = useMemo(() => {
    const withContact = activeStudents.filter(s => s.parent_email || s.parent_phone).length;
    const withoutContact = activeStudents.length - withContact;
    return [
      { name: "Contact parent renseigné", value: withContact, fill: "#22c55e" },
      { name: "Sans contact", value: withoutContact, fill: "#f59e0b" },
    ];
  }, [activeStudents]);

  // ── Comparatif années scolaires ───────────────────────────────────────────
  const yearCompar = useMemo(() => {
    return schoolYears.slice(0, 4).map(sy => {
      const syPromos = promotions.filter(p => p.school_year_from === sy.name);
      const total = syPromos.length;
      const promoted = syPromos.filter(p => p.decision === "promoted").length;
      const repeating = syPromos.filter(p => p.decision === "repeating").length;
      return {
        year: sy.name,
        tauxPromotion: total > 0 ? parseFloat(((promoted / total) * 100).toFixed(0)) : null,
        tauxRedoublement: total > 0 ? parseFloat(((repeating / total) * 100).toFixed(0)) : null,
        effectif: students.filter(s => s.status === "active").length,
      };
    }).filter(y => y.tauxPromotion !== null);
  }, [schoolYears, promotions, students]);

  const noData = grades.length === 0;

  return (
    <div className="space-y-8">
      {/* ── KPIs stratégiques ── */}
      <div>
        <SectionTitle icon={Target} title="KPIs Stratégiques" color="text-slate-700" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Taux de réussite global"
            value={kpis.successRate !== null ? `${kpis.successRate.toFixed(0)}%` : "—"}
            sub="Notes ≥ 10/20"
            icon={Award}
            color="green"
          />
          <KPICard
            label="Taux d'absentéisme"
            value={`${kpis.absRate.toFixed(1)}%`}
            sub={`${attendance.filter(a => a.status === "absent").length} absences enreg.`}
            icon={AlertTriangle}
            color={kpis.absRate > 15 ? "red" : kpis.absRate > 8 ? "orange" : "teal"}
          />
          <KPICard
            label="Taux de redoublement"
            value={kpis.redoublementRate !== null ? `${kpis.redoublementRate.toFixed(0)}%` : "—"}
            sub={`${kpis.repeating}/${kpis.total} décisions`}
            icon={TrendingDown}
            color={kpis.redoublementRate > 15 ? "red" : "orange"}
          />
          <KPICard
            label="Moyenne générale"
            value={kpis.globalAvg !== null ? `${kpis.globalAvg.toFixed(1)}/20` : "—"}
            sub="Tous niveaux confondus"
            icon={BarChart2}
            color="violet"
          />
        </div>
      </div>

      {/* ── Courbe de tendance multi-trimestres + Prévision ── */}
      <Card>
        <CardHeader className="pb-2">
          <SectionTitle icon={TrendingUp} title="📊 Courbe de tendance & Prévision du taux de réussite" color="text-indigo-700" />
        </CardHeader>
        <CardContent>
          {fullTrend.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Aucune donnée par trimestre disponible</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={fullTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trimestre" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" domain={[0, 20]} label={{ value: "Moyenne /20", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: "Réussite %", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
                <Tooltip
                  formatter={(value, name) => [
                    name === "moyenne" ? `${value}/20` : `${value}%`,
                    name === "moyenne" ? "Moyenne" : "Taux de réussite"
                  ]}
                  labelFormatter={(label) => `${label}${label.includes("prévision") ? " 🔮" : ""}`}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="moyenne" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5 }} strokeDasharray={(d) => d.forecast ? "6 3" : undefined} name="Moyenne" />
                <Line yAxisId="right" type="monotone" dataKey="tauxReussite" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 5 }} name="Taux de réussite" />
                {forecast && <ReferenceLine yAxisId="left" x={forecast.label} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "Prévision", position: "top", fill: "#f59e0b", fontSize: 11 }} />}
              </LineChart>
            </ResponsiveContainer>
          )}
          {forecast && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <p className="text-sm text-amber-800">
                <strong>Prévision {forecast.label} :</strong> Taux de réussite estimé à <strong>{forecast.tauxReussite}%</strong>, moyenne à <strong>{forecast.moyenne}/20</strong> — basé sur la tendance actuelle.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Performance par niveau + Comparatif années ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle icon={BookOpen} title="📍 Performance par niveau scolaire" color="text-violet-700" />
          </CardHeader>
          <CardContent>
            {byLevel.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Aucune donnée disponible</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byLevel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[0, 20]} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="moyenne" name="Moy /20" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {byLevel.map((l, i) => <Cell key={i} fill={l.moyenne >= 12 ? "#22c55e" : l.moyenne >= 10 ? "#6366f1" : "#ef4444"} />)}
                  </Bar>
                  <Bar yAxisId="right" dataKey="tauxReussite" name="Réussite %" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle icon={BarChart2} title="📊 Comparatif années scolaires" color="text-blue-700" />
          </CardHeader>
          <CardContent>
            {yearCompar.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Aucune donnée de promotion disponible</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearCompar}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="tauxPromotion" name="Taux promotion %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tauxRedoublement" name="Taux redoublement %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Analyse par genre + Matrice radar matières ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle icon={Users} title="Analyse par genre" color="text-pink-700" />
          </CardHeader>
          <CardContent>
            {byGender.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Aucune donnée de genre disponible</p>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  {byGender.map(g => (
                    <div key={g.gender} className="flex-1 rounded-xl p-4 text-center" style={{ background: g.fill + "22", border: `2px solid ${g.fill}` }}>
                      <p className="text-sm font-semibold" style={{ color: g.fill }}>{g.gender}</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{g.moyenne}/20</p>
                      <p className="text-xs text-slate-500">{g.tauxReussite}% de réussite</p>
                      <p className="text-xs text-slate-400">{Math.round(g.count / (exams.length || 1))} élèves env.</p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={byGender}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="gender" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 20]} />
                    <Tooltip />
                    <Bar dataKey="moyenne" name="Moyenne /20" radius={[4, 4, 0, 0]}>
                      {byGender.map((g, i) => <Cell key={i} fill={g.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle icon={Activity} title="🧠 Radar des performances par matière" color="text-indigo-700" />
          </CardHeader>
          <CardContent>
            {subjectRadar.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Aucune donnée de matière disponible</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={subjectRadar} cx="50%" cy="50%" outerRadius={80}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9 }} />
                  <Radar name="Moyenne" dataKey="moyenne" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  <Tooltip formatter={(v) => `${v}/20`} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Corrélation discipline/résultats ── */}
      <Card>
        <CardHeader className="pb-2">
          <SectionTitle icon={AlertTriangle} title="🧠 Corrélation discipline / résultats scolaires" color="text-red-700" />
        </CardHeader>
        <CardContent>
          {disciplineCorrelation.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Aucune donnée disponible</p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">Chaque point = un élève. Axe X = nb sanctions actives, Axe Y = moyenne générale.</p>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sanctions" name="Sanctions actives" label={{ value: "Sanctions actives", position: "insideBottom", offset: -5, style: { fontSize: 11 } }} />
                  <YAxis dataKey="avg" name="Moyenne" domain={[0, 20]} label={{ value: "Moyenne /20", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [n === "sanctions" ? v : `${v}/20`, n === "sanctions" ? "Sanctions" : "Moyenne"]} />
                  <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "Seuil 10/20", fill: "#f59e0b", fontSize: 10, position: "right" }} />
                  <Scatter
                    data={disciplineCorrelation}
                    fill="#6366f1"
                    opacity={0.7}
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      const color = payload.avg < 10 ? "#ef4444" : payload.sanctions > 0 ? "#f59e0b" : "#22c55e";
                      return <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.75} />;
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Moyenne &lt; 10</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Sanctions &gt; 0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Stable</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Analyse socio-économique (proxy) ── */}
      <Card>
        <CardHeader className="pb-2">
          <SectionTitle icon={Users} title="Analyse socio-économique (indicateurs disponibles)" color="text-teal-700" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-xs text-slate-500 mb-4">Présence d'informations parentales comme indicateur d'engagement familial</p>
              <div className="space-y-3">
                {socioData.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{d.name}</span>
                        <strong>{d.value} élèves ({activeStudents.length > 0 ? ((d.value / activeStudents.length) * 100).toFixed(0) : 0}%)</strong>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${activeStudents.length > 0 ? (d.value / activeStudents.length) * 100 : 0}%`, background: d.fill }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={socioData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {socioData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}