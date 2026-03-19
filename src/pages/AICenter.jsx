/**
 * AICenter.jsx — Hub d'Intelligence Artificielle
 *
 * 4 modules IA accessibles depuis une interface unifiée :
 *
 *  1. 🎓 Affectation Enseignants  — Optimisation algorithme (4 modes)
 *  2. 👨‍🎓 Affectation Élèves      — Répartition intelligente (4 modes)
 *  3. 📅 Emploi du Temps         — Génération sans conflit (contrainte-based)
 *  4. 🧠 Psychopédagogie          — Profils + risques + recommandations
 */

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot, Sparkles, Loader2, CheckCircle, Play, RotateCcw, AlertTriangle,
  Brain, Calendar, GraduationCap, Users, Zap, Shield, TrendingUp,
  BarChart2, Heart, Star, Target, BookOpen, Activity, ChevronDown, ChevronRight,
  Download, RefreshCw, Info,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = '/api/ai';

async function callAI(endpoint, body) {
  const session = JSON.parse(localStorage.getItem('edugest_session') || '{}');
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers['X-Session-Token'] = session.token;
  if (session.id)    headers['X-User-Id']        = session.id;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const PALETTE = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const RISK_COLOR = {
  critique: { bg: "bg-red-100",    text: "text-red-700",    badge: "bg-red-600 text-white",    bar: "#ef4444" },
  élevé:    { bg: "bg-orange-100", text: "text-orange-700", badge: "bg-orange-500 text-white", bar: "#f97316" },
  modéré:   { bg: "bg-amber-100",  text: "text-amber-700",  badge: "bg-amber-400 text-white",  bar: "#f59e0b" },
  faible:   { bg: "bg-green-100",  text: "text-green-700",  badge: "bg-green-500 text-white",  bar: "#10b981" },
};

const DAY_NAMES = { 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" };

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — AFFECTATION ENSEIGNANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TEACHER_MODES = [
  { id: "optimal",   label: "Répartition optimale",    icon: Sparkles, color: "text-indigo-600 bg-indigo-50 border-indigo-200", ring: "ring-indigo-400", desc: "Distribution équilibrée de la charge de travail" },
  { id: "conflicts", label: "Minimiser les conflits",  icon: Shield,   color: "text-red-600 bg-red-50 border-red-200",          ring: "ring-red-400",    desc: "Spécialisations et limites de charge respectées" },
  { id: "seniority", label: "Par ancienneté",          icon: Star,     color: "text-amber-600 bg-amber-50 border-amber-200",    ring: "ring-amber-400",  desc: "Enseignants expérimentés aux niveaux supérieurs" },
  { id: "results",   label: "Par résultats élèves",    icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200", ring: "ring-green-400",  desc: "Meilleurs enseignants aux classes prioritaires" },
];

function TeacherAssignmentAI() {
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: classes  = [] } = useQuery({ queryKey: ["classes"],  queryFn: () => base44.entities.Class.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: grades   = [] } = useQuery({ queryKey: ["grades"],   queryFn: () => base44.entities.Grade.list() });

  const [mode, setMode]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const activeTeachers = teachers.filter(t => t.status === "active");

  const generate = async () => {
    if (!mode) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await callAI('/affectation-enseignants', { mode, teachers: activeTeachers, classes, subjects, grades });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getTeacher = (id) => { const t = teachers.find(t => t.id === id); return t ? `${t.first_name} ${t.last_name}` : id; };
  const getSubject = (id) => subjects.find(s => s.id === id)?.name || id;
  const getClass   = (id) => classes.find(c => c.id === id)?.name || id;

  // Workload summary
  const workload = useMemo(() => {
    if (!result?.assignments) return [];
    const map = {};
    result.assignments.forEach(a => { map[a.teacher_id] = (map[a.teacher_id] || 0) + 1; });
    return Object.entries(map).map(([id, count]) => ({ name: getTeacher(id), count })).sort((a, b) => b.count - a.count);
  }, [result, teachers]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<GraduationCap className="w-4 h-4" />} label="Enseignants actifs" value={activeTeachers.length} color="indigo" />
        <Stat icon={<BookOpen className="w-4 h-4" />}      label="Matières"           value={subjects.length}        color="blue" />
        <Stat icon={<Users className="w-4 h-4" />}         label="Classes"            value={classes.length}         color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TEACHER_MODES.map(m => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => { setMode(m.id); setResult(null); }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${active ? `${m.color} ring-2 ${m.ring}` : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${active ? "" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${active ? "" : "text-slate-700"}`}>{m.label}</p>
                <p className={`text-xs mt-0.5 ${active ? "opacity-75" : "text-slate-400"}`}>{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Button onClick={generate} disabled={!mode || loading}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 gap-2 text-sm font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Optimisation en cours...</> : <><Sparkles className="w-4 h-4" /> Générer les affectations IA</>}
      </Button>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <p className="text-sm font-semibold text-indigo-800">Analyse IA</p>
            </div>
            <p className="text-sm text-slate-700">{result.analysis}</p>
            {result.stats && <p className="text-xs text-indigo-600 font-medium mt-2">📊 {result.stats}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Liste des affectations */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{result.assignments?.length} affectations proposées</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-auto divide-y divide-slate-100">
                  {result.assignments?.map((a, i) => (
                    <div key={i} className="px-4 py-2.5 hover:bg-slate-50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{getSubject(a.subject_id)}</span>
                        <span className="text-xs text-slate-400">→</span>
                        <span className="text-xs font-medium text-slate-700">{getClass(a.class_id)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">👤 {getTeacher(a.teacher_id)} {a.reason && <span className="text-slate-400">— {a.reason}</span>}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Charge par enseignant */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Charge par enseignant</CardTitle></CardHeader>
              <CardContent>
                {workload.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={workload.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => [v, "Classes"]} />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-700">Ces affectations sont des propositions. Rendez-vous dans le module <strong>Affectation Enseignants</strong> pour les appliquer, les ajuster manuellement et les enregistrer.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — AFFECTATION ÉLÈVES
// ═══════════════════════════════════════════════════════════════════════════════

const STUDENT_MODES = [
  { id: "balanced", label: "Équilibre global",      icon: BarChart2, color: "text-indigo-600 bg-indigo-50 border-indigo-200", ring: "ring-indigo-400", desc: "Genre, niveau et comportement uniformes" },
  { id: "academic", label: "Niveau académique",     icon: Sparkles,  color: "text-blue-600 bg-blue-50 border-blue-200",       ring: "ring-blue-400",   desc: "Mix bons/moyens/fragiles dans chaque classe" },
  { id: "behavior", label: "Comportement",          icon: Shield,    color: "text-red-600 bg-red-50 border-red-200",           ring: "ring-red-400",    desc: "Profils difficiles répartis équitablement" },
  { id: "needs",    label: "Besoins spécifiques",   icon: Heart,     color: "text-purple-600 bg-purple-50 border-purple-200", ring: "ring-purple-400", desc: "Élèves à besoins particuliers distribués en priorité" },
];

function StudentAssignmentAI() {
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: classes  = [] } = useQuery({ queryKey: ["classes"],  queryFn: () => base44.entities.Class.list() });

  const [mode, setMode]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const unassigned = students.filter(s => !s.class_id && s.status === "active");

  const generate = async () => {
    if (!mode) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await callAI('/affectation-eleves', { mode, students: unassigned.length > 0 ? unassigned : students, classes });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getClass   = (id) => classes.find(c => c.id === id)?.name || id;
  const getStudent = (id) => { const s = students.find(s => s.id === id); return s ? `${s.first_name} ${s.last_name}` : id; };

  // Effectif par classe après répartition
  const preview = useMemo(() => {
    if (!result?.assignments) return [];
    return classes.map(c => ({ name: c.name, count: result.assignments.filter(a => a.class_id === c.id).length }));
  }, [result, classes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<Users className="w-4 h-4" />}  label="Élèves actifs"     value={students.filter(s => s.status === "active").length} color="indigo" />
        <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Non affectés" value={unassigned.length} color={unassigned.length > 0 ? "orange" : "green"} />
        <Stat icon={<Users className="w-4 h-4" />}  label="Classes cibles"    value={classes.length}      color="blue" />
      </div>

      {unassigned.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          Tous les élèves sont déjà affectés. L'IA utilisera l'ensemble des élèves actifs pour une re-répartition.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {STUDENT_MODES.map(m => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => { setMode(m.id); setResult(null); }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${active ? `${m.color} ring-2 ${m.ring}` : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${active ? "" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${active ? "" : "text-slate-700"}`}>{m.label}</p>
                <p className={`text-xs mt-0.5 ${active ? "opacity-75" : "text-slate-400"}`}>{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Button onClick={generate} disabled={!mode || loading}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-11 gap-2 text-sm font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Répartition en cours...</> : <><Sparkles className="w-4 h-4" /> Générer la répartition IA</>}
      </Button>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-sm text-slate-700">{result.analysis}</p>
            {result.stats && <p className="text-xs text-purple-600 font-medium mt-2">📊 {result.stats}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Effectif par classe (aperçu)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={preview}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={v => [v, "Élèves"]} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{result.assignments?.length} affectations proposées</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-52 overflow-auto divide-y divide-slate-100">
                  {result.assignments?.slice(0, 30).map((a, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                      <span className="text-xs text-slate-700 truncate">{getStudent(a.student_id)}</span>
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded ml-2 flex-shrink-0">{getClass(a.class_id)}</span>
                    </div>
                  ))}
                  {result.assignments?.length > 30 && <p className="text-xs text-slate-400 text-center py-2">…et {result.assignments.length - 30} autres</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-700">Rendez-vous dans <strong>Affectation Élèves</strong> pour appliquer ces propositions, les affiner manuellement et enregistrer.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — GÉNÉRATEUR D'EMPLOI DU TEMPS
// ═══════════════════════════════════════════════════════════════════════════════

function ScheduleGenerator() {
  const { data: schedules = [] } = useQuery({ queryKey: ["schedules-ai"], queryFn: () => base44.entities.Schedule.list() });
  const { data: classes   = [] } = useQuery({ queryKey: ["classes"],  queryFn: () => base44.entities.Class.list() });
  const { data: subjects  = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: teachers  = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });

  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [maxPerDay, setMaxPerDay] = useState(6);
  const [saturday, setSaturday]   = useState(false);
  const [viewClass, setViewClass] = useState(null);

  // Construire les sessions depuis les affectations existantes (Schedule)
  const sessions = useMemo(() => {
    // Grouper par (class_id, subject_id, teacher_id) et utiliser weekly_hours du subject
    const map = {};
    schedules.forEach(s => {
      const key = `${s.class_id}|${s.subject_id}|${s.teacher_id}`;
      if (!map[key]) {
        const sub     = subjects.find(su => su.id === s.subject_id);
        const cls     = classes.find(c => c.id === s.class_id);
        const teacher = teachers.find(t => t.id === s.teacher_id);
        map[key] = {
          class_id:     s.class_id,
          subject_id:   s.subject_id,
          teacher_id:   s.teacher_id,
          weekly_hours: sub?.weekly_hours || 1,
          subject_name: sub?.name || s.subject_id,
          class_name:   cls?.name || s.class_id,
          teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : s.teacher_id,
          room:         s.room || null,
        };
      }
    });
    return Object.values(map);
  }, [schedules, subjects, classes, teachers]);

  const generate = async () => {
    if (!sessions.length) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await callAI('/emploi-du-temps', {
        sessions,
        constraints: {
          maxHoursPerDay: maxPerDay,
          days: saturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
          preferMorning: true,
        },
      });
      setResult(data);
      if (classes[0]) setViewClass(classes[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Emploi du temps d'une classe (grille)
  const classSchedule = useMemo(() => {
    if (!result?.scheduled || !viewClass) return {};
    const grid = {}; // day → [slot]
    result.scheduled
      .filter(s => s.class_id === viewClass)
      .forEach(s => {
        if (!grid[s.day_of_week]) grid[s.day_of_week] = [];
        grid[s.day_of_week].push(s);
      });
    return grid;
  }, [result, viewClass]);

  const DAYS_LIST = saturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      {/* Config */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-500" />Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Max heures/jour par classe</label>
              <input type="number" min={1} max={8} value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="saturday" checked={saturday} onChange={e => setSaturday(e.target.checked)} className="w-4 h-4 accent-teal-500" />
              <label htmlFor="saturday" className="text-sm text-slate-700">Inclure le samedi</label>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{sessions.length} combinaisons détectées</p>
              <p className="text-xs text-slate-500">{new Set(sessions.map(s => s.class_id)).size} classes · {new Set(sessions.map(s => s.teacher_id)).size} enseignants</p>
            </div>
            <Badge variant="outline">{sessions.reduce((s, x) => s + (x.weekly_hours || 1), 0)} h/semaine</Badge>
          </div>

          {sessions.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Aucune affectation existante détectée. Créez d'abord des affectations dans le module Emploi du Temps.
            </div>
          )}

          <Button onClick={generate} disabled={!sessions.length || loading}
            className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 h-11 gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours...</> : <><Calendar className="w-4 h-4" /> Générer l'emploi du temps IA</>}
          </Button>
        </CardContent>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Résumé */}
          <Card className="border-teal-200 bg-teal-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-teal-800">{result.analysis}</p>
                  <p className="text-xs text-teal-600 mt-1">📊 {result.stats}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conflits éventuels */}
          {result.conflicts?.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{result.conflicts.length} conflit(s) non résolus</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {result.conflicts.map((c, i) => (
                    <div key={i} className="px-4 py-2">
                      <p className="text-xs font-medium text-red-700">{c.subject_name} → {c.class_name}</p>
                      <p className="text-xs text-slate-500">{c.teacher_name} · {c.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sélecteur de classe */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Aperçu par classe</CardTitle>
                <select value={viewClass || ""} onChange={e => setViewClass(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left w-20">Heure</th>
                      {DAYS_LIST.map(d => (
                        <th key={d} className="border border-slate-200 bg-slate-50 px-3 py-2 text-center">{DAY_NAMES[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"].map(hour => (
                      <tr key={hour}>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-500 font-medium bg-slate-50">{hour}</td>
                        {DAYS_LIST.map(d => {
                          const slot = classSchedule[d]?.find(s => s.start_time === hour);
                          return (
                            <td key={d} className="border border-slate-200 px-2 py-1.5 text-center" style={{ minWidth: 100 }}>
                              {slot ? (
                                <div className="bg-teal-50 border border-teal-200 rounded px-1.5 py-1">
                                  <p className="font-semibold text-teal-800 truncate">{slot.subject_name}</p>
                                  <p className="text-teal-500 truncate">{slot.teacher_name}</p>
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">Ces créneaux sont des propositions. Allez dans le module <strong>Emploi du Temps</strong> pour les valider, ajuster et enregistrer dans la base de données.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — ANALYSE PSYCHOPÉDAGOGIQUE
// ═══════════════════════════════════════════════════════════════════════════════

function PsychoPedaAI() {
  const { data: students   = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: grades     = [] } = useQuery({ queryKey: ["grades"],     queryFn: () => base44.entities.Grade.list() });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],      queryFn: () => base44.entities.Exam.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions  = [] } = useQuery({ queryKey: ["sanctions"],  queryFn: () => base44.entities.Sanction.list() });
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });

  const [loading, setLoading]     = useState(false);
  const [profiles, setProfiles]   = useState(null);
  const [error, setError]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [filterClass, setFilterClass] = useState("");
  const [filterRisk, setFilterRisk]   = useState("");

  const analyze = async () => {
    setLoading(true); setProfiles(null); setError(null); setSelected(null);
    try {
      const data = await callAI('/psychopedagogique', { students, grades, exams, attendance, sanctions, subjects });
      setProfiles(data.profiles);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter(p => {
      if (filterClass && p.student.class_id !== filterClass) return false;
      if (filterRisk  && p.risks.level !== filterRisk) return false;
      return true;
    });
  }, [profiles, filterClass, filterRisk]);

  const selectedProfile = selected ? profiles?.find(p => p.student.id === selected) : null;

  const riskCounts = useMemo(() => {
    if (!profiles) return {};
    return profiles.reduce((acc, p) => { acc[p.risks.level] = (acc[p.risks.level] || 0) + 1; return acc; }, {});
  }, [profiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="">Tous les niveaux</option>
            <option value="critique">Critique</option>
            <option value="élevé">Élevé</option>
            <option value="modéré">Modéré</option>
            <option value="faible">Faible</option>
          </select>
        </div>
        <Button onClick={analyze} disabled={loading}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</> : <><Brain className="w-4 h-4" /> Analyser {students.length} élèves</>}
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {profiles && (
        <>
          {/* Résumé des risques */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { level: "critique", label: "Critique", icon: "🔴" },
              { level: "élevé",    label: "Élevé",    icon: "🟠" },
              { level: "modéré",   label: "Modéré",   icon: "🟡" },
              { level: "faible",   label: "Faible",   icon: "🟢" },
            ].map(({ level, label, icon }) => {
              const c = RISK_COLOR[level] || RISK_COLOR.faible;
              return (
                <button key={level} onClick={() => setFilterRisk(filterRisk === level ? "" : level)}
                  className={`rounded-xl p-3 text-center border transition-all ${filterRisk === level ? `${c.bg} border-current ring-2` : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                  <p className="text-xl">{icon}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{riskCounts[level] || 0}</p>
                  <p className={`text-xs font-medium mt-0.5 ${c.text}`}>{label}</p>
                </button>
              );
            })}
          </div>

          {/* Liste des élèves */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">{filtered.length} élèves</div>
                <div className="max-h-[500px] overflow-auto divide-y divide-slate-100">
                  {filtered.map(p => {
                    const c = RISK_COLOR[p.risks.level] || RISK_COLOR.faible;
                    const isSelected = selected === p.student.id;
                    return (
                      <button key={p.student.id} onClick={() => setSelected(isSelected ? null : p.student.id)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-violet-50" : ""}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.student.name}</p>
                          <Badge className={`text-xs flex-shrink-0 ml-2 ${c.badge}`}>{p.risks.level}</Badge>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                          <span>Moy: {p.academic.globalAvg != null ? `${p.academic.globalAvg}/20` : "—"}</span>
                          <span>Présence: {p.attendance.presRate != null ? `${p.attendance.presRate}%` : "—"}</span>
                        </div>
                        <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full" style={{ width: `${p.risks.riskScore}%`, background: c.bar }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Profil détaillé */}
            <div className="lg:col-span-2">
              {selectedProfile ? (
                <StudentProfile profile={selectedProfile} />
              ) : (
                <div className="flex items-center justify-center h-full min-h-64 border border-dashed border-slate-300 rounded-xl text-slate-400">
                  <div className="text-center">
                    <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sélectionnez un élève pour voir son profil</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StudentProfile({ profile }) {
  const c = RISK_COLOR[profile.risks.level] || RISK_COLOR.faible;
  const [tab, setTab] = useState("profil");

  const radarData = Object.entries(profile.profile.dimensions).map(([k, v]) => ({
    dim: { autonomie: "Autonomie", creativite: "Créativité", rigueur: "Rigueur", assiduite: "Assiduité", stabilite: "Stabilité", motivation: "Motivation" }[k] || k,
    value: v,
  }));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* En-tête */}
      <div className={`px-5 py-4 ${c.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{profile.student.name}</h3>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge className={c.badge}>Risque : {profile.risks.level}</Badge>
              <Badge variant="outline" className="bg-white">Style : {profile.profile.learningStyle}</Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{profile.academic.globalAvg != null ? `${profile.academic.globalAvg}/20` : "—"}</p>
            <p className="text-xs text-slate-500">Moyenne générale</p>
          </div>
        </div>

        {/* KPIs rapides */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: "Réussite",     val: `${profile.risks.successScore}%`,        bg: "bg-white/60" },
            { label: "Présence",     val: profile.attendance.presRate != null ? `${profile.attendance.presRate}%` : "—", bg: "bg-white/60" },
            { label: "Stress",       val: `${profile.profile.stressScore}/100`,     bg: "bg-white/60" },
            { label: "Motivation",   val: `${profile.profile.dimensions.motivation}/100`, bg: "bg-white/60" },
          ].map(({ label, val, bg }) => (
            <div key={label} className={`rounded-lg p-2 text-center ${bg}`}>
              <p className="text-sm font-bold text-slate-900">{val}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        {[
          { id: "profil",   label: "Profil" },
          { id: "notes",    label: "Notes" },
          { id: "recommandations", label: "Recommandations" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-violet-500 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "profil" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dimensions psychopédagogiques</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} />
                  <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
                  <Tooltip formatter={v => [`${v}/100`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Indicateurs de risque</p>
              {[
                { label: "Risque d'échec",     value: profile.risks.failRisk,    color: "#ef4444" },
                { label: "Risque de décrochage", value: profile.risks.dropoutRisk, color: "#f97316" },
                { label: "Stress",              value: profile.profile.stressScore, color: "#f59e0b" },
                { label: "Démotivation",        value: profile.profile.demotivationScore, color: "#8b5cf6" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold">{value}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4">
            {profile.academic.bySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={profile.academic.bySubject.map(s => ({ name: s.name.slice(0, 12), avg: s.avg }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 20]} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v}/20`]} />
                  <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {profile.academic.bySubject.map((s, i) => <Cell key={i} fill={s.avg >= 10 ? "#6366f1" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">Aucune note disponible</p>}
          </div>
        )}

        {tab === "recommandations" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Pour l'enseignant</p>
              <ul className="space-y-1.5">
                {profile.recommendations.teacher.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Heart className="w-3 h-3" /> Pour le parent</p>
              <ul className="space-y-1.5">
                {profile.recommendations.parent.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function Stat({ icon, label, value, color = "indigo" }) {
  const bg = { indigo: "bg-indigo-50", blue: "bg-blue-50", purple: "bg-purple-50", orange: "bg-orange-50", green: "bg-green-50" };
  const tx = { indigo: "text-indigo-600", blue: "text-blue-600", purple: "text-purple-600", orange: "text-orange-600", green: "text-green-600" };
  return (
    <div className={`rounded-xl p-4 ${bg[color] || "bg-slate-50"} text-center`}>
      <div className={`flex items-center justify-center mb-1 ${tx[color] || "text-slate-600"}`}>{icon}</div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AICenter() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-4xl flex-shrink-0">🤖</div>
          <div>
            <h1 className="text-2xl font-bold">Centre d'Intelligence Artificielle</h1>
            <p className="text-white/75 text-sm mt-1">Optimisation algorithmique · Analyse prédictive · Recommandations personnalisées</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {["Affectation Enseignants", "Répartition Élèves", "Emploi du Temps", "Psychopédagogie"].map(tag => (
                <span key={tag} className="text-xs bg-white/20 backdrop-blur px-2.5 py-1 rounded-full font-medium">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <Tabs defaultValue="enseignants">
        <TabsList className="grid grid-cols-4 w-full h-auto p-1">
          <TabsTrigger value="enseignants" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
            <GraduationCap className="w-4 h-4" /><span className="hidden sm:inline">Affectation</span> Enseignants
          </TabsTrigger>
          <TabsTrigger value="eleves" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
            <Users className="w-4 h-4" /><span className="hidden sm:inline">Affectation</span> Élèves
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
            <Calendar className="w-4 h-4" /><span className="hidden sm:inline">Emploi du</span> Temps
          </TabsTrigger>
          <TabsTrigger value="psycho" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
            <Brain className="w-4 h-4" />Psychopéda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enseignants" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Affectation Enseignants</p>
                  <p className="text-xs text-slate-500 font-normal">Optimisation algorithme · 4 stratégies disponibles</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent><TeacherAssignmentAI /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eleves" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Répartition des Élèves</p>
                  <p className="text-xs text-slate-500 font-normal">Distribution équitable · Niveau, genre, comportement, besoins</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent><StudentAssignmentAI /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Générateur d'Emploi du Temps</p>
                  <p className="text-xs text-slate-500 font-normal">Placement automatique sans conflit · Contraintes configurables</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent><ScheduleGenerator /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="psycho" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Analyse Psychopédagogique</p>
                  <p className="text-xs text-slate-500 font-normal">Profils VAK · Risques académiques · Recommandations personnalisées</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent><PsychoPedaAI /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
