import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  AlertTriangle,
  Users,
  Loader2,
  Save,
  Settings,
  History,
} from "lucide-react";
import { toast } from "sonner";

const DECISIONS = [
  { value: "promoted",    label: "Promu(e)",        color: "bg-green-100 text-green-700" },
  { value: "repeating",   label: "Redoublant(e)",   color: "bg-red-100 text-red-700" },
  { value: "graduated",   label: "Diplômé(e)",      color: "bg-purple-100 text-purple-700" },
  { value: "transferred", label: "Transféré(e)",    color: "bg-orange-100 text-orange-700" },
  { value: "conditional", label: "Passage conditionnel", color: "bg-yellow-100 text-yellow-700" },
  { value: "pending",     label: "En attente",      color: "bg-slate-100 text-slate-600" },
];

// Comprehensive next-level mapping for all supported education systems
const NEXT_LEVEL = {
  // Système français — Primaire
  "CP": "CE1", "CE1": "CE2", "CE2": "CM1", "CM1": "CM2", "CM2": "6ème",
  // Système français — Collège → Lycée
  "6ème": "5ème", "5ème": "4ème", "4ème": "3ème", "3ème": "2nde",
  // Système français — Lycée
  "2nde": "1ère", "1ère": "Terminale", "Terminale": "graduated",
  // Tunisien — Primaire
  "1ère AP": "2ème AP", "2ème AP": "3ème AP", "3ème AP": "4ème AP",
  "4ème AP": "5ème AP", "5ème AP": "6ème AP", "6ème AP": "7ème de base",
  // Tunisien — Collège
  "7ème de base": "8ème de base", "8ème de base": "9ème de base", "9ème de base": "1ère Sec",
  // Tunisien — Lycée
  "1ère Sec": "2ème Sec", "2ème Sec": "3ème Sec", "3ème Sec": "4ème Sec", "4ème Sec": "graduated",
  // Canadien — Primaire
  "1re année": "2e année", "2e année": "3e année", "3e année": "4e année",
  "4e année": "5e année", "5e année": "6e année", "6e année": "Sec 1",
  // Canadien — Secondaire
  "Sec 1": "Sec 2", "Sec 2": "Sec 3", "Sec 3": "Sec 4", "Sec 4": "Sec 5", "Sec 5": "graduated",
  // IB — PYP
  "PYP 1": "PYP 2", "PYP 2": "PYP 3", "PYP 3": "PYP 4",
  "PYP 4": "PYP 5", "PYP 5": "PYP 6", "PYP 6": "MYP 1",
  // IB — MYP
  "MYP 1": "MYP 2", "MYP 2": "MYP 3", "MYP 3": "MYP 4", "MYP 4": "MYP 5", "MYP 5": "DP 1",
  // IB — DP
  "DP 1": "DP 2", "DP 2": "graduated",
};

