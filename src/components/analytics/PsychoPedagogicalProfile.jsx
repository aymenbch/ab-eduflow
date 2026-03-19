import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Sparkles, Loader2, Eye, Ear, Hand, Lightbulb, Palette,
  Frown, Zap, ChevronRight, ChevronDown, User, Filter
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from "recharts";

// ─── Heuristic psycho-pedagogical engine ──────────────────────────────────────
function computePsychoProfile(student, grades, exams, subjects, attendance, sanctions, homeworks = []) {
  const sg = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);

  // Subject performance by domain
  const subjectScores = {};
  sg.forEach(g => {
    const exam = exams.find(e => e.id === g.exam_id);
    if (!exam) return;
    const sub = subjects.find(s => s.id === exam.subject_id);
    if (!sub) return;
    if (!subjectScores[sub.name]) subjectScores[sub.name] = [];
    subjectScores[sub.name].push(g.score);
  });
  const subjectAvgs = Object.fromEntries(
    Object.entries(subjectScores).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])
  );

  // Classify subjects by learning style proxy
  const isVisual = (name) => /art|dessin|géo|géographie|sciences|svt|hist|biologie|physique/i.test(name);
  const isAuditory = (name) => /musique|langue|oral|français|littérature|anglais|espagnol|arabe/i.test(name);
  const isKinesthetic = (name) => /sport|eps|technologie|chimie|labo|tp|pratique/i.test(name);
  const isAnalytical = (name) => /math|physique|chimie|logique|info|algorith/i.test(name);
  const isCreative = (name) => /art|dessin|musique|littérature|créat|expression/i.test(name);

  const domainScore = (classifier) => {
    const matching = Object.entries(subjectAvgs).filter(([name]) => classifier(name));
    return matching.length ? matching.reduce((a, [, v]) => a + v, 0) / matching.length : null;
  };

  const visualScore = domainScore(isVisual) ?? (Object.values(subjectAvgs).reduce((a, b) => a + b, 0) / (Object.keys(subjectAvgs).length || 1));
  const auditoryScore = domainScore(isAuditory) ?? visualScore * 0.9;
  const kinestheticScore = domainScore(isKinesthetic) ?? visualScore * 0.85;
  const analyticalScore = domainScore(isAnalytical) ?? visualScore * 0.95;
  const creativeScore = domainScore(isCreative) ?? visualScore * 0.8;

  // Normalize to 0-100
  const norm = (v, max = 20) => Math.round(Math.min(100, Math.max(0, (v / max) * 100)));

  // Dominant learning style
  const styles = [
    { name: "Visuel", score: norm(visualScore), icon: "👁️", color: "#3b82f6" },
    { name: "Auditif", score: norm(auditoryScore), icon: "👂", color: "#8b5cf6" },
    { name: "Kinesthésique", score: norm(kinestheticScore), icon: "✋", color: "#10b981" },
  ];
  const dominantStyle = styles.reduce((a, b) => a.score > b.score ? a : b);

  // Analytical vs creative profile
  const analyticalNorm = norm(analyticalScore);
  const creativeNorm = norm(creativeScore);
  const profileType = analyticalNorm > creativeNorm + 10 ? "analytique"
    : creativeNorm > analyticalNorm + 10 ? "créatif"
    : "mixte";

  // Attendance-based stress & demotivation
  const att = attendance.filter(a => a.student_id === student.id);
  const absRate = att.length ? (att.filter(a => a.status === "absent").length / att.length) * 100 : 0;
  const lateCount = att.filter(a => a.status === "late").length;

  // Trimester trend
  const tAvg = (t) => {
    const te = exams.filter(e => e.trimester === t).map(e => e.id);
    const tg = sg.filter(g => te.includes(g.exam_id));
    return tg.length ? tg.reduce((a, b) => a + b.score, 0) / tg.length : null;
  };
  const t1 = tAvg("T1"), t2 = tAvg("T2"), t3 = tAvg("T3");
  const latestTrend = t3 && t2 ? t3 - t2 : t2 && t1 ? t2 - t1 : 0;

  // Active sanctions
  const activeSanctions = sanctions.filter(s => s.student_id === student.id && !s.resolved).length;
  const totalSanctions = sanctions.filter(s => s.student_id === student.id).length;

  // ── Demotivation score (0-100) ────────────────────────────────────────────
  let demotivation = 0;
  if (absRate > 20) demotivation += 35;
  else if (absRate > 10) demotivation += 18;
  if (latestTrend < -2) demotivation += 25;
  else if (latestTrend < -0.5) demotivation += 12;
  if (lateCount > 8) demotivation += 15;
  else if (lateCount > 3) demotivation += 7;
  const overallAvg = sg.length ? sg.reduce((a, b) => a + b.score, 0) / sg.length : null;
  if (overallAvg !== null && overallAvg < 8) demotivation += 20;
  else if (overallAvg !== null && overallAvg < 10) demotivation += 10;
  demotivation = Math.min(95, Math.max(0, demotivation));

  // ── Stress score (0-100) ──────────────────────────────────────────────────
  let stress = 0;
  if (activeSanctions >= 3) stress += 30;
  else if (activeSanctions >= 1) stress += 15;
  if (totalSanctions >= 5) stress += 15;
  // High variance in scores = stress indicator
  if (sg.length > 3) {
    const avgScore = sg.reduce((a, b) => a + b.score, 0) / sg.length;
    const variance = sg.reduce((a, g) => a + Math.pow(g.score - avgScore, 2), 0) / sg.length;
    if (variance > 16) stress += 25; // std dev > 4
    else if (variance > 9) stress += 12;
  }
  if (absRate > 15) stress += 15;
  if (latestTrend < -3) stress += 15;
  stress = Math.min(95, Math.max(0, stress));

  // ── Radar data for profile visualization ──────────────────────────────────
  const radarData = [
    { dimension: "Autonomie", value: Math.max(20, norm(analyticalScore) - stress / 4) },
    { dimension: "Créativité", value: creativeNorm },
    { dimension: "Rigueur", value: analyticalNorm },
    { dimension: "Assiduité", value: Math.max(5, 100 - Math.round(absRate * 3)) },
    { dimension: "Stabilité", value: Math.max(10, 100 - stress) },
    { dimension: "Motivation", value: Math.max(5, 100 - demotivation) },
  ];

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = [];
  if (dominantStyle.name === "Visuel") recommendations.push("Privilégier les schémas, cartes mentales et supports visuels");
  if (dominantStyle.name === "Auditif") recommendations.push("Favoriser les discussions orales, podcasts éducatifs et explications verbales");
  if (dominantStyle.name === "Kinesthésique") recommendations.push("Encourager les travaux pratiques, manipulations et apprentissage par l'action");
  if (profileType === "analytique") recommendations.push("Proposer des exercices structurés avec étapes logiques claires");
  if (profileType === "créatif") recommendations.push("Laisser de la liberté dans les productions et valoriser l'expression personnelle");
  if (demotivation > 50) recommendations.push("Entretien de remobilisation urgent — fixer des objectifs à court terme accessibles");
  if (stress > 50) recommendations.push("Évaluer les sources de pression — envisager un accompagnement psychologique");
  if (absRate > 15) recommendations.push("Contacter la famille pour comprendre les raisons d'absentéisme répété");

  return {
    styles, dominantStyle, profileType,
    analyticalNorm, creativeNorm,
    demotivation, stress,
    radarData, recommendations,
    absRate, lateCount, activeSanctions, overallAvg, latestTrend
  };
}

