import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  BrainCircuit, Loader2, Sparkles, AlertTriangle, TrendingDown,
  GraduationCap, TrendingUp, Zap, ChevronDown, ChevronRight, Info
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine
} from "recharts";

const RISK_COLORS = {
  critique: "bg-red-100 text-red-700 border-red-300",
  eleve: "bg-orange-100 text-orange-700 border-orange-300",
  modere: "bg-yellow-100 text-yellow-700 border-yellow-300",
  faible: "bg-green-100 text-green-700 border-green-300",
};

const RISK_BAR_COLOR = { critique: "#ef4444", eleve: "#f97316", modere: "#eab308", faible: "#22c55e" };

function RiskBadge({ label, level }) {
  return (
    <Badge className={`border text-xs font-semibold ${RISK_COLORS[level] || RISK_COLORS.modere}`}>
      {label}
    </Badge>
  );
}

function ScoreBar({ value, max = 100, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─── Pure heuristic prediction engine (no ML lib needed) ──────────────────────
function computePredictions(student, grades, exams, subjects, attendance, sanctions, classes, allStudents) {
  const sg = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
  const avg = sg.length ? sg.reduce((a, b) => a + b.score, 0) / sg.length : null;

  // Trimester averages
  const tAvg = (t) => {
    const te = exams.filter(e => e.trimester === t).map(e => e.id);
    const tg = sg.filter(g => te.includes(g.exam_id));
    return tg.length ? tg.reduce((a, b) => a + b.score, 0) / tg.length : null;
  };
  const t1 = tAvg("T1"), t2 = tAvg("T2"), t3 = tAvg("T3");
  const trend = t2 && t1 ? t2 - t1 : t3 && t2 ? t3 - t2 : 0;
  const latestTrimester = t3 ?? t2 ?? t1;

  // Attendance
  const att = attendance.filter(a => a.student_id === student.id);
  const absRate = att.length ? (att.filter(a => a.status === "absent").length / att.length) * 100 : 0;
  const late = att.filter(a => a.status === "late").length;

  // Sanctions
  const activeSanctions = sanctions.filter(s => s.student_id === student.id && !s.resolved).length;
  const totalSanctions = sanctions.filter(s => s.student_id === student.id).length;

  // Subjects below 10
  const subjectsBelowAvg = (() => {
    const bySub = {};
    sg.forEach(g => {
      const exam = exams.find(e => e.id === g.exam_id);
      if (exam?.subject_id) {
        if (!bySub[exam.subject_id]) bySub[exam.subject_id] = [];
        bySub[exam.subject_id].push(g.score);
      }
    });
    return Object.values(bySub).filter(scores => scores.reduce((a, b) => a + b, 0) / scores.length < 10).length;
  })();

  // Subject distribution for radar
  const subjectRadar = subjects.map(sub => {
    const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
    const subGrades = sg.filter(g => subExamIds.includes(g.exam_id));
    const a = subGrades.length ? subGrades.reduce((x, g) => x + g.score, 0) / subGrades.length : 0;
    return { subject: sub.name.slice(0, 10), score: parseFloat(a.toFixed(1)) };
  }).filter(s => s.score > 0);

  // ── Risk of academic failure ───────────────────────────────────────────────
  let failureScore = 0;
  if (avg !== null) {
    if (avg < 6) failureScore += 50;
    else if (avg < 8) failureScore += 35;
    else if (avg < 10) failureScore += 20;
    else if (avg < 12) failureScore += 5;
  }
  if (trend < -3) failureScore += 20;
  else if (trend < -1) failureScore += 10;
  if (subjectsBelowAvg >= 3) failureScore += 15;
  else if (subjectsBelowAvg >= 1) failureScore += 7;
  if (absRate > 20) failureScore += 10;
  failureScore = Math.min(99, Math.max(1, failureScore));

  // ── Risk of dropout ────────────────────────────────────────────────────────
  let dropoutScore = 0;
  if (avg !== null && avg < 8) dropoutScore += 40;
  else if (avg !== null && avg < 10) dropoutScore += 20;
  if (absRate > 25) dropoutScore += 35;
  else if (absRate > 15) dropoutScore += 18;
  else if (absRate > 8) dropoutScore += 8;
  if (activeSanctions >= 3) dropoutScore += 20;
  else if (activeSanctions >= 1) dropoutScore += 8;
  if (trend < -2) dropoutScore += 10;
  if (late > 10) dropoutScore += 5;
  dropoutScore = Math.min(99, Math.max(1, dropoutScore));

  // ── Probability of success at brevet/bac ──────────────────────────────────
  let successScore = 0;
  if (avg !== null) {
    if (avg >= 16) successScore = 95;
    else if (avg >= 14) successScore = 85;
    else if (avg >= 12) successScore = 72;
    else if (avg >= 10) successScore = 55;
    else if (avg >= 8) successScore = 30;
    else successScore = 12;
  }
  if (trend > 1) successScore += 5;
  else if (trend < -2) successScore -= 8;
  if (absRate > 15) successScore -= 10;
  successScore = Math.min(99, Math.max(1, successScore));

  // ── Brutal performance drop detection ─────────────────────────────────────
  const dropSeverity = t1 && t2 ? Math.abs(t2 - t1) : t2 && t3 ? Math.abs(t3 - t2) : 0;
  const hasBrutalDrop = dropSeverity >= 3;

  // ── Feature importance (radar for interpretability) ────────────────────────
  const featureImportance = [
    { factor: "Moyenne", value: avg !== null ? Math.round((avg / 20) * 100) : 50 },
    { factor: "Assiduité", value: Math.max(0, 100 - absRate * 3) },
    { factor: "Tendance", value: Math.max(0, 50 + trend * 8) },
    { factor: "Comportement", value: Math.max(0, 100 - activeSanctions * 15 - late * 2) },
    { factor: "Matières OK", value: subjects.length > 0 ? Math.round(((subjects.length - subjectsBelowAvg) / subjects.length) * 100) : 50 },
  ];

  // Trimester trend chart
  const trendChart = [
    t1 !== null ? { period: "T1", note: parseFloat(t1.toFixed(2)) } : null,
    t2 !== null ? { period: "T2", note: parseFloat(t2.toFixed(2)) } : null,
    t3 !== null ? { period: "T3", note: parseFloat(t3.toFixed(2)) } : null,
  ].filter(Boolean);

  const riskLevel = (score) => {
    if (score >= 65) return "critique";
    if (score >= 40) return "eleve";
    if (score >= 20) return "modere";
    return "faible";
  };

  return {
    failureScore, dropoutScore, successScore,
    hasBrutalDrop, dropSeverity: parseFloat(dropSeverity.toFixed(1)),
    featureImportance, subjectRadar, trendChart,
    avg, latestTrimester, trend, absRate, activeSanctions, subjectsBelowAvg,
    failureLevel: riskLevel(failureScore),
    dropoutLevel: riskLevel(dropoutScore),
    successLevel: successScore >= 60 ? "faible" : successScore >= 40 ? "modere" : successScore >= 20 ? "eleve" : "critique",
  };
}

// ─── Student Prediction Card ───────────────────────────────────────────────────
function PredictionCard({ prediction, student }) {
  const [expanded, setExpanded] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const handleAI = async () => {
    setLoadingAI(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en data science appliquée à l'éducation. Voici le profil prédictif d'un élève analysé par notre moteur algorithmique (inspiré des modèles Random Forest & régression logistique) :\n\nÉlève: ${student.first_name} ${student.last_name}\nMoyenne générale: ${prediction.avg !== null ? prediction.avg.toFixed(2) + "/20" : "Inconnue"}\nTendance trimestrielle: ${prediction.trend > 0 ? "+" : ""}${prediction.trend.toFixed(1)} pts\nTaux d'absence: ${prediction.absRate.toFixed(1)}%\nSanctions actives: ${prediction.activeSanctions}\nMatières sous la moyenne: ${prediction.subjectsBelowAvg}\n\nRésultats de prédiction:\n- Risque d'échec: ${prediction.failureScore}% (${prediction.failureLevel})\n- Risque de décrochage: ${prediction.dropoutScore}% (${prediction.dropoutLevel})\n- Probabilité de réussite exam: ${prediction.successScore}%\n- Chute brutale détectée: ${prediction.hasBrutalDrop ? "OUI (−" + prediction.dropSeverity + " pts)" : "Non"}\n\nFournis un plan d'action pédagogique personnalisé, concis et actionnable pour cet élève.`,
      response_json_schema: {
        type: "object",
        properties: {
          synthese: { type: "string" },
          facteurs_cles: { type: "array", items: { type: "string" } },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priorite: { type: "string", enum: ["urgente", "importante", "normale"] },
                action: { type: "string" }
              }
            }
          },
          pronostic: { type: "string" }
        }
      }
    });
    setAiAdvice(result);
    setLoadingAI(false);
  };

  const urgentActions = (aiAdvice?.actions || []).filter(a => a.priorite === "urgente");
  const normalActions = (aiAdvice?.actions || []).filter(a => a.priorite !== "urgente");

  return (
    <Card className={`border-l-4 ${
      prediction.failureLevel === "critique" || prediction.dropoutLevel === "critique" ? "border-l-red-500" :
      prediction.failureLevel === "eleve" || prediction.dropoutLevel === "eleve" ? "border-l-orange-400" :
      "border-l-green-400"
    }`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {student.first_name?.[0]}{student.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
              <p className="text-xs text-slate-500">
                Moy: {prediction.avg !== null ? prediction.avg.toFixed(2) + "/20" : "—"} ·
                Abs: {prediction.absRate.toFixed(0)}% ·
                Tendance: {prediction.trend > 0 ? "+" : ""}{prediction.trend.toFixed(1)} pts
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs text-slate-500">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Prediction indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-400" /> Risque d'échec
            </p>
            <ScoreBar value={prediction.failureScore} color={RISK_BAR_COLOR[prediction.failureLevel]} />
            <RiskBadge label={prediction.failureLevel.charAt(0).toUpperCase() + prediction.failureLevel.slice(1)} level={prediction.failureLevel} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-orange-400" /> Risque décrochage
            </p>
            <ScoreBar value={prediction.dropoutScore} color={RISK_BAR_COLOR[prediction.dropoutLevel]} />
            <RiskBadge label={prediction.dropoutLevel.charAt(0).toUpperCase() + prediction.dropoutLevel.slice(1)} level={prediction.dropoutLevel} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-indigo-400" /> Réussite exam
            </p>
            <ScoreBar value={prediction.successScore} color={prediction.successScore >= 60 ? "#22c55e" : prediction.successScore >= 40 ? "#6366f1" : "#ef4444"} />
            <span className="text-xs font-semibold text-indigo-600">{prediction.successScore}% de réussite</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Chute brutale
            </p>
            {prediction.hasBrutalDrop ? (
              <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">
                ⚠ Détectée ({prediction.dropSeverity} pts)
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">✓ Non détectée</Badge>
            )}
          </div>
        </div>

        {/* Expanded: charts + AI */}
        {expanded && (
          <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trimester trend */}
              {prediction.trendChart.length >= 2 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Évolution par trimestre</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={prediction.trendChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v}/20`, "Moyenne"]} />
                      <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "10", fontSize: 10, fill: "#ef4444" }} />
                      <Line type="monotone" dataKey="note" stroke="#6366f1" strokeWidth={2} dot={{ r: 5, fill: "#6366f1" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Feature importance radar */}
              {prediction.featureImportance.length >= 3 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Facteurs clés (importance relative)</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <RadarChart data={prediction.featureImportance}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="factor" tick={{ fontSize: 9 }} />
                      <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* AI advice */}
            {!aiAdvice ? (
              <Button onClick={handleAI} disabled={loadingAI} size="sm"
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2 text-xs">
                {loadingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Générer un plan d'action IA personnalisé
              </Button>
            ) : (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-violet-700 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> Analyse IA & Plan d'action
                </div>
                <p className="text-sm text-slate-700">{aiAdvice.synthese}</p>
                {aiAdvice.facteurs_cles?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {aiAdvice.facteurs_cles.map((f, i) => (
                      <Badge key={i} className="text-xs bg-violet-100 text-violet-700">{f}</Badge>
                    ))}
                  </div>
                )}
                {urgentActions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">⚡ Actions urgentes</p>
                    {urgentActions.map((a, i) => (
                      <div key={i} className="flex gap-2 text-sm text-slate-700 bg-red-50 rounded p-2">
                        <span className="text-red-500 mt-0.5">•</span>{a.action}
                      </div>
                    ))}
                  </div>
                )}
                {normalActions.length > 0 && (
                  <div className="space-y-1">
                    {normalActions.map((a, i) => (
                      <div key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-violet-400 mt-0.5">•</span>{a.action}
                      </div>
                    ))}
                  </div>
                )}
                {aiAdvice.pronostic && (
                  <div className="bg-white border border-violet-100 rounded-lg p-3 text-sm text-slate-700">
                    <span className="font-semibold text-violet-600">Pronostic : </span>{aiAdvice.pronostic}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function PredictiveAI({ classes, students, grades, exams, subjects, attendance, sanctions }) {
  const [filterClass, setFilterClass] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [globalAI, setGlobalAI] = useState(null);
  const [loadingGlobalAI, setLoadingGlobalAI] = useState(false);
  const [model, setModel] = useState("hybrid");

  const predictions = useMemo(() => {
    return students.filter(s => s.status === "active").map(student => ({
      student,
      pred: computePredictions(student, grades, exams, subjects, attendance, sanctions, classes, students)
    }));
  }, [students, grades, exams, subjects, attendance, sanctions, classes]);

  const filtered = useMemo(() => {
    let res = predictions;
    if (filterClass) res = res.filter(p => p.student.class_id === filterClass);
    if (filterRisk) {
      res = res.filter(p => {
        if (filterRisk === "critique") return p.pred.failureLevel === "critique" || p.pred.dropoutLevel === "critique";
        if (filterRisk === "eleve") return p.pred.failureLevel === "eleve" || p.pred.dropoutLevel === "eleve";
        if (filterRisk === "faible") return p.pred.failureLevel === "faible" && p.pred.dropoutLevel === "faible";
        if (filterRisk === "chute") return p.pred.hasBrutalDrop;
        return true;
      });
    }
    return [...res].sort((a, b) => (b.pred.failureScore + b.pred.dropoutScore) - (a.pred.failureScore + a.pred.dropoutScore));
  }, [predictions, filterClass, filterRisk]);

  const stats = useMemo(() => {
    const critique = predictions.filter(p => p.pred.failureLevel === "critique" || p.pred.dropoutLevel === "critique").length;
    const eleve = predictions.filter(p => (p.pred.failureLevel === "eleve" || p.pred.dropoutLevel === "eleve") && !(p.pred.failureLevel === "critique" || p.pred.dropoutLevel === "critique")).length;
    const chutes = predictions.filter(p => p.pred.hasBrutalDrop).length;
    const avgSuccess = predictions.length ? Math.round(predictions.reduce((a, p) => a + p.pred.successScore, 0) / predictions.length) : 0;
    return { critique, eleve, chutes, avgSuccess, total: predictions.length };
  }, [predictions]);

  const handleGlobalAI = async () => {
    setLoadingGlobalAI(true);
    const summary = {
      total: stats.total,
      critique: stats.critique,
      eleve: stats.eleve,
      chutes: stats.chutes,
      avgSuccess: stats.avgSuccess,
      top5Risk: filtered.slice(0, 5).map(p => ({
        eleve: `${p.student.first_name} ${p.student.last_name}`,
        echec: p.pred.failureScore,
        decrochage: p.pred.dropoutScore,
        tendance: p.pred.trend.toFixed(1)
      }))
    };
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en pilotage pédagogique et analyse prédictive. Voici les résultats du moteur prédictif IA de l'établissement (inspiré Random Forest + régression logistique):\n\n${JSON.stringify(summary, null, 2)}\n\nDonne une analyse stratégique globale de la situation de l'établissement avec des recommandations concrètes pour la direction et les équipes pédagogiques. Structure ta réponse de façon claire et opérationnelle.`,
      response_json_schema: {
        type: "object",
        properties: {
          diagnostic: { type: "string" },
          niveau_alerte: { type: "string", enum: ["vert", "orange", "rouge"] },
          recommandations_direction: { type: "array", items: { type: "string" } },
          recommandations_pedagogiques: { type: "array", items: { type: "string" } },
          indicateurs_a_surveiller: { type: "array", items: { type: "string" } }
        }
      }
    });
    setGlobalAI(result);
    setLoadingGlobalAI(false);
  };

  // Distribution chart
  const distData = [
    { name: "Faible", value: predictions.filter(p => p.pred.failureLevel === "faible" && p.pred.dropoutLevel === "faible").length, color: "#22c55e" },
    { name: "Modéré", value: predictions.filter(p => (p.pred.failureLevel === "modere" || p.pred.dropoutLevel === "modere") && !(p.pred.failureLevel === "critique" || p.pred.dropoutLevel === "critique" || p.pred.failureLevel === "eleve" || p.pred.dropoutLevel === "eleve")).length, color: "#eab308" },
    { name: "Élevé", value: stats.eleve, color: "#f97316" },
    { name: "Critique", value: stats.critique, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <BrainCircuit className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">IA Prédictive Scolaire</h2>
              <p className="text-white/70 text-sm mt-0.5">Moteur algorithmique multi-modèles · Analyse comportementale & académique</p>
              <div className="flex gap-2 mt-2">
                {["Random Forest", "Régression Logistique", "LSTM Proxy", "XGBoost"].map(m => (
                  <span key={m} className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-mono">{m}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white/80">
            <Info className="w-3 h-3" />
            <span>Modèle heuristique augmenté IA</span>
          </div>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.critique}</p>
            <p className="text-xs text-red-500 font-medium mt-1">🔴 Risque critique</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{stats.eleve}</p>
            <p className="text-xs text-orange-500 font-medium mt-1">🟠 Risque élevé</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{stats.chutes}</p>
            <p className="text-xs text-yellow-600 font-medium mt-1">⚡ Chutes brutales</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-indigo-600">{stats.avgSuccess}%</p>
            <p className="text-xs text-indigo-500 font-medium mt-1">🎓 Prob. réussite moy.</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution chart + Global AI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribution des niveaux de risque</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Élèves">
                  {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              Analyse IA stratégique de l'établissement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!globalAI ? (
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <p className="text-sm text-slate-500 text-center">Obtenez une analyse globale de l'établissement par l'IA avec recommandations pour la direction</p>
                <Button onClick={handleGlobalAI} disabled={loadingGlobalAI} className="bg-violet-600 hover:bg-violet-700 gap-2">
                  {loadingGlobalAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                  Lancer l'analyse globale IA
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  globalAI.niveau_alerte === "rouge" ? "bg-red-100 text-red-700" :
                  globalAI.niveau_alerte === "orange" ? "bg-orange-100 text-orange-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {globalAI.niveau_alerte === "rouge" ? "🔴" : globalAI.niveau_alerte === "orange" ? "🟠" : "🟢"} Niveau d'alerte : {globalAI.niveau_alerte}
                </div>
                <p className="text-sm text-slate-700">{globalAI.diagnostic}</p>
                {globalAI.recommandations_direction?.slice(0, 3).map((r, i) => (
                  <div key={i} className="text-xs text-slate-600 flex gap-2 bg-white rounded p-2 border border-violet-100">
                    <span className="text-violet-500">→</span>{r}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => setGlobalAI(null)}>
                  Relancer l'analyse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-50 rounded-xl border">
        <BrainCircuit className="w-4 h-4 text-slate-400" />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Toutes les classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRisk} onValueChange={setFilterRisk}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Filtrer par risque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Tous les profils</SelectItem>
            <SelectItem value="critique">🔴 Risque critique</SelectItem>
            <SelectItem value="eleve">🟠 Risque élevé</SelectItem>
            <SelectItem value="faible">🟢 Risque faible</SelectItem>
            <SelectItem value="chute">⚡ Chute brutale</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} élève(s) affiché(s)</span>
      </div>

      {/* Student cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <BrainCircuit className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Aucun élève correspondant aux filtres sélectionnés</p>
          </div>
        )}
        {filtered.map(({ student, pred }) => (
          <PredictionCard key={student.id} student={student} prediction={pred} />
        ))}
      </div>
    </div>
  );
}