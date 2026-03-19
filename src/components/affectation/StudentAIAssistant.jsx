import React, { useState } from "react";
import {
  Bot, Sparkles, Loader2, ChevronDown, ChevronUp,
  CheckCircle, Play, RotateCcw, BarChart2, Shield, Heart, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MODES = [
  { id: "balanced", label: "Équilibre global",    icon: BarChart2, color: "text-indigo-600 bg-indigo-50 border-indigo-200", activeRing: "ring-indigo-400", desc: "Niveau, genre et comportement équilibrés" },
  { id: "academic", label: "Niveau académique",   icon: Sparkles,  color: "text-blue-600 bg-blue-50 border-blue-200",       activeRing: "ring-blue-400",   desc: "Mélange bon/moyen/fragile dans chaque classe" },
  { id: "behavior", label: "Comportement",        icon: Shield,    color: "text-red-600 bg-red-50 border-red-200",           activeRing: "ring-red-400",    desc: "Éviter la concentration d'élèves difficiles" },
  { id: "needs",    label: "Besoins spécifiques", icon: Heart,     color: "text-purple-600 bg-purple-50 border-purple-200",  activeRing: "ring-purple-400", desc: "Répartir élèves à besoins particuliers" },
];

/** Explication détaillée + exemple concret pour chaque mode */
const LOGIC_EXPLANATIONS = {
  balanced: {
    title: "Comment fonctionne l'équilibre global ?",
    steps: [
      "Les élèves sont séparés en deux groupes : garçons et filles, chacun trié par moyenne décroissante.",
      "L'algorithme alterne : 1er garçon, 1ère fille, 2ème garçon, 2ème fille... pour créer une liste mixte équilibrée.",
      "Cette liste est distribuée en round-robin entre les classes (1→A, 2→B, 3→C, 4→A...) pour un équilibre parfait.",
    ],
    example: "Ex. : Ali (15, M), Sara (14, F), Karim (13, M), Lina (12, F) → Ali→A, Sara→B, Karim→A, Lina→B.",
  },
  academic: {
    title: "Comment fonctionne la répartition par niveau académique ?",
    steps: [
      "Tous les élèves sont triés par moyenne générale décroissante (du meilleur au plus fragile).",
      "Distribution cyclique : le 1er (fort) → classe A, le 2ème → classe B, le 3ème → classe C, le 4ème → classe A...",
      "Résultat : chaque classe reçoit un mix équitable de bons, moyens et élèves fragiles.",
    ],
    example: "Ex. avec 3 classes : Ahmed (18)→A, Sonia (17)→B, Mehdi (16)→C, Yasmine (15)→A, Omar (14)→B...",
  },
  behavior: {
    title: "Comment fonctionne la répartition par comportement ?",
    steps: [
      "Les élèves sont triés par nombre de sanctions actives croissant (0 sanction en premier).",
      "Distribution cyclique entre les classes : chaque classe reçoit les mêmes proportions de profils comportementaux.",
      "Les élèves avec beaucoup de sanctions sont séparés — aucun groupe ne concentre les profils difficiles.",
    ],
    example: "Ex. : Nada (0)→A, Rami (0)→B, Sofiane (1)→C, Ines (1)→A, Djamel (3)→B, Bilal (3)→C.",
  },
  needs: {
    title: "Comment fonctionne la répartition par besoins spécifiques ?",
    steps: [
      "Les élèves ayant des besoins spécifiques documentés sont identifiés et placés en tête de liste.",
      "Ils sont distribués en priorité entre les classes (1 par classe en premier tour, puis 2ème tour si nécessaire).",
      "Les élèves sans besoins particuliers complètent ensuite les classes en round-robin.",
    ],
    example: "Ex. : Sami (dyslexie)→A, Rania (TDA/H)→B, Walid (mobilité réduite)→C, puis les autres normalement.",
  },
};

export default function StudentAIAssistant({ students, classes, studentAssignments, onApply }) {
  const [open, setOpen]       = useState(false);
  const [mode, setMode]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [applied, setApplied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const generate = async () => {
    if (!mode) return;
    setLoading(true);
    setResult(null);
    setApplied(false);
    setShowAll(false);

    try {
      const session = JSON.parse(localStorage.getItem('edugest_session') || '{}');
      const headers = { 'Content-Type': 'application/json' };
      if (session.token) headers['X-Session-Token'] = session.token;
      if (session.id)    headers['X-User-Id']        = session.id;

      const res = await fetch('/api/ai/affectation-eleves', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode, students, classes }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ analysis: `Erreur : ${err.message}`, stats: '', assignments: [] });
    } finally {
      setLoading(false);
    }
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

  const reset = () => { setResult(null); setApplied(false); setShowAll(false); };

  const getStudentName = (id) => {
    const s = students.find(s => s.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  };
  const getStudentInfo = (id) => {
    const s = students.find(s => s.id === id);
    if (!s) return null;
    const parts = [];
    if (s.gender)        parts.push(s.gender === 'M' ? '♂' : s.gender === 'F' ? '♀' : s.gender);
    if (s.average_grade) parts.push(`moy. ${Number(s.average_grade).toFixed(1)}`);
    if (s.sanctions_count && s.sanctions_count > 0) parts.push(`${s.sanctions_count} sanction(s)`);
    return parts.length ? parts.join(' · ') : null;
  };
  const getClassName = (id) => classes.find(c => c.id === id)?.name || id;

  const logic    = mode ? LOGIC_EXPLANATIONS[mode] : null;
  const examples = result?.assignments?.slice(0, 4) || [];
  const rest     = result?.assignments?.slice(4) || [];

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

          {/* Mode selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODES.map(m => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button key={m.id}
                  onClick={() => { setMode(m.id); reset(); }}
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

          {/* Explication du mode (avant génération) */}
          {logic && !result && (
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
          <Button onClick={generate} disabled={!mode || loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</>
              : <><Sparkles className="w-4 h-4" /> Générer la répartition IA</>
            }
          </Button>

          {/* Result */}
          {result && (
            <div className="space-y-3">

              {/* Résumé */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
                {result.stats && <p className="text-xs text-purple-600 font-medium mt-2">📊 {result.stats}</p>}
              </div>

              {/* Logique rappelée après génération */}
              {logic && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">
                      Logique appliquée — {logic.title.replace("Comment fonctionne ", "").replace(" ?", "")}
                    </p>
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

              {/* 4 exemples concrets */}
              {examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    🎯 Exemples concrets générés
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {examples.map((a, i) => {
                      const info = getStudentInfo(a.student_id);
                      return (
                        <div key={i} className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] font-semibold text-slate-800">{getStudentName(a.student_id)}</p>
                          {info && <p className="text-[10px] text-slate-500 mt-0.5">{info}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-slate-400 text-[10px]">→</span>
                            <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                              {getClassName(a.class_id)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Liste complète */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">{result.assignments?.length} affectations proposées</p>
                  {applied && (
                    <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Appliquées
                    </span>
                  )}
                </div>
                <div className={`${showAll ? "max-h-96" : "max-h-40"} overflow-y-auto divide-y divide-slate-100`}>
                  {result.assignments?.map((a, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                      <span className="text-xs text-slate-700">{getStudentName(a.student_id)}</span>
                      <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {getClassName(a.class_id)}
                      </span>
                    </div>
                  ))}
                </div>
                {rest.length > 0 && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full text-center text-[11px] text-purple-600 font-medium py-2 hover:bg-slate-50 border-t border-slate-100"
                  >
                    {showAll ? "▲ Réduire la liste" : `▼ Voir les ${rest.length} autres élèves`}
                  </button>
                )}
              </div>

              {/* Action buttons */}
              {!applied ? (
                <div className="flex gap-2">
                  <Button onClick={apply} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                    <Play className="w-4 h-4" /> Appliquer dans la grille
                  </Button>
                  <Button onClick={reset} variant="outline" className="gap-2">
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