// ─── Single student profile card ───────────────────────────────────────────────
function ProfileCard({ student, profile, classes }) {
  const [expanded, setExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const cls = classes.find(c => c.id === student.class_id);

  const demotivationLevel = profile.demotivation >= 60 ? "élevée" : profile.demotivation >= 35 ? "modérée" : "faible";
  const stressLevel = profile.stress >= 60 ? "élevé" : profile.stress >= 35 ? "modéré" : "faible";

  const handleAI = async () => {
    setLoadingAI(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un psychologue scolaire et expert en neurosciences de l'apprentissage. Voici le profil psychopédagogique d'un élève analysé automatiquement:\n\nÉlève: ${student.first_name} ${student.last_name}\nClasse: ${cls?.name || "—"}\nMoyenne générale: ${profile.overallAvg !== null ? profile.overallAvg.toFixed(2) + "/20" : "Inconnue"}\n\nProfil d'apprentissage:\n- Style dominant: ${profile.dominantStyle.name} (${profile.dominantStyle.score}%)\n- Profil cognitif: ${profile.profileType}\n- Score analytique: ${profile.analyticalNorm}%\n- Score créatif: ${profile.creativeNorm}%\n\nIndicateurs comportementaux:\n- Démotivation: ${profile.demotivation}% (${demotivationLevel})\n- Stress: ${profile.stress}% (${stressLevel})\n- Taux d'absence: ${profile.absRate.toFixed(1)}%\n- Retards: ${profile.lateCount}\n- Sanctions actives: ${profile.activeSanctions}\n- Tendance notes: ${profile.latestTrend > 0 ? "+" : ""}${profile.latestTrend.toFixed(1)} pts\n\nDonne un profil psychopédagogique complet avec des recommandations concrètes pour l'enseignant et pour les parents.`,
      response_json_schema: {
        type: "object",
        properties: {
          profil_synthetique: { type: "string" },
          type_apprenant: { type: "string" },
          forces: { type: "array", items: { type: "string" } },
          points_attention: { type: "array", items: { type: "string" } },
          conseils_enseignant: { type: "array", items: { type: "string" } },
          conseils_parents: { type: "array", items: { type: "string" } },
          message_bienveillant: { type: "string" }
        }
      }
    });
    setAiAnalysis(result);
    setLoadingAI(false);
  };

  const borderColor = profile.stress >= 60 || profile.demotivation >= 60 ? "border-l-red-400"
    : profile.stress >= 35 || profile.demotivation >= 35 ? "border-l-orange-400"
    : "border-l-indigo-400";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {student.first_name?.[0]}{student.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
              <p className="text-xs text-slate-500">{cls?.name || "—"} · Moy: {profile.overallAvg !== null ? profile.overallAvg.toFixed(1) + "/20" : "—"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Key indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {/* Dominant style */}
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <span className="text-2xl">{profile.dominantStyle.icon}</span>
            <p className="text-xs font-semibold text-blue-700 mt-1">{profile.dominantStyle.name}</p>
            <p className="text-xs text-blue-500">Style dominant</p>
          </div>

          {/* Profile type */}
          <div className={`rounded-xl p-3 text-center border ${profile.profileType === "analytique" ? "bg-indigo-50 border-indigo-100" : profile.profileType === "créatif" ? "bg-pink-50 border-pink-100" : "bg-purple-50 border-purple-100"}`}>
            {profile.profileType === "analytique" ? <Lightbulb className="w-5 h-5 mx-auto text-indigo-500" /> : profile.profileType === "créatif" ? <Palette className="w-5 h-5 mx-auto text-pink-500" /> : <Brain className="w-5 h-5 mx-auto text-purple-500" />}
            <p className={`text-xs font-semibold mt-1 ${profile.profileType === "analytique" ? "text-indigo-700" : profile.profileType === "créatif" ? "text-pink-700" : "text-purple-700"}`}>
              {profile.profileType.charAt(0).toUpperCase() + profile.profileType.slice(1)}
            </p>
            <p className="text-xs text-slate-400">Profil cognitif</p>
          </div>

          {/* Demotivation */}
          <div className={`rounded-xl p-3 border ${profile.demotivation >= 60 ? "bg-red-50 border-red-200" : profile.demotivation >= 35 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
            <Frown className={`w-5 h-5 mx-auto ${profile.demotivation >= 60 ? "text-red-500" : profile.demotivation >= 35 ? "text-orange-500" : "text-green-500"}`} />
            <p className={`text-xs font-semibold text-center mt-1 ${profile.demotivation >= 60 ? "text-red-700" : profile.demotivation >= 35 ? "text-orange-700" : "text-green-700"}`}>
              Démotivation {demotivationLevel}
            </p>
            <p className="text-xs text-slate-400 text-center">{profile.demotivation}%</p>
          </div>

          {/* Stress */}
          <div className={`rounded-xl p-3 border ${profile.stress >= 60 ? "bg-red-50 border-red-200" : profile.stress >= 35 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
            <Zap className={`w-5 h-5 mx-auto ${profile.stress >= 60 ? "text-red-500" : profile.stress >= 35 ? "text-yellow-500" : "text-green-500"}`} />
            <p className={`text-xs font-semibold text-center mt-1 ${profile.stress >= 60 ? "text-red-700" : profile.stress >= 35 ? "text-yellow-700" : "text-green-700"}`}>
              Stress {stressLevel}
            </p>
            <p className="text-xs text-slate-400 text-center">{profile.stress}%</p>
          </div>
        </div>

        {/* Style bars */}
        <div className="space-y-1.5 mb-3">
          {profile.styles.map(s => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="text-sm w-6">{s.icon}</span>
              <span className="text-xs text-slate-500 w-24">{s.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${s.score}%`, backgroundColor: s.color }} />
              </div>
              <span className="text-xs font-medium text-slate-600 w-8 text-right">{s.score}%</span>
            </div>
          ))}
        </div>

        {/* Quick recommendations */}
        {profile.recommendations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.recommendations.slice(0, 2).map((r, i) => (
              <Badge key={i} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 whitespace-normal h-auto py-1">
                {r}
              </Badge>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
            {/* Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Profil psychopédagogique global</p>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={profile.radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Analytique vs Créatif</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[
                    { name: "Analytique", value: profile.analyticalNorm, color: "#6366f1" },
                    { name: "Créatif", value: profile.creativeNorm, color: "#ec4899" },
                    { name: "Motivation", value: Math.max(5, 100 - profile.demotivation), color: "#22c55e" },
                    { name: "Bien-être", value: Math.max(5, 100 - profile.stress), color: "#f59e0b" },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v}%`]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {[{ color: "#6366f1" }, { color: "#ec4899" }, { color: "#22c55e" }, { color: "#f59e0b" }].map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* All recommendations */}
            {profile.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Recommandations pédagogiques</p>
                <div className="space-y-1">
                  {profile.recommendations.map((r, i) => (
                    <div key={i} className="flex gap-2 text-sm text-slate-600 bg-violet-50 rounded-lg px-3 py-2">
                      <span className="text-violet-400">→</span>{r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI deep analysis */}
            {!aiAnalysis ? (
              <Button onClick={handleAI} disabled={loadingAI} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-2 text-sm">
                {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analyse psychopédagogique approfondie par l'IA
              </Button>
            ) : (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <span className="font-semibold text-violet-700 text-sm">Analyse psychopédagogique IA</span>
                  {aiAnalysis.type_apprenant && (
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 ml-auto">{aiAnalysis.type_apprenant}</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{aiAnalysis.profil_synthetique}</p>

                {aiAnalysis.forces?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-1">💪 Forces</p>
                    <div className="flex flex-wrap gap-1">
                      {aiAnalysis.forces.map((f, i) => <Badge key={i} className="text-xs bg-green-50 text-green-700 border-green-200">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {aiAnalysis.points_attention?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-700 mb-1">⚠️ Points d'attention</p>
                    <div className="flex flex-wrap gap-1">
                      {aiAnalysis.points_attention.map((f, i) => <Badge key={i} className="text-xs bg-orange-50 text-orange-700 border-orange-200">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {aiAnalysis.conseils_enseignant?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">👨‍🏫 Conseils pour l'enseignant</p>
                    <div className="space-y-1">
                      {aiAnalysis.conseils_enseignant.map((c, i) => (
                        <div key={i} className="text-xs text-slate-600 flex gap-2 bg-blue-50 rounded p-2">
                          <span className="text-blue-400">•</span>{c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.conseils_parents?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">👨‍👩‍👧 Conseils pour les parents</p>
                    <div className="space-y-1">
                      {aiAnalysis.conseils_parents.map((c, i) => (
                        <div key={i} className="text-xs text-slate-600 flex gap-2 bg-amber-50 rounded p-2">
                          <span className="text-amber-400">•</span>{c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.message_bienveillant && (
                  <div className="bg-white border border-violet-100 rounded-lg p-3 text-sm text-slate-700 italic">
                    💬 "{aiAnalysis.message_bienveillant}"
                  </div>
                )}

                <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => setAiAnalysis(null)}>
                  Relancer l'analyse
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function PsychoPedagogicalProfile({ classes, students, grades, exams, subjects, attendance, sanctions }) {
  const [filterClass, setFilterClass] = useState("_all");
  const [filterAlert, setFilterAlert] = useState("_all");

  const profiles = useMemo(() => {
    return students.filter(s => s.status === "active").map(student => ({
      student,
      profile: computePsychoProfile(student, grades, exams, subjects, attendance, sanctions)
    }));
  }, [students, grades, exams, subjects, attendance, sanctions]);

  const filtered = useMemo(() => {
    let res = profiles;
    if (filterClass && filterClass !== "_all") res = res.filter(p => p.student.class_id === filterClass);
    if (filterAlert === "demotivation") res = res.filter(p => p.profile.demotivation >= 35);
    if (filterAlert === "stress") res = res.filter(p => p.profile.stress >= 35);
    if (filterAlert === "visuel") res = res.filter(p => p.profile.dominantStyle.name === "Visuel");
    if (filterAlert === "auditif") res = res.filter(p => p.profile.dominantStyle.name === "Auditif");
    if (filterAlert === "kinesthesique") res = res.filter(p => p.profile.dominantStyle.name === "Kinesthésique");
    if (filterAlert === "analytique") res = res.filter(p => p.profile.profileType === "analytique");
    if (filterAlert === "creatif") res = res.filter(p => p.profile.profileType === "créatif");
    return [...res].sort((a, b) => (b.profile.demotivation + b.profile.stress) - (a.profile.demotivation + a.profile.stress));
  }, [profiles, filterClass, filterAlert]);

  const stats = {
    demotivated: profiles.filter(p => p.profile.demotivation >= 50).length,
    stressed: profiles.filter(p => p.profile.stress >= 50).length,
    visual: profiles.filter(p => p.profile.dominantStyle.name === "Visuel").length,
    auditory: profiles.filter(p => p.profile.dominantStyle.name === "Auditif").length,
    kinesthetic: profiles.filter(p => p.profile.dominantStyle.name === "Kinesthésique").length,
    analytical: profiles.filter(p => p.profile.profileType === "analytique").length,
    creative: profiles.filter(p => p.profile.profileType === "créatif").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 via-violet-700 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="flex items-center gap-4 relative">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Profil Psychopédagogique IA</h2>
            <p className="text-white/70 text-sm mt-0.5">Analyse automatique du style d'apprentissage, motivation et bien-être de chaque élève</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {["Style VAK", "Analytique/Créatif", "Détection démotivation", "Détection stress"].map(tag => (
                <span key={tag} className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center">
            <Frown className="w-6 h-6 mx-auto text-red-400 mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.demotivated}</p>
            <p className="text-xs text-red-500">Démotivation élevée</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold text-yellow-600">{stats.stressed}</p>
            <p className="text-xs text-yellow-600">Stress élevé détecté</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <Eye className="w-6 h-6 mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.visual}</p>
            <p className="text-xs text-blue-500">Apprenants visuels</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-4 text-center">
            <Lightbulb className="w-6 h-6 mx-auto text-indigo-400 mb-1" />
            <p className="text-2xl font-bold text-indigo-600">{stats.analytical}</p>
            <p className="text-xs text-indigo-500">Profil analytique</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" />Distribution styles d'apprentissage (VAK)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={[
                { name: "👁️ Visuel", value: stats.visual, color: "#3b82f6" },
                { name: "👂 Auditif", value: stats.auditory, color: "#8b5cf6" },
                { name: "✋ Kinesthés.", value: stats.kinesthetic, color: "#10b981" },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[{ color: "#3b82f6" }, { color: "#8b5cf6" }, { color: "#10b981" }].map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-purple-500" />Profils cognitifs</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={[
                { name: "🔢 Analytique", value: stats.analytical, color: "#6366f1" },
                { name: "🎨 Créatif", value: stats.creative, color: "#ec4899" },
                { name: "⚖️ Mixte", value: profiles.length - stats.analytical - stats.creative, color: "#8b5cf6" },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[{ color: "#6366f1" }, { color: "#ec4899" }, { color: "#8b5cf6" }].map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-50 rounded-xl border">
        <Filter className="w-4 h-4 text-slate-400" />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes les classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAlert} onValueChange={setFilterAlert}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Filtrer par profil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les profils</SelectItem>
            <SelectItem value="demotivation">😔 Démotivation détectée</SelectItem>
            <SelectItem value="stress">⚡ Stress détecté</SelectItem>
            <SelectItem value="visuel">👁️ Style visuel</SelectItem>
            <SelectItem value="auditif">👂 Style auditif</SelectItem>
            <SelectItem value="kinesthesique">✋ Style kinesthésique</SelectItem>
            <SelectItem value="analytique">🔢 Profil analytique</SelectItem>
            <SelectItem value="creatif">🎨 Profil créatif</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} élève(s) affiché(s)</span>
      </div>

      {/* Student cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Aucun élève correspondant</p>
          </div>
        )}
        {filtered.map(({ student, profile }) => (
          <ProfileCard key={student.id} student={student} profile={profile} classes={classes} />
        ))}
      </div>
    </div>
  );
}