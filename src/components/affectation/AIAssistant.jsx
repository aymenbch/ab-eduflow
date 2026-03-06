import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Bot, Sparkles, Loader2, ChevronDown, ChevronUp,
  CheckCircle, Zap, Users, TrendingUp, Shield, Play, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIMIZATION_MODES = [
  {
    id: "optimal",
    label: "Répartition optimale",
    icon: Sparkles,
    description: "Distribution équilibrée de la charge de travail",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    activeRing: "ring-indigo-400",
    prompt: "Équilibre la charge de travail entre tous les enseignants. Chaque enseignant ne doit pas dépasser 6 classes. Assure-toi que chaque matière est couverte dans chaque classe.",
  },
  {
    id: "conflicts",
    label: "Minimiser les conflits",
    icon: Shield,
    description: "Éviter les doubles affectations et incompatibilités",
    color: "text-red-600 bg-red-50 border-red-200",
    activeRing: "ring-red-400",
    prompt: "Évite qu'un enseignant soit affecté à plus de 4 classes. Respecte strictement la spécialisation des enseignants (n'affecte un enseignant que pour les matières de ses subject_ids). Minimise les conflits.",
  },
  {
    id: "seniority",
    label: "Selon ancienneté",
    icon: Users,
    description: "Prioriser les enseignants expérimentés",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    activeRing: "ring-amber-400",
    prompt: "Affecte les enseignants les plus anciens (hire_date le plus ancien) aux classes de niveau le plus élevé (Terminale, 1ère, 3ème). Les nouveaux enseignants prennent les niveaux inférieurs.",
  },
  {
    id: "results",
    label: "Selon résultats élèves",
    icon: TrendingUp,
    description: "Optimiser selon les performances historiques",
    color: "text-green-600 bg-green-50 border-green-200",
    activeRing: "ring-green-400",
    prompt: "Affecte les enseignants les plus expérimentés (ancienneté élevée) aux classes de niveaux difficiles. Utilise des enseignants généralistes pour diversifier l'approche pédagogique.",
  },
];

export default function AIAssistant({ teachers, subjects, classes, assignments, onApplyAssignments }) {
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [aiAssignments, setAiAssignments] = useState(null);
  const [applied, setApplied] = useState(false);

  const buildPrompt = (mode) => {
    const teacherList = teachers.map(t => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`,
      seniority: t.hire_date ? new Date().getFullYear() - new Date(t.hire_date).getFullYear() : 0,
      subject_ids: t.subject_ids || [],
    }));

    const classList = classes.map(c => ({ id: c.id, name: c.name, level: c.level }));
    const subjectList = subjects.map(s => ({ id: s.id, name: s.name, code: s.code }));

    return `Tu es un système expert en gestion scolaire. Tu dois générer des affectations concrètes d'enseignants à des couples (matière, classe).

**Mode d'optimisation : ${mode.label}**
**Règle : ${mode.prompt}**

**Enseignants disponibles :**
${JSON.stringify(teacherList, null, 2)}

**Classes :**
${JSON.stringify(classList, null, 2)}

**Matières :**
${JSON.stringify(subjectList, null, 2)}

**Règles importantes :**
- Si un enseignant a des subject_ids non vides, il ne peut enseigner QUE ces matières (utilise leurs IDs).
- Si subject_ids est vide, il est généraliste et peut enseigner toutes les matières.
- Ne génère qu'une affectation par couple (subject_id, class_id).
- Génère les affectations les plus pertinentes selon le mode choisi.

Retourne un JSON avec exactement ce format :
{
  "analysis": "Explication courte de la stratégie (2-3 phrases)",
  "stats": "Résumé statistique (ex: 12 affectations, charge moyenne 3.5 classes/enseignant)",
  "assignments": [
    { "subject_id": "...", "class_id": "...", "teacher_id": "...", "reason": "Raison courte" }
  ]
}`;
  };

  const generateAndApply = async () => {
    if (!selectedMode) return;
    setLoading(true);
    setAnalysis(null);
    setAiAssignments(null);
    setApplied(false);

    const mode = OPTIMIZATION_MODES.find(m => m.id === selectedMode);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(mode),
      response_json_schema: {
        type: "object",
        properties: {
          analysis: { type: "string" },
          stats: { type: "string" },
          assignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                subject_id: { type: "string" },
                class_id: { type: "string" },
                teacher_id: { type: "string" },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    });

    setAnalysis({ text: result.analysis, stats: result.stats });
    setAiAssignments(result.assignments || []);
    setLoading(false);
  };

  const applyToGrid = () => {
    if (!aiAssignments) return;
    // Build new assignments map from AI result
    const newMap = { ...assignments };
    aiAssignments.forEach(({ subject_id, class_id, teacher_id }) => {
      const key = `${subject_id}|${class_id}`;
      const current = newMap[key] || [];
      if (!current.includes(teacher_id)) {
        newMap[key] = [...current, teacher_id];
      }
    });
    onApplyAssignments(newMap);
    setApplied(true);
  };

  const resetAI = () => {
    setAnalysis(null);
    setAiAssignments(null);
    setApplied(false);
  };

  const getTeacherName = (id) => {
    const t = teachers.find(t => t.id === id);
    return t ? `${t.first_name} ${t.last_name}` : id;
  };
  const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || id;
  const getClassName = (id) => classes.find(c => c.id === id)?.name || id;

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-95 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Assistant IA d'Affectation</p>
            <p className="text-xs text-indigo-200">Génération automatique + ajustement manuel possible</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* Mode selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Mode d'optimisation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPTIMIZATION_MODES.map(mode => {
                const Icon = mode.icon;
                const isActive = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => { setSelectedMode(mode.id); resetAI(); }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isActive ? `${mode.color} ring-2 ${mode.activeRing}` : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? "" : "text-slate-400"}`} />
                    <div>
                      <p className={`text-xs font-semibold ${isActive ? "" : "text-slate-700"}`}>{mode.label}</p>
                      <p className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-400"}`}>{mode.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={generateAndApply}
            disabled={!selectedMode || loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> L'IA analyse et génère les affectations...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Générer les affectations IA</>
            )}
          </Button>

          {/* AI Result */}
          {analysis && aiAssignments && (
            <div className="space-y-3">
              {/* Analysis */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-indigo-800">Analyse IA</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{analysis.text}</p>
                {analysis.stats && (
                  <p className="text-xs text-indigo-600 font-medium mt-2">📊 {analysis.stats}</p>
                )}
              </div>

              {/* Assignments preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    {aiAssignments.length} affectations proposées
                  </p>
                  {applied && (
                    <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Appliquées dans la grille
                    </span>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {aiAssignments.map((a, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {getSubjectName(a.subject_id)}
                          </span>
                          <span className="text-[11px] text-slate-400">→</span>
                          <span className="text-[11px] font-medium text-slate-700">
                            {getClassName(a.class_id)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          👤 {getTeacherName(a.teacher_id)}
                          {a.reason && <span className="text-slate-400"> — {a.reason}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              {!applied ? (
                <div className="flex gap-2">
                  <Button
                    onClick={applyToGrid}
                    className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Appliquer dans la grille
                  </Button>
                  <Button
                    onClick={resetAI}
                    variant="outline"
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réessayer
                  </Button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Affectations appliquées dans la grille</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Vous pouvez maintenant ajuster manuellement en glissant des enseignants ou en supprimant des cellules, puis cliquez sur <strong>Enregistrer</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}