export default function PromotionManager({ schoolYears }) {
  const [selectedYearId, setSelectedYearId] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [passingGrade, setPassingGrade] = useState(10);
  const [decisions, setDecisions] = useState({});
  const [computedResults, setComputedResults] = useState(null); // { results, passing_grade }
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Load school years with passing_grade (custom function endpoint)
  const { data: schoolYearsFull = [] } = useQuery({
    queryKey: ["schoolYearsFull"],
    queryFn: () => base44.functions.getSchoolYears({}),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  // Past promotions for history view
  const { data: allPromotions = [] } = useQuery({
    queryKey: ["promotions"],
    queryFn: () => base44.entities.Promotion.list(),
  });

  const selectedYear = schoolYearsFull.find(y => y.id === selectedYearId);
  const selectedCls = classes.find(c => c.id === selectedClass);
  const nextLevel = selectedCls ? NEXT_LEVEL[selectedCls.level] : null;

  // When school year changes, load its passing_grade
  useEffect(() => {
    if (selectedYear) {
      setPassingGrade(selectedYear.passing_grade ?? 10);
    }
  }, [selectedYear]);

  // Save passing_grade setting to the school year
  const handleSavePassingGrade = async () => {
    if (!selectedYearId) return;
    try {
      await base44.functions.updateSchoolYearConfig({ school_year_id: selectedYearId, passing_grade: passingGrade });
      queryClient.invalidateQueries({ queryKey: ["schoolYearsFull"] });
      toast.success(`Seuil de passage mis à jour : ${passingGrade}/20`);
    } catch {
      toast.error("Erreur lors de la sauvegarde du seuil");
    }
  };

  // Compute promotion proposals via backend
  const handleCompute = async () => {
    if (!selectedClass) {
      toast.error("Sélectionnez une classe");
      return;
    }
    setComputing(true);
    try {
      const result = await base44.functions.computePromotions({
        class_id: selectedClass,
        passing_grade: Number(passingGrade),
      });
      setComputedResults(result);
      // Pre-fill decisions with proposals
      const init = {};
      result.results.forEach(r => { init[r.student_id] = r.proposed_decision; });
      setDecisions(init);
      toast.success(`${result.results.length} élève(s) analysé(s) — seuil : ${result.passing_grade}/20`);
    } catch (err) {
      toast.error(err.message || "Erreur de calcul");
    } finally {
      setComputing(false);
    }
  };

  // Save promotion decisions + update student statuses
  const handleSave = async () => {
    if (!selectedYearId || !yearTo) {
      toast.error("Veuillez sélectionner les années scolaires source et destination");
      return;
    }
    if (!computedResults?.results?.length) {
      toast.error("Calculez d'abord les promotions");
      return;
    }
    setSaving(true);
    try {
      const yearFrom = selectedYear?.year || "";

      // Build Promotion records
      const records = computedResults.results.map(r => ({
        student_id: r.student_id,
        from_class: selectedCls?.name || "",
        to_class: decisions[r.student_id] === "promoted" && nextLevel && nextLevel !== "graduated"
          ? nextLevel
          : (decisions[r.student_id] === "graduated" ? "Diplômé" : ""),
        school_year: yearFrom,
        status: decisions[r.student_id] || "pending",
        average_grade: r.average,
      }));

      await base44.entities.Promotion.bulkCreate(records);

      // Update student statuses for graduated / transferred
      await Promise.all(
        computedResults.results.map(r => {
          const dec = decisions[r.student_id];
          if (dec === "graduated") {
            return base44.entities.Student.update(r.student_id, { status: "graduated", class_id: null });
          }
          if (dec === "transferred") {
            return base44.entities.Student.update(r.student_id, { status: "transferred" });
          }
          if (dec === "repeating") {
            // Stay in same class, no class_id change
            return Promise.resolve();
          }
          return Promise.resolve();
        })
      );

      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${records.length} décision(s) enregistrée(s) !`);
      setComputedResults(null);
      setDecisions({});
      setSelectedClass("");
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Get promotion history for a student
  const getStudentHistory = (studentId) =>
    allPromotions.filter(p => p.student_id === studentId).sort((a, b) =>
      new Date(b.created_date) - new Date(a.created_date)
    );

  const repeatCount = (studentId) =>
    allPromotions.filter(p => p.student_id === studentId && p.status === "repeating").length;

  const decisionCounts = Object.values(decisions).reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Settings: year & passing grade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Paramètres du passage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">Année en cours</Label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Année source..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYearsFull.map(y => (
                    <SelectItem key={y.id} value={y.id}>{y.year || y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-center pb-1">
              <ArrowRight className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">Nouvelle année</Label>
              <Select value={yearTo} onValueChange={setYearTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Année destination..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map(y => (
                    <SelectItem key={y.id} value={y.name || y.year}>{y.name || y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Configurable passing grade */}
          <div className="flex items-end gap-3 pt-2 border-t">
            <div className="flex-1">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Moyenne minimale de passage (sur 20)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={passingGrade}
                  onChange={e => setPassingGrade(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-slate-500 text-sm">/ 20</span>
                <Badge className={passingGrade >= 10 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                  Seuil : {passingGrade}/20
                </Badge>
              </div>
            </div>
            {selectedYearId && (
              <Button variant="outline" size="sm" onClick={handleSavePassingGrade}
                className="border-indigo-300 text-indigo-700">
                <Save className="w-3.5 h-3.5 mr-1" />
                Enregistrer le seuil
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Class selector + compute button */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium text-slate-700 block">Classe à traiter</Label>
          <div className="flex gap-3">
            <Select
              value={selectedClass}
              onValueChange={v => { setSelectedClass(v); setDecisions({}); setComputedResults(null); }}
              className="flex-1"
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choisir une classe..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleCompute}
              disabled={!selectedClass || computing}
              className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
            >
              {computing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Calculer les moyennes
            </Button>
          </div>
          {selectedClass && nextLevel && nextLevel !== "graduated" && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Les élèves promus passeront en <strong className="ml-1">{nextLevel}</strong>
            </p>
          )}
          {selectedClass && nextLevel === "graduated" && (
            <p className="text-xs text-purple-600 flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Dernière année — les élèves promus obtiennent leur diplôme
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results table */}
      {computedResults && computedResults.results.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {DECISIONS.filter(d => d.value !== "conditional").map(dec => (
              <Card key={dec.value} className="text-center">
                <CardContent className="p-3">
                  <p className="text-xl font-bold">{decisionCounts[dec.value] || 0}</p>
                  <p className={`text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full ${dec.color}`}>{dec.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Per-student list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Élèves ({computedResults.results.length})
                <span className="text-sm font-normal text-slate-500 ml-auto">
                  Seuil appliqué : {computedResults.passing_grade}/20
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[...computedResults.results]
                  .sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
                  .map((r, idx) => {
                  const rank = idx + 1;
                  const decision = decisions[r.student_id] || "pending";
                  const decConfig = DECISIONS.find(d => d.value === decision);
                  const history = getStudentHistory(r.student_id);
                  const repeats = repeatCount(r.student_id);
                  const isRepeatedRedoublant = repeats >= 1; // already has 1+ repeating in history

                  return (
                    <div key={r.student_id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            rank === 1 ? "bg-yellow-400 text-white" :
                            rank === 2 ? "bg-slate-300 text-slate-700" :
                            rank === 3 ? "bg-amber-600 text-white" :
                            "bg-slate-100 text-slate-500"
                          }`}>{rank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">
                              {r.first_name} {r.last_name}
                            </p>
                            {r.student_code && (
                              <span className="text-xs text-slate-400">{r.student_code}</span>
                            )}
                            {isRepeatedRedoublant && (
                              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium border border-red-200">
                                <AlertTriangle className="w-3 h-3" />
                                Redoublement #{repeats + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {r.average !== null ? (
                              <span className={`text-sm font-bold ${r.average >= passingGrade ? "text-green-600" : "text-red-600"}`}>
                                {r.average}/20
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Aucune note</span>
                            )}
                            {/* Past history badges */}
                            {history.slice(0, 3).map((h, i) => {
                              const hConfig = DECISIONS.find(d => d.value === h.status);
                              return (
                                <span key={i} className={`text-xs px-1.5 py-0.5 rounded-full ${hConfig?.color || "bg-slate-100 text-slate-500"}`}>
                                  {h.school_year}: {hConfig?.label || h.status}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        </div>
                        <Select
                          value={decision}
                          onValueChange={v => setDecisions(prev => ({ ...prev, [r.student_id]: v }))}
                        >
                          <SelectTrigger className={`w-40 text-xs font-medium shrink-0 ml-3 ${decConfig?.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DECISIONS.map(d => (
                              <SelectItem key={d.value} value={d.value}>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.color}`}>
                                  {d.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Valider et enregistrer les décisions
          </Button>
        </>
      )}

      {computedResults && computedResults.results.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Pas de données pour la classe <span className="text-slate-700">{selectedCls?.name}</span></p>
            <p className="text-sm mt-1">Aucun élève actif ou aucune note enregistrée pour cette classe.</p>
          </CardContent>
        </Card>
      )}

      {/* Promotion history section */}
      {allPromotions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4 text-slate-600" />
              Historique des passages enregistrés ({allPromotions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-64 overflow-y-auto">
              {[...allPromotions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(p => {
                const decConfig = DECISIONS.find(d => d.value === p.status);
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{p.from_class}</span>
                      {p.to_class && <> <ArrowRight className="w-3 h-3 inline mx-1" /> <span>{p.to_class}</span></>}
                      <span className="text-slate-400 text-xs ml-2">{p.school_year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.average_grade !== null && p.average_grade !== undefined && (
                        <span className="text-xs text-slate-500">{Number(p.average_grade).toFixed(2)}/20</span>
                      )}
                      <Badge className={`text-xs ${decConfig?.color || "bg-slate-100 text-slate-600"}`}>
                        {decConfig?.label || p.status}
                      </Badge>
                    </div>
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
