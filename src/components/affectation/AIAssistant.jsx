import React, { useState } from "react";
import {
  Bot, Sparkles, Loader2, ChevronDown, ChevronUp,
  CheckCircle, Zap, Users, TrendingUp, Shield, Play, RotateCcw, Info
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
  },
  {
    id: "conflicts",
    label: "Minimiser les conflits",
    icon: Shield,
    description: "Éviter les doubles affectations et incompatibilités",
    color: "text-red-600 bg-red-50 border-red-200",
    activeRing: "ring-red-400",
  },
  {
    id: "seniority",
    label: "Selon ancienneté",
    icon: Users,
    description: "Prioriser les enseignants expérimentés",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    activeRing: "ring-amber-400",
  },
  {
    id: "results",
    label: "Selon résultats élèves",
    icon: TrendingUp,
    description: "Optimiser selon les performances historiques",
    color: "text-green-600 bg-green-50 border-green-200",
    activeRing: "ring-green-400",
  },
];

/** Explication détaillée + exemple concret pour chaque mode */
const LOGIC_EXPLANATIONS = {
  optimal: {
    title: "Comment fonctionne la répartition optimale ?",
    steps: [
      "L'algorithme initialise le compteur de charge de chaque enseignant actif à 0.",
      "Pour chaque couple (matière × classe), il sélectionne l'enseignant éligible avec le moins d'affectations en cours.",
      "La charge est incrémentée après chaque affectation — garantissant un équilibre maximal entre tous.",
    ],
    example: "Ex. : Jean a 2 affectations, Marie en a 3 → Jean reçoit la prochaine car sa charge est plus faible.",
  },
  conflicts: {
    title: "Comment fonctionne la minimisation des conflits ?",
    steps: [
      "Chaque enseignant est limité strictement à 4 classes maximum (plafond dur infranchissable).",
      "Seuls les enseignants dont les matières enregistrées incluent la discipline concernée sont éligibles.",
      "Si aucun enseignant ne peut prendre la matière sans dépasser le plafond, la contrainte est relâchée.",
    ],
    example: "Ex. : Ahmed enseigne Maths uniquement. Il ne sera jamais affecté à Français, même s'il est disponible.",
  },
  seniority: {
    title: "Comment fonctionne le tri par ancienneté ?",
    steps: [
      "Les classes sont classées par rang de difficulté décroissant : Terminale (10) → 1ère (9) → 2ème AS (8)...",
      "Pour chaque niveau, l'enseignant ayant la plus grande ancienneté (date d'embauche la plus ancienne) est prioritaire.",
      "Les enseignants récents reçoivent en retour les niveaux inférieurs.",
    ],
    example: "Ex. : M. Benali (15 ans) → Terminale Scientifique. Mme Saidi (2 ans) → 6ème Primaire.",
  },
  results: {
    title: "Comment fonctionne l'optimisation par résultats ?",
    steps: [
      "Le système calcule la moyenne historique des notes des élèves de chaque enseignant.",
      "Les enseignants avec les meilleures moyennes sont affectés en priorité aux classes prioritaires.",
      "Un enseignant sans historique reçoit une note de performance par défaut de 10/20.",
    ],
    example: "Ex. : M. Cherif (moy. élèves 14.2/20) → Terminale prioritaire. M. Karim (11.5/20) → 4ème AP.",
  },
};

