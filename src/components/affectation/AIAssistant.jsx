import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle, Zap, Users, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIMIZATION_MODES = [
  {
    id: "optimal",
    label: "Répartition optimale",
    icon: Sparkles,
    description: "Distribution équilibrée de la charge de travail",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    id: "conflicts",
    label: "Minimiser les conflits",
    icon: Shield,
    description: "Éviter les doubles affectations et incompatibilités",
    color: "text-red-600 bg-red-50 border-red-200",
  },
  {
    id: "seniority",
    label: "Selon ancienneté",
    icon: Users,
    description: "Prioriser les enseignants expérimentés",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "results",
    label: "Selon résultats élèves",
    icon: TrendingUp,
    description: "Optimiser selon les performances historiques",
    color: "text-green-600 bg-green-50 border-green-200",
  },
];

export default function AIAssistant({ teachers, subjects, classes, assignments, onApplySuggestion }) {
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [applied, setApplied] = useState(false);

  const buildContext = () => {
    const teacherList = teachers.map(t =>
      `- ${t.first_name} ${t.last_name} (ancienneté: ${t.hire_date ? new Date().getFullYear() - new Date(t.hire_date).getFullYear() : "?"} ans, matières: ${(t.subject_ids || []).length > 0 ? "spécialisé" : "généraliste"})`
    ).join("\n");

    const classList = classes.map(c => `- ${c.name} (niveau: ${c.level})`).join("\n");
    const subjectList = subjects.map(s => `- ${s.name} (${s.code})`).join("\n");

    const currentAssignments = Object.entries(assignments)
      .filter(([, ids]) => ids.length > 0)
      .map(([key, ids]) => {
        const [subId, clsId] = key.split("|");
        const sub = subjects.find(s => s.id === subId);
        const cls = classes.find(c => c.id === clsId);
        return `${sub?.name || subId} → ${cls?.name || clsId}: ${ids.length} enseignant(s)`;
      }).join("\n");

    return { teacherList, classList, subjectList, currentAssignments };
  };

  const generateSuggestion = async () => {
    if (!selectedMode) return;
    setLoading(true);
    setSuggestion(null);
    setApplied(false);

    const { teacherList, classList, subjectList, currentAssignments } = buildContext();

    const modeLabel = OPTIMIZATION_MODES.find(m => m.id === selectedMode)?.label;

    const prompt = `Tu es un assistant spécialisé en gestion scolaire. Analyse la situation suivante et propose une stratégie d'affectation des enseignants.

**Objectif d'optimisation : ${modeLabel}**

**Enseignants disponibles (${teachers.length}) :**
${teacherList}

**Classes à couvrir (${classes.length}) :**
${classList}

**Matières à enseigner (${subjects.length}) :**
${subjectList}

**Affectations actuelles :**
${currentAssignments || "Aucune affectation pour l'instant"}

**Instructions selon le mode "${modeLabel}" :**
${selectedMode === "optimal" ? "- Propose une répartition qui équilibre la charge entre tous les enseignants\n- Chaque enseignant ne doit pas avoir plus de 20h/semaine\n- Assure-toi que toutes les matières sont couvertes" : ""}
${selectedMode === "conflicts" ? "- Identifie les conflits potentiels (double affectation, incompatibilité matière/enseignant)\n- Propose une répartition sans conflit\n- Signale les risques actuels" : ""}
${selectedMode === "seniority" ? "- Les enseignants avec plus d'ancienneté devraient avoir les classes de terminale/3ème\n- Répartir les classes difficiles aux enseignants expérimentés\n- Les nouveaux enseignants commencent par des niveaux inférieurs" : ""}
${selectedMode === "results" ? "- Propose d'affecter les meilleurs enseignants aux classes en difficulté\n- Considère que les enseignants généralistes sont plus flexibles\n- Maximise les chances de réussite des élèves" : ""}

Réponds avec :
1. Une analyse rapide de la situation (2-3 phrases)
2. Les recommandations clés (liste de 4-5 points concrets)
3. Les risques à surveiller (1-2 points)
4. Un score d'optimisation estimé en % (ex: "Score d'optimisation : 78%")

Sois concis et pratique.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setSuggestion(result);
    setLoading(false);
  };

  const handleApply = () => {
    setApplied(true);
    if (onApplySuggestion) onApplySuggestion(suggestion);
  };

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
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
            <p className="text-xs text-indigo-200">Suggestions automatiques d'optimisation</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* Mode selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Choisissez un mode d'optimisation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPTIMIZATION_MODES.map(mode => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => { setSelectedMode(mode.id); setSuggestion(null); setApplied(false); }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      selectedMode === mode.id
                        ? mode.color + " ring-2 ring-offset-1"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectedMode === mode.id ? "" : "text-slate-400"}`} />
                    <div>
                      <p className={`text-xs font-semibold ${selectedMode === mode.id ? "" : "text-slate-700"}`}>{mode.label}</p>
                      <p className={`text-[10px] ${selectedMode === mode.id ? "opacity-80" : "text-slate-400"}`}>{mode.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={generateSuggestion}
            disabled={!selectedMode || loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Générer les suggestions IA</>
            )}
          </Button>

          {/* Suggestion result */}
          {suggestion && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-semibold text-indigo-800">Recommandations de l'IA</p>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {suggestion}
              </div>
              {!applied ? (
                <Button
                  onClick={handleApply}
                  size="sm"
                  variant="outline"
                  className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-100 gap-2"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Marquer comme pris en compte
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
                  <CheckCircle className="w-4 h-4" /> Suggestions prises en compte
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}