import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle, Play, RotateCcw, BarChart2, Users, Shield, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODES = [
  { id: "balanced", label: "Équilibre global", icon: BarChart2, color: "text-indigo-600 bg-indigo-50 border-indigo-200", activeRing: "ring-indigo-400", desc: "Niveau, genre et comportement équilibrés" },
  { id: "academic", label: "Niveau académique", icon: Sparkles, color: "text-blue-600 bg-blue-50 border-blue-200", activeRing: "ring-blue-400", desc: "Mélange bon/moyen/fragile dans chaque classe" },
  { id: "behavior", label: "Comportement", icon: Shield, color: "text-red-600 bg-red-50 border-red-200", activeRing: "ring-red-400", desc: "Éviter la concentration d'élèves difficiles" },
  { id: "needs", label: "Besoins spécifiques", icon: Heart, color: "text-purple-600 bg-purple-50 border-purple-200", activeRing: "ring-purple-400", desc: "Répartir élèves à besoins particuliers" },
];

export default function StudentAIAssistant({ students, classes, studentAssignments, onApply }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(false);

  const buildPrompt = (selectedMode) => {
    const studentList = students.map(s => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      gender: s.gender,
      average: s.average_grade ?? null,
      behavior: s.behavior_score ?? null,
      specific_needs: s.specific_needs || [],
    }));
    const classList = classes.map(c => ({ id: c.id, name: c.name, level: c.level }));
    const modeObj = MODES.find(m => m.id === selectedMode);

    return `Tu es un expert en gestion pédagogique. Répartis ces élèves dans les classes de façon optimale.

**Mode : ${modeObj?.label} — ${modeObj?.desc}**

**Élèves (${students.length}) :**
${JSON.stringify(studentList, null, 2)}

**Classes disponibles (${classes.length}) :**
${JSON.stringify(classList, null, 2)}

**Règles selon le mode "${modeObj?.label}" :**
${selectedMode === "balanced" ? "- Équilibre nombre d'élèves par classe\n- Mélange les genres\n- Mélange les niveaux académiques\n- Évite de concentrer les élèves à besoins spécifiques" : ""}
${selectedMode === "academic" ? "- Chaque classe doit avoir un mix de bons/moyens/fragiles\n- Ne pas regrouper uniquement les bons ou uniquement les fragiles" : ""}
${selectedMode === "behavior" ? "- Ne pas concentrer les élèves avec faible score de comportement dans une seule classe\n- Mélanger les profils de comportement" : ""}
${selectedMode === "needs" ? "- Répartir les élèves avec specific_needs de façon équitable entre les classes\n- Éviter qu'une classe ait trop d'élèves à besoins spécifiques" : ""}
- Chaque élève doit être affecté à exactement une classe.
- Équilibre les effectifs entre les classes.

Retourne un JSON :
{
  "analysis": "Explication courte (2-3 phrases)",
  "stats": "Résumé (ex: 30 élèves répartis en 3 classes de 10)",
  "assignments": [
    { "student_id": "...", "class_id": "..." }
  ]
}`;
  };

  const generate = async () => {
    if (!mode) return;
    setLoading(true);
    setResult(null);
    setApplied(false);

    const data = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(mode),
      response_json_schema: {
        type: "object",
        properties: {
          analysis: { type: "string" },
          stats: { type: "string" },
          assignments: { type: "array", items: { type: "object", properties: { student_id: { type: "string" }, class_id: { type: "string" } } } },
        },
      },
    });

    setResult(data);
    setLoading(false);
  };

  const apply = () => {
    if (!result?.assignments) return;
    const newMap = {};
    result.assignments.forEach(({ student_id, class_id }) => {
      if (!newMap[class_id]) newMap[class_id] = [];
      if (!newMap[class_id].includes(student_id)) newMap[class_id].push(student_id);
    });
    onApply(newMap);
    setApplied(true);
  };

  const getStudentName = (id) => {
    const s = students.find(s => s.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  };
  const getClassName = (id) => classes.find(c => c.id === id)?.name || id;

  return (
    <div className="bg-white border border-purple-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-95 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">IA — Répartition des Élèves</p>
            <p className="text-xs text-purple-200">Génération automatique + ajustement manuel possible</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODES.map(m => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setResult(null); setApplied(false); }}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isActive ? `${m.color} ring-2 ${m.activeRing}` : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? "" : "text-slate-400"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${isActive ? "" : "text-slate-700"}`}>{m.label}</p>
                    <p className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-400"}`}>{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button onClick={generate} disabled={!mode || loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</> : <><Sparkles className="w-4 h-4" /> Générer la répartition IA</>}
          </Button>

          {result && (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
                {result.stats && <p className="text-xs text-purple-600 font-medium mt-2">📊 {result.stats}</p>}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">{result.assignments?.length} affectations proposées</p>
                  {applied && <span className="text-xs text-green-700 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Appliquées</span>}
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {result.assignments?.map((a, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                      <span className="text-xs text-slate-700">{getStudentName(a.student_id)}</span>
                      <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{getClassName(a.class_id)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!applied ? (
                <div className="flex gap-2">
                  <Button onClick={apply} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                    <Play className="w-4 h-4" /> Appliquer dans la grille
                  </Button>
                  <Button onClick={() => { setResult(null); setApplied(false); }} variant="outline" className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Réessayer
                  </Button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Répartition appliquée dans la grille</p>
                    <p className="text-xs text-green-600 mt-0.5">Ajustez manuellement en glissant des élèves, puis enregistrez.</p>
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