export default function AIAssistant({ teachers, subjects, classes, assignments, onApplyAssignments }) {
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [aiAssignments, setAiAssignments] = useState(null);
  const [applied, setApplied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const generateAndApply = async () => {
    if (!selectedMode) return;
    setLoading(true);
    setAnalysis(null);
    setAiAssignments(null);
    setApplied(false);
    setShowAll(false);

    try {
      const session = JSON.parse(localStorage.getItem('edugest_session') || '{}');
      const headers = { 'Content-Type': 'application/json' };
      if (session.token) headers['X-Session-Token'] = session.token;
      if (session.id)    headers['X-User-Id']        = session.id;

      const res = await fetch('/api/ai/affectation-enseignants', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: selectedMode, teachers, classes, subjects }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setAnalysis({ text: result.analysis, stats: result.stats });
      setAiAssignments(result.assignments || []);
    } catch (err) {
      setAnalysis({ text: `Erreur : ${err.message}`, stats: '' });
      setAiAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const applyToGrid = () => {
    if (!aiAssignments) return;
    const newMap = { ...assignments };
    aiAssignments.forEach(({ subject_id, class_id, teacher_id }) => {
      const key = `${subject_id}|${class_id}`;
      const current = newMap[key] || [];
      if (!current.includes(teacher_id)) newMap[key] = [...current, teacher_id];
    });
    onApplyAssignments(newMap);
    setApplied(true);
  };

  const resetAI = () => {
    setAnalysis(null);
    setAiAssignments(null);
    setApplied(false);
    setShowAll(false);
  };

  const getTeacherName = (id) => {
    const t = teachers.find(t => t.id === id);
    return t ? `${t.first_name} ${t.last_name}` : id;
  };
  const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || id;
  const getClassName   = (id) => classes.find(c => c.id === id)?.name || id;

  const logic    = selectedMode ? LOGIC_EXPLANATIONS[selectedMode] : null;
  const examples = aiAssignments ? aiAssignments.slice(0, 3) : [];
  const rest     = aiAssignments ? aiAssignments.slice(3) : [];

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

          {/* Explication du mode sélectionné (avant génération) */}
          {logic && !aiAssignments && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800">{logic.title}</p>
              </div>
              <ol className="space-y-1.5 mb-3">
                {logic.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5 italic border border-amber-200">
                💡 {logic.example}
              </p>
            </div>
          )}

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

              {/* Résumé analyse */}
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

              {/* Logique utilisée (rappel après génération) */}
              {logic && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Logique appliquée — {logic.title.replace("Comment fonctionne ", "").replace(" ?", "")}</p>
                  </div>
                  <ol className="space-y-1.5 mb-3">
                    {logic.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700">
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11px] text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5 italic border border-amber-200">
                    💡 {logic.example}
                  </p>
                </div>
              )}

              {/* 3 exemples concrets issus du résultat */}
              {examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    🎯 Exemples concrets générés
                  </p>
                  <div className="space-y-2">
                    {examples.map((a, i) => (
                      <div key={i} className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                            {getSubjectName(a.subject_id)}
                          </span>
                          <span className="text-slate-400 text-xs">→</span>
                          <span className="text-[11px] font-semibold text-slate-700">
                            {getClassName(a.class_id)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          <span className="font-semibold">👤 {getTeacherName(a.teacher_id)}</span>
                          {a.reason && (
                            <span className="text-indigo-600 ml-2 italic">· {a.reason}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Liste complète */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    {aiAssignments.length} affectations proposées au total
                  </p>
                  {applied && (
                    <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Appliquées dans la grille
                    </span>
                  )}
                </div>
                <div className={`${showAll ? "max-h-96" : "max-h-40"} overflow-y-auto divide-y divide-slate-100`}>
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
                {rest.length > 0 && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full text-center text-[11px] text-indigo-600 font-medium py-2 hover:bg-slate-50 border-t border-slate-100"
                  >
                    {showAll ? "▲ Réduire la liste" : `▼ Voir les ${rest.length} autres affectations`}
                  </button>
                )}
              </div>

              {/* Action buttons */}
              {!applied ? (
                <div className="flex gap-2">
                  <Button onClick={applyToGrid} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                    <Play className="w-4 h-4" />
                    Appliquer dans la grille
                  </Button>
                  <Button onClick={resetAI} variant="outline" className="gap-2">
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
                      Ajustez manuellement en glissant des enseignants ou en supprimant des cellules, puis cliquez sur <strong>Enregistrer</strong>.
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
