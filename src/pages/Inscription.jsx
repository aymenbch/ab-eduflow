/**
 * Inscription & Onboarding — Workflow Admission en 5 étapes
 * A_L_ETUDE → EN_EVALUATION → PROFIL_FAMILLE → SERVICES → PAIEMENT → INSCRIT
 */
import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Users, Plus, Search, UserPlus, ClipboardList, Home as HomeIcon,
  Settings, CreditCard, FileText, Phone, Mail, Trash2,
  CheckCircle, Clock, XCircle, Star, ChevronLeft, ChevronRight,
  UtensilsCrossed, Bus, Activity, Check, AlertCircle, Eye,
  CalendarDays, User, Edit2, RefreshCw,
} from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────
function apiFetch(path, opts = {}) {
  const session = getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session
      ? { "x-session-token": session.token, "x-user-id": session.userId }
      : {}),
    ...opts.headers,
  };
  return fetch(`http://localhost:3001/api/inscription${path}`, {
    ...opts,
    headers,
  }).then((r) => r.json());
}

function apiFetchTarifs(path, opts = {}) {
  const session = getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session
      ? { "x-session-token": session.token, "x-user-id": session.userId }
      : {}),
    ...opts.headers,
  };
  return fetch(`http://localhost:3001/api/tarifs${path}`, { ...opts, headers })
    .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error || `Erreur ${r.status}`); return d; });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Pré-inscription",  icon: User },
  { id: 2, label: "Évaluation",       icon: ClipboardList },
  { id: 3, label: "Profil Famille",   icon: HomeIcon },
  { id: 4, label: "Services",         icon: Settings },
  { id: 5, label: "Paiement",         icon: CreditCard },
];

const STATUS_CONFIG = {
  A_L_ETUDE:      { label: "À l'étude",       color: "bg-sky-100 text-sky-800",        dot: "bg-sky-500" },
  EN_EVALUATION:  { label: "En évaluation",   color: "bg-purple-100 text-purple-800",  dot: "bg-purple-500" },
  PROFIL_FAMILLE: { label: "Profil famille",  color: "bg-yellow-100 text-yellow-800",  dot: "bg-yellow-500" },
  SERVICES:       { label: "Services",        color: "bg-orange-100 text-orange-800",  dot: "bg-orange-500" },
  PAIEMENT:       { label: "Paiement",        color: "bg-indigo-100 text-indigo-800",  dot: "bg-indigo-500" },
  INSCRIT:        { label: "Inscrit ✓",       color: "bg-green-100 text-green-800",    dot: "bg-green-500" },
  REFUSE:         { label: "Refusé",          color: "bg-red-100 text-red-800",        dot: "bg-red-500" },
};

const STATUS_STEP = {
  A_L_ETUDE: 1, EN_EVALUATION: 2, PROFIL_FAMILLE: 3,
  SERVICES: 4, PAIEMENT: 5, INSCRIT: 5, REFUSE: 2,
};

const NIVEAUX = [
  "Maternelle", "CP", "CE1", "CE2", "CM1", "CM2",
  "6ème", "5ème", "4ème", "3ème",
  "2nde", "1ère", "Terminale",
];

// ── Cycle / Niveau matching helpers ───────────────────────────────────────────
const CYCLE_MAP = {
  maternelle: ["Maternelle"],
  primaire:   ["CP", "CE1", "CE2", "CM1", "CM2"],
  college:    ["6ème", "5ème", "4ème", "3ème"],
  lycee:      ["2nde", "1ère", "Terminale"],
};

// Maps DB-stored values (no accent) → display values (with accent)
const NIVEAU_ALIASES = {
  "6eme": "6ème", "5eme": "5ème", "4eme": "4ème", "3eme": "3ème",
  "2nde": "2nde", "1ere": "1ère", terminale: "Terminale",
  maternelle: "Maternelle",
};

function tarifMatchesNiveau(tarifNiveau, studentNiveau) {
  if (!tarifNiveau || tarifNiveau === "tous") return true;
  if (tarifNiveau === studentNiveau) return true;
  if (NIVEAU_ALIASES[tarifNiveau] === studentNiveau) return true;
  if (CYCLE_MAP[tarifNiveau]?.includes(studentNiveau)) return true;
  return false;
}

const DOC_TYPES = [
  { value: "identite",   label: "Pièce d'identité" },
  { value: "photo",      label: "Photo d'identité (4×4)" },
  { value: "certificat", label: "Certificat de scolarité" },
  { value: "livret",     label: "Livret de famille" },
  { value: "medical",    label: "Certificat médical" },
  { value: "releve",     label: "Relevé de notes" },
  { value: "autre",      label: "Autre document" },
];

const LIEN_OPTIONS = [
  { value: "pere",   label: "Père" },
  { value: "mere",   label: "Mère" },
  { value: "tuteur", label: "Tuteur légal" },
  { value: "autre",  label: "Autre" },
];

const PAYMENT_METHODS = [
  { value: "especes", label: "Espèces" },
  { value: "cheque",  label: "Chèque" },
  { value: "virement",label: "Virement bancaire" },
  { value: "carte",   label: "Carte bancaire" },
];

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.A_L_ETUDE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold", cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Step Progress Bar ─────────────────────────────────────────────────────────
function StepProgress({ currentStep, maxReached }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done    = s.id < maxReached;
        const active  = s.id === maxReached;
        const locked  = s.id > maxReached;
        const StepIcon = s.icon;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                done   && "bg-green-500 text-white",
                active && "bg-blue-600 text-white ring-4 ring-blue-200",
                locked && "bg-slate-100 text-slate-400",
              )}>
                {done ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
              </div>
              <span className={cn(
                "text-[10px] font-medium whitespace-nowrap hidden sm:block",
                done   && "text-green-600",
                active && "text-blue-700",
                locked && "text-slate-400",
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 mb-5 transition-all",
                s.id < maxReached ? "bg-green-400" : "bg-slate-200",
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value ?? "–"}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 1 : Identité + Documents ─────────────────────────────────────────────
function Step1({ form, setForm, dossier, schoolYears, activeYear, onDocAdded, onDocDeleted }) {
  const [newDoc, setNewDoc] = useState({ document_type: "identite", label: "", file_name: "" });
  const [addingDoc, setAddingDoc] = useState(false);

  const handleDocAdd = async () => {
    if (!dossier?.id) return;
    await apiFetch("/documents", {
      method: "POST",
      body: JSON.stringify({ dossier_id: dossier.id, ...newDoc, file_url: "#" }),
    });
    setNewDoc({ document_type: "identite", label: "", file_name: "" });
    setAddingDoc(false);
    onDocAdded?.();
  };

  const handleDocDelete = async (docId) => {
    await apiFetch(`/documents/${docId}`, { method: "DELETE" });
    onDocDeleted?.();
  };

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" /> Identité de l'élève
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Prénom *</Label>
            <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Prénom" />
          </div>
          <div>
            <Label>Nom *</Label>
            <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Nom de famille" />
          </div>
          <div>
            <Label>Date de naissance</Label>
            <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          </div>
          <div>
            <Label>Sexe</Label>
            <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nationalité</Label>
            <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="Algérienne" />
          </div>
          <div>
            <Label>Niveau souhaité</Label>
            <Select value={form.niveau_souhaite} onValueChange={v => setForm(f => ({ ...f, niveau_souhaite: v }))}>
              <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
              <SelectContent>
                {NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Classe souhaitée (optionnel)</Label>
            <Input value={form.classe_souhaitee} onChange={e => setForm(f => ({ ...f, classe_souhaitee: e.target.value }))} placeholder="Ex: 6ème A" />
          </div>
          <div>
            <Label>Année scolaire</Label>
            <Select value={form.school_year} onValueChange={v => setForm(f => ({ ...f, school_year: v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une année" /></SelectTrigger>
              <SelectContent>
                {schoolYears.map(y => (
                  <SelectItem key={y.id} value={y.name}>
                    {y.name} {y.status === "active" ? "✓ active" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <Label>Notes internes</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations sur le dossier…" rows={2} />
        </div>
      </div>

      <Separator />

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Documents reçus
          </h3>
          {dossier?.id && (
            <Button size="sm" variant="outline" onClick={() => setAddingDoc(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </Button>
          )}
        </div>
        {!dossier?.id && (
          <p className="text-sm text-slate-500 italic">Sauvegardez le dossier d'abord pour ajouter des documents.</p>
        )}
        {dossier?.documents?.length === 0 && dossier?.id && (
          <p className="text-sm text-slate-400 italic">Aucun document ajouté.</p>
        )}
        <div className="space-y-2">
          {(dossier?.documents || []).map(doc => (
            <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{doc.label || DOC_TYPES.find(d => d.value === doc.document_type)?.label}</p>
                  {doc.file_name && <p className="text-xs text-slate-500">{doc.file_name}</p>}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDocDelete(doc.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {/* Add doc inline form */}
        {addingDoc && (
          <div className="mt-3 border rounded-xl p-3 space-y-2 bg-blue-50/40">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={newDoc.document_type} onValueChange={v => setNewDoc(d => ({ ...d, document_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Libellé</Label>
                <Input className="h-8 text-xs" value={newDoc.label} onChange={e => setNewDoc(d => ({ ...d, label: e.target.value }))} placeholder="Ex: CNI Père" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleDocAdd} className="bg-blue-600 text-white hover:bg-blue-700 gap-1">
                <Check className="w-3.5 h-3.5" /> Confirmer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingDoc(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2 : Évaluation ────────────────────────────────────────────────────────
function Step2({ rdvForm, setRdvForm, dossier }) {
  const avis    = rdvForm.avis;
  const skipped = !!rdvForm.skip_evaluation;

  return (
    <div className="space-y-5">

      {/* ── Skip toggle ── */}
      <div className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all select-none",
        skipped ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300",
      )} onClick={() => setRdvForm(f => ({ ...f, skip_evaluation: !f.skip_evaluation }))}>
        {/* Custom checkbox */}
        <div className={cn(
          "w-5 h-5 mt-0.5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all",
          skipped ? "bg-orange-500 border-orange-500" : "border-slate-300 bg-white",
        )}>
          {skipped && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1">
          <p className={cn("font-semibold text-sm", skipped ? "text-orange-700" : "text-slate-700")}>
            Ignorer l'étape d'évaluation
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Cochez si le candidat est dispensé de test d'entrée (ex : réinscription, dérogation).
          </p>
        </div>
      </div>

      {/* ── Commentaire (visible seulement si skip) ── */}
      {skipped && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <Label className="text-orange-800 font-semibold">Motif / Commentaire *</Label>
          <Textarea
            className="mt-2 border-orange-200 focus:border-orange-400"
            value={rdvForm.skip_comment}
            onChange={e => setRdvForm(f => ({ ...f, skip_comment: e.target.value }))}
            placeholder="Ex: Réinscription — dossier déjà évalué l'année précédente, dérogation accordée par le directeur…"
            rows={3}
          />
          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            L'étape sera marquée comme ignorée et le dossier passera directement au Profil Famille.
          </p>
        </div>
      )}

      {/* ── Formulaire RDV (masqué si skip) ── */}
      {!skipped && (
        <>
          <div>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-purple-500" /> Rendez-vous d'évaluation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Date du RDV</Label>
                <Input type="date" value={rdvForm.rdv_date} onChange={e => setRdvForm(f => ({ ...f, rdv_date: e.target.value }))} />
              </div>
              <div>
                <Label>Heure</Label>
                <Input type="time" value={rdvForm.rdv_time} onChange={e => setRdvForm(f => ({ ...f, rdv_time: e.target.value }))} />
              </div>
              <div>
                <Label>Type d'évaluation</Label>
                <Select value={rdvForm.rdv_type} onValueChange={v => setRdvForm(f => ({ ...f, rdv_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test_entree">Test d'entrée</SelectItem>
                    <SelectItem value="entretien">Entretien</SelectItem>
                    <SelectItem value="test_niveau">Test de niveau</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Évaluateur</Label>
                <Input value={rdvForm.evaluateur} onChange={e => setRdvForm(f => ({ ...f, evaluateur: e.target.value }))} placeholder="Nom de l'évaluateur" />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" /> Résultats de l'évaluation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Note (sur 20)</Label>
                <Input
                  type="number" min="0" max="20" step="0.5"
                  value={rdvForm.note_evaluation}
                  onChange={e => setRdvForm(f => ({ ...f, note_evaluation: e.target.value }))}
                  placeholder="Ex: 14.5"
                />
              </div>
              <div>
                <Label>Avis</Label>
                <div className="flex gap-2 mt-1">
                  {["favorable", "defavorable", "en_attente"].map(v => (
                    <button
                      key={v}
                      onClick={() => setRdvForm(f => ({ ...f, avis: v }))}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                        avis === v && v === "favorable"   && "bg-green-600 text-white border-green-600",
                        avis === v && v === "defavorable" && "bg-red-600 text-white border-red-600",
                        avis === v && v === "en_attente"  && "bg-yellow-500 text-white border-yellow-500",
                        avis !== v && "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      {v === "favorable" ? "✅ Favorable" : v === "defavorable" ? "❌ Défavorable" : "⏳ En attente"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Label>Observations</Label>
              <Textarea
                value={rdvForm.notes}
                onChange={e => setRdvForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Commentaires sur l'évaluation…"
                rows={3}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Step 3 : Famille ──────────────────────────────────────────────────────────
function Step3({ famille, onAdd, onDelete, dossierId }) {
  const emptyForm = { lien: "pere", first_name: "", last_name: "", phone: "", phone_urgence: "", email: "", profession: "", adresse: "", is_contact_principal: false };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async () => {
    if (!form.first_name || !form.last_name) return;
    await apiFetch("/famille", {
      method: "POST",
      body: JSON.stringify({ ...form, dossier_id: dossierId }),
    });
    setForm(emptyForm);
    setShowForm(false);
    onAdd?.();
  };

  const lienLabel = (v) => LIEN_OPTIONS.find(l => l.value === v)?.label || v;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <HomeIcon className="w-4 h-4 text-yellow-500" /> Responsables légaux
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(s => !s)} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Ajouter un responsable
        </Button>
      </div>

      {/* List */}
      {famille.length === 0 && !showForm && (
        <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-xl">
          Aucun responsable légal ajouté.<br />Cliquez sur "Ajouter un responsable" pour commencer.
        </div>
      )}
      <div className="space-y-3">
        {famille.map(m => (
          <div key={m.id} className="border rounded-xl p-3 bg-white flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-700 text-sm font-bold">{m.first_name?.[0]}{m.last_name?.[0]}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm">{m.first_name} {m.last_name}</p>
                  <Badge variant="outline" className="text-xs capitalize">{lienLabel(m.lien)}</Badge>
                  {m.is_contact_principal === 1 && <Badge className="text-xs bg-yellow-100 text-yellow-800">Principal</Badge>}
                </div>
                {m.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{m.phone}</p>}
                {m.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</p>}
                {m.phone_urgence && <p className="text-xs text-orange-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Urgence: {m.phone_urgence}</p>}
                {m.profession && <p className="text-xs text-slate-400">{m.profession}</p>}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => onDelete(m.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-2 border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/30">
          <h4 className="font-medium text-sm text-slate-700">Nouveau responsable</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lien de parenté</Label>
              <Select value={form.lien} onValueChange={v => setForm(f => ({ ...f, lien: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{LIEN_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.is_contact_principal} onCheckedChange={v => setForm(f => ({ ...f, is_contact_principal: v }))} />
                Contact principal
              </label>
            </div>
            <div>
              <Label className="text-xs">Prénom *</Label>
              <Input className="h-8 text-sm" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input className="h-8 text-sm" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input className="h-8 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Tél. urgence</Label>
              <Input className="h-8 text-sm" value={form.phone_urgence} onChange={e => setForm(f => ({ ...f, phone_urgence: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="h-8 text-sm" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Profession</Label>
              <Input className="h-8 text-sm" value={form.profession} onChange={e => setForm(f => ({ ...f, profession: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Adresse</Label>
            <Input className="h-8 text-sm" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Adresse complète" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} className="bg-blue-600 text-white hover:bg-blue-700 gap-1">
              <Check className="w-3.5 h-3.5" /> Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(emptyForm); setShowForm(false); }}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4 : Services (avec tarifs réels) ─────────────────────────────────────
function Step4({ servicesForm, setServicesForm, tarifsByType = {}, zones = [], currency = "DA", niveau = "" }) {
  const fmt = (n) => Number(n || 0).toLocaleString("fr-DZ");

  // Reusable tarif picker (radio = single, multi = checkbox)
  function TarifPicker({ feeType, multi = false, filterFn }) {
    const list = (tarifsByType[feeType] || []).filter(filterFn || (() => true));
    const singleId = servicesForm[`${feeType}_tarif_id`];
    const multiIds = servicesForm.activite_tarif_ids || [];

    if (list.length === 0) {
      return (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Aucun tarif configuré. Accédez à la <strong className="mx-1">Grille Tarifaire</strong> pour en créer.
        </p>
      );
    }

    return (
      <div className="space-y-2 mt-2">
        {list.map(t => {
          const sel = multi ? multiIds.includes(t.id) : singleId === t.id;
          return (
            <button key={t.id} type="button"
              onClick={() => {
                if (multi) {
                  setServicesForm(f => ({
                    ...f,
                    activite_tarif_ids: sel
                      ? (f.activite_tarif_ids || []).filter(id => id !== t.id)
                      : [...(f.activite_tarif_ids || []), t.id],
                  }));
                } else {
                  setServicesForm(f => ({ ...f, [`${feeType}_tarif_id`]: sel ? null : t.id }));
                }
              }}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3",
                sel ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300",
              )}
            >
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", sel ? "text-blue-700" : "text-slate-700")}>
                  {sel && <span className="text-blue-500 mr-1">✓</span>}
                  {t.label}
                  {t.activite_name && <span className="text-xs font-normal ml-1.5 text-slate-500">— {t.activite_name}</span>}
                  {t.niveau && <span className="text-xs font-normal ml-1.5 text-slate-400">(Niv. {t.niveau})</span>}
                </p>
                {t.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.notes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={cn("text-sm font-bold", sel ? "text-blue-700" : "text-slate-700")}>
                  {fmt(t.amount)} {currency}
                </p>
                <p className="text-xs text-slate-400 capitalize">{t.billing_period || "annuel"}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Frais de base ── */}
      <div>
        <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-widest mb-3">Frais de base</h3>
        <div className="space-y-3">

          {/* Inscription */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Frais d'inscription</p>
                <p className="text-xs text-slate-500">Tarif unique d'admission</p>
              </div>
            </div>
            <TarifPicker feeType="inscription" filterFn={t => tarifMatchesNiveau(t.niveau, niveau)} />
          </div>

          {/* Scolarité */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Frais de scolarité</p>
                <p className="text-xs text-slate-500">Frais annuels selon le niveau</p>
              </div>
            </div>
            <TarifPicker feeType="scolarite" filterFn={t => tarifMatchesNiveau(t.niveau, niveau)} />
          </div>
        </div>
      </div>

      {/* ── Services optionnels ── */}
      <div>
        <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-widest mb-3">Services optionnels</h3>
        <div className="space-y-3">

          {/* Cantine */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Cantine scolaire</p>
                  <p className="text-xs text-slate-500">Repas midi en établissement</p>
                </div>
              </div>
              <Switch
                checked={!!servicesForm.cantine}
                onCheckedChange={v => setServicesForm(f => ({ ...f, cantine: v, cantine_tarif_id: v ? f.cantine_tarif_id : null }))}
              />
            </div>
            {servicesForm.cantine && <TarifPicker feeType="cantine" />}
          </div>

          {/* Transport */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Bus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Transport scolaire</p>
                  <p className="text-xs text-slate-500">Service de navette aller-retour</p>
                </div>
              </div>
              <Switch
                checked={!!servicesForm.transport}
                onCheckedChange={v => setServicesForm(f => ({ ...f, transport: v, transport_zone: v ? f.transport_zone : "", transport_tarif_id: null }))}
              />
            </div>
            {servicesForm.transport && (
              <>
                <div>
                  <Label className="text-sm">Zone de transport</Label>
                  <Select
                    value={servicesForm.transport_zone}
                    onValueChange={v => setServicesForm(f => ({ ...f, transport_zone: v, transport_tarif_id: null }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une zone…" /></SelectTrigger>
                    <SelectContent>
                      {zones.length === 0 && <SelectItem value="_none" disabled>Aucune zone disponible</SelectItem>}
                      {zones.map(z => (
                        <SelectItem key={z.id} value={z.label}>
                          {z.label}{z.code ? ` (${z.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {servicesForm.transport_zone && (
                  <TarifPicker
                    feeType="transport"
                    filterFn={t => !t.transport_zone || t.transport_zone === servicesForm.transport_zone}
                  />
                )}
              </>
            )}
          </div>

          {/* Activités */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Activités extra-scolaires</p>
                <p className="text-xs text-slate-500">Sélectionnez une ou plusieurs activités</p>
              </div>
            </div>
            <TarifPicker feeType="activite" multi={true} />
            {(servicesForm.activite_tarif_ids?.length > 0) && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                {servicesForm.activite_tarif_ids.length} activité(s) sélectionnée(s)
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label>Notes complémentaires</Label>
        <Textarea
          value={servicesForm.notes}
          onChange={e => setServicesForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Besoins spéciaux, allergies alimentaires, remarques…"
          rows={2}
        />
      </div>
    </div>
  );
}

// ── Tarif breakdown helper ─────────────────────────────────────────────────────
function calcBreakdown({ allTarifs = [], servicesForm = {}, remises = [], nbFratrie = 0, manualRemiseIds = [] }) {
  const findT = (id) => id ? allTarifs.find(t => t.id === id) : null;
  const lines = [];

  const push = (tarif, category) => tarif && lines.push({ ...tarif, _cat: category });
  push(findT(servicesForm.inscription_tarif_id), "Inscription");
  push(findT(servicesForm.scolarite_tarif_id), "Scolarité");
  if (servicesForm.cantine) push(findT(servicesForm.cantine_tarif_id), "Cantine");
  if (servicesForm.transport) push(findT(servicesForm.transport_tarif_id), "Transport");
  for (const id of (servicesForm.activite_tarif_ids || [])) push(findT(id), "Activité");

  const gross = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const appliedRemises = [];
  for (const r of remises) {
    let eligible = false;
    if (r.condition_type === "fratrie") {
      eligible = Number(nbFratrie) >= Number(r.condition_value || 1);
    } else if (manualRemiseIds.includes(r.id)) {
      eligible = true;
    }
    if (!eligible) continue;

    let base = gross;
    if (r.applies_to && r.applies_to !== "all") {
      base = lines.filter(l => l.fee_type === r.applies_to).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    }
    const discountAmt = r.discount_mode === "pourcentage"
      ? Math.round(base * Number(r.discount_value) / 100)
      : Number(r.discount_value);
    if (discountAmt > 0) appliedRemises.push({ ...r, discountAmt });
  }

  const totalRemise = appliedRemises.reduce((s, r) => s + r.discountAmt, 0);
  const net = Math.max(0, gross - totalRemise);
  return { lines, gross, appliedRemises, totalRemise, net };
}

// ── Step 5 : Paiement & Validation ────────────────────────────────────────────
function Step5({ dossier, payForm, setPayForm, onValidate, isValidating, allTarifs = [], remises = [], servicesForm = {}, currency = "DA" }) {
  const fmt = (n) => Number(n || 0).toLocaleString("fr-DZ");
  const [manualRemiseIds, setManualRemiseIds] = useState([]);
  const nbFratrie = Number(payForm.nb_fratrie || 0);

  const breakdown = useMemo(() =>
    calcBreakdown({ allTarifs, servicesForm, remises, nbFratrie, manualRemiseIds }),
    [allTarifs, servicesForm, remises, nbFratrie, manualRemiseIds]
  );

  // Auto-fill payment amount when breakdown changes
  const prevNet = React.useRef(null);
  React.useEffect(() => {
    if (breakdown.net !== prevNet.current) {
      prevNet.current = breakdown.net;
      if (breakdown.net > 0) {
        setPayForm(f => ({ ...f, payment_amount: String(breakdown.net) }));
      }
    }
  }, [breakdown.net]);

  // Remises applicable to the current situation (fratrie auto, others manual)
  const fratrie_remises = remises.filter(r => r.condition_type === "fratrie");
  const other_remises = remises.filter(r => r.condition_type !== "fratrie");

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
        <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" /> Récapitulatif du dossier
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="text-slate-500">Élève :</span> <span className="font-semibold">{dossier?.first_name} {dossier?.last_name}</span></div>
          <div><span className="text-slate-500">Niveau :</span> <span className="font-semibold">{dossier?.niveau_souhaite || "–"}</span></div>
          <div><span className="text-slate-500">Naissance :</span> <span className="font-semibold">{dossier?.date_of_birth || "–"}</span></div>
          <div><span className="text-slate-500">Année :</span> <span className="font-semibold">{dossier?.school_year || "–"}</span></div>
          <div><span className="text-slate-500">Documents :</span> <span className="font-semibold">{dossier?.documents?.length || 0} doc(s)</span></div>
          <div><span className="text-slate-500">Responsables :</span> <span className="font-semibold">{dossier?.famille?.length || 0} personne(s)</span></div>
          {dossier?.services && (
            <>
              <div><span className="text-slate-500">Cantine :</span> <span className={cn("font-semibold", dossier.services.cantine ? "text-green-600" : "text-slate-400")}>{dossier.services.cantine ? "Oui" : "Non"}</span></div>
              <div><span className="text-slate-500">Transport :</span> <span className={cn("font-semibold", dossier.services.transport ? "text-green-600" : "text-slate-400")}>{dossier.services.transport ? dossier.services.transport_zone || "Oui" : "Non"}</span></div>
            </>
          )}
          {dossier?.rdv && (
            <div className="col-span-2">
              <span className="text-slate-500">Évaluation :</span>{" "}
              <span className={cn("font-semibold", dossier.rdv.avis === "favorable" ? "text-green-600" : dossier.rdv.avis === "defavorable" ? "text-red-500" : "text-yellow-600")}>
                {dossier.rdv.note_evaluation != null ? `${dossier.rdv.note_evaluation}/20 – ` : ""}
                {dossier.rdv.avis === "favorable" ? "✅ Favorable" : dossier.rdv.avis === "defavorable" ? "❌ Défavorable" : "⏳ En attente"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Détail des frais ── */}
      {breakdown.lines.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700 text-sm">Détail des frais</span>
          </div>
          <div className="divide-y divide-slate-100">
            {breakdown.lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-2">{line._cat}</span>
                  <span className="text-sm text-slate-700">{line.label}</span>
                  {line.activite_name && <span className="text-xs text-slate-500 ml-1.5">— {line.activite_name}</span>}
                </div>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">{fmt(line.amount)} {currency}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">Sous-total brut</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt(breakdown.gross)} {currency}</span>
            </div>
          </div>

          {/* Remises appliquées */}
          {breakdown.appliedRemises.length > 0 && (
            <div className="divide-y divide-green-100 border-t border-green-200 bg-green-50/40">
              {breakdown.appliedRemises.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <span className="text-xs font-medium text-green-700">Remise</span>
                    <span className="text-sm text-green-800 ml-2">{r.label}</span>
                    <span className="text-xs text-green-600 ml-1.5">
                      ({r.discount_mode === "pourcentage" ? `${r.discount_value}%` : `${fmt(r.discount_value)} ${currency}`})
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-green-700 tabular-nums">− {fmt(r.discountAmt)} {currency}</span>
                </div>
              ))}
            </div>
          )}

          {/* Net total */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <span className="font-bold">Total net à payer</span>
            <span className="text-lg font-bold tabular-nums">{fmt(breakdown.net)} {currency}</span>
          </div>
        </div>
      )}

      {breakdown.lines.length === 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Aucun tarif sélectionné à l'étape Services. Le montant doit être saisi manuellement.
        </div>
      )}

      {/* ── Section remises ── */}
      {(fratrie_remises.length > 0 || other_remises.length > 0) && (
        <div className="border rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500" /> Remises & Réductions
          </h3>

          {/* Fratrie */}
          {fratrie_remises.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Nombre de frères/sœurs déjà inscrits
                </Label>
                <Input
                  type="number" min="0" max="10"
                  className="w-20 h-8 text-center"
                  value={payForm.nb_fratrie || "0"}
                  onChange={e => setPayForm(f => ({ ...f, nb_fratrie: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                {fratrie_remises.map(r => {
                  const eligible = nbFratrie >= Number(r.condition_value || 1);
                  return (
                    <div key={r.id} className={cn(
                      "flex items-center justify-between text-xs rounded-lg px-3 py-2",
                      eligible ? "bg-green-50 border border-green-200 text-green-800" : "bg-slate-50 border border-slate-200 text-slate-500"
                    )}>
                      <span className="font-medium">{r.label}</span>
                      <span>{eligible ? "✅ Applicable" : `Nécessite ≥ ${r.condition_value} frère(s)/sœur(s)`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Autres remises (manuelles) */}
          {other_remises.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Autres remises</p>
              {other_remises.map(r => {
                const active = manualRemiseIds.includes(r.id);
                return (
                  <label key={r.id} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 border-2 cursor-pointer transition-all",
                    active ? "border-green-400 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0",
                        active ? "bg-green-500 border-green-500" : "border-slate-300"
                      )}>
                        {active && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{r.label}</p>
                        <p className="text-xs text-slate-500 capitalize">{r.condition_type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-700">
                      {r.discount_mode === "pourcentage" ? `-${r.discount_value}%` : `-${fmt(r.discount_value)} ${currency}`}
                    </span>
                    <input type="checkbox" className="hidden" checked={active} onChange={() =>
                      setManualRemiseIds(ids => active ? ids.filter(id => id !== r.id) : [...ids, r.id])
                    } />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Payment */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-indigo-500" /> Paiement des frais d'inscription
        </h3>

        {/* ── Modalité ── */}
        <div className="mb-4">
          <Label className="mb-2 block">Modalité de paiement</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: "comptant",      label: "💵 Comptant",       desc: "Paiement intégral" },
              { value: "mensuel",       label: "📅 Mensualités",    desc: "Échelonné par mois" },
              { value: "trimestriel",   label: "📆 Trimestriel",    desc: "3 versements / an" },
              { value: "semestriel",    label: "🗓️ Semestriel",    desc: "2 versements / an" },
              { value: "annuel",        label: "📋 Annuel",         desc: "1 versement / an" },
              { value: "par_tranche",   label: "✂️ Par tranches",   desc: "Nombre libre" },
            ].map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPayForm(f => ({ ...f, payment_modality: m.value }))}
                className={cn(
                  "text-left px-3 py-2.5 rounded-xl border-2 transition-all",
                  payForm.payment_modality === m.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-indigo-300",
                )}
              >
                <p className={cn("text-sm font-semibold", payForm.payment_modality === m.value ? "text-indigo-700" : "text-slate-700")}>
                  {m.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Champs communs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label>Montant total ({currency}){breakdown.net > 0 && <span className="text-xs text-green-600 ml-1.5 font-normal">calculé automatiquement</span>}</Label>
            <Input
              type="number" min="0"
              value={payForm.payment_amount}
              onChange={e => setPayForm(f => ({ ...f, payment_amount: e.target.value }))}
              placeholder="Ex: 60000"
              className={breakdown.net > 0 ? "border-green-400 bg-green-50/40" : ""}
            />
          </div>
          <div>
            <Label>Mode de paiement</Label>
            <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({ ...f, payment_method: v }))}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Référence / N° de reçu</Label>
            <Input
              value={payForm.payment_reference}
              onChange={e => setPayForm(f => ({ ...f, payment_reference: e.target.value }))}
              placeholder="Ex: CHQ-00421 ou REF-2025"
            />
          </div>
        </div>

        {/* ── Détails Mensualités ── */}
        {payForm.payment_modality === "mensuel" && (
          <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-3">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Paramètres des mensualités</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre de mensualités</Label>
                <Input
                  type="number" min="1" max="24"
                  value={payForm.nb_months}
                  onChange={e => setPayForm(f => ({ ...f, nb_months: e.target.value }))}
                  placeholder="Ex: 10"
                />
              </div>
              <div>
                <Label className="text-xs">Montant mensuel (DA)</Label>
                <Input
                  type="number" min="0"
                  value={payForm.monthly_amount || (payForm.payment_amount && payForm.nb_months ? Math.round(+payForm.payment_amount / +payForm.nb_months) : "")}
                  onChange={e => setPayForm(f => ({ ...f, monthly_amount: e.target.value }))}
                  placeholder="Calculé automatiquement"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Date du 1er versement</Label>
                <Input
                  type="date"
                  value={payForm.first_payment_date}
                  onChange={e => setPayForm(f => ({ ...f, first_payment_date: e.target.value }))}
                />
              </div>
            </div>
            {payForm.payment_amount && payForm.nb_months && (
              <div className="bg-white rounded-lg p-2 text-xs text-indigo-800 font-medium border border-indigo-200">
                💡 {payForm.nb_months} × {Math.round(+payForm.payment_amount / +payForm.nb_months).toLocaleString("fr-FR")} {currency} = {(+payForm.payment_amount).toLocaleString("fr-FR")} {currency}
              </div>
            )}
          </div>
        )}

        {/* ── Détails Trimestriel ── */}
        {payForm.payment_modality === "trimestriel" && (
          <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">3 versements trimestriels</p>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Tranche {i}</span>
                <Input className="h-8 text-xs" type="number" placeholder={`${Math.round(+payForm.payment_amount / 3) || "Montant"} DA`} />
                <Input className="h-8 text-xs" type="date" />
              </div>
            ))}
          </div>
        )}

        {/* ── Détails Semestriel ── */}
        {payForm.payment_modality === "semestriel" && (
          <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">2 versements semestriels</p>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Semestre {i}</span>
                <Input className="h-8 text-xs" type="number" placeholder={`${Math.round(+payForm.payment_amount / 2) || "Montant"} DA`} />
                <Input className="h-8 text-xs" type="date" />
              </div>
            ))}
          </div>
        )}

        {/* ── Tranches libres ── */}
        {payForm.payment_modality === "par_tranche" && (
          <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Tranches personnalisées</p>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Nombre :</Label>
                <Select
                  value={payForm.nb_tranches}
                  onValueChange={v => setPayForm(f => ({ ...f, nb_tranches: v, tranches: Array.from({ length: +v }, (_, i) => f.tranches[i] || { amount: "", date: "" }) }))}
                >
                  <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2,3,4,5,6,8,10,12].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {Array.from({ length: +payForm.nb_tranches || 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0 font-medium">Tranche {i + 1}</span>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  placeholder="Montant DA"
                  value={payForm.tranches[i]?.amount || ""}
                  onChange={e => setPayForm(f => {
                    const t = [...(f.tranches || [])];
                    t[i] = { ...(t[i] || {}), amount: e.target.value };
                    return { ...f, tranches: t };
                  })}
                />
                <Input
                  className="h-8 text-xs"
                  type="date"
                  value={payForm.tranches[i]?.date || ""}
                  onChange={e => setPayForm(f => {
                    const t = [...(f.tranches || [])];
                    t[i] = { ...(t[i] || {}), date: e.target.value };
                    return { ...f, tranches: t };
                  })}
                />
              </div>
            ))}
            {payForm.tranches.length > 0 && payForm.payment_amount && (
              <div className="bg-white rounded-lg p-2 text-xs border border-indigo-200">
                <span className="text-indigo-700 font-medium">
                  Total saisi : {payForm.tranches.reduce((s, t) => s + (+t.amount || 0), 0).toLocaleString("fr-FR")} {currency}
                  {" / "}{(+payForm.payment_amount || 0).toLocaleString("fr-FR")} {currency} attendus
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Comptant — confirmation ── */}
        {payForm.payment_modality === "comptant" && payForm.payment_amount && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
            💵 Paiement intégral de <strong>{(+payForm.payment_amount).toLocaleString("fr-FR")} {currency}</strong> en une seule fois.
          </div>
        )}

        {/* ── Annuel ── */}
        {payForm.payment_modality === "annuel" && (
          <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Versement annuel unique</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date de versement</Label>
                <Input type="date" value={payForm.first_payment_date} onChange={e => setPayForm(f => ({ ...f, first_payment_date: e.target.value }))} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-green-800">Valider l'inscription</p>
            <p className="text-sm text-green-700 mt-0.5">
              Cette action créera automatiquement le dossier élève dans le système et passera le statut à <strong>INSCRIT</strong>.
            </p>
          </div>
        </div>
        <Button
          onClick={onValidate}
          disabled={isValidating}
          className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {isValidating ? "Validation en cours…" : "✅ Valider l'inscription"}
        </Button>
      </div>
    </div>
  );
}

// ── Main Stepper Dialog ───────────────────────────────────────────────────────
function InscriptionDialog({ open, onClose, dossierId, schoolYears, activeYear }) {
  const qc = useQueryClient();

  // Local state
  const [activeStep, setActiveStep] = useState(1);
  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "", gender: "M",
    nationality: "Algérienne", niveau_souhaite: "", classe_souhaitee: "",
    school_year: activeYear?.name || "", notes: "",
  });
  const [rdvForm, setRdvForm] = useState({
    rdv_date: "", rdv_time: "", rdv_type: "test_entree",
    note_evaluation: "", avis: "en_attente", evaluateur: "", notes: "",
    skip_evaluation: false, skip_comment: "",
  });
  const [servicesForm, setServicesForm] = useState({
    cantine: false, cantine_tarif_id: null,
    transport: false, transport_zone: "", transport_tarif_id: null,
    inscription_tarif_id: null, scolarite_tarif_id: null,
    activite_tarif_ids: [], activites: [],
    notes: "",
  });
  const [payForm, setPayForm] = useState({
    payment_amount: "", payment_method: "especes", payment_reference: "",
    payment_modality: "comptant",
    nb_months: "10", monthly_amount: "", first_payment_date: "",
    nb_tranches: "3", tranches: [],
    nb_fratrie: "0",
  });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [createdId, setCreatedId] = useState(dossierId || null);
  const [createdAccounts, setCreatedAccounts] = useState(null); // { student, parents[] }

  // Fetch existing dossier if editing
  const { data: dossier, refetch: refetchDossier } = useQuery({
    queryKey: ["insc_dossier", createdId],
    queryFn: () => apiFetch(`/dossiers/${createdId}`),
    enabled: !!createdId,
    onSuccess: (d) => {
      if (d && !d.error) {
        setForm({
          first_name: d.first_name || "", last_name: d.last_name || "",
          date_of_birth: d.date_of_birth || "", gender: d.gender || "M",
          nationality: d.nationality || "Algérienne",
          niveau_souhaite: d.niveau_souhaite || "",
          classe_souhaitee: d.classe_souhaitee || "",
          school_year: d.school_year || activeYear?.name || "",
          notes: d.notes || "",
        });
        if (d.rdv) {
          setRdvForm({
            rdv_date: d.rdv.rdv_date || "", rdv_time: d.rdv.rdv_time || "",
            rdv_type: d.rdv.rdv_type || "test_entree",
            note_evaluation: d.rdv.note_evaluation ?? "",
            avis: d.rdv.avis || "en_attente",
            evaluateur: d.rdv.evaluateur || "", notes: d.rdv.notes || "",
            skip_evaluation: d.rdv.rdv_type === "ignoree",
            skip_comment: d.rdv.rdv_type === "ignoree" ? (d.rdv.notes || "") : "",
          });
        }
        if (d.services) {
          setServicesForm({
            cantine: !!d.services.cantine,
            cantine_tarif_id: d.services.cantine_tarif_id || null,
            transport: !!d.services.transport,
            transport_zone: d.services.transport_zone || "",
            transport_tarif_id: d.services.transport_tarif_id || null,
            inscription_tarif_id: d.services.inscription_tarif_id || null,
            scolarite_tarif_id: d.services.scolarite_tarif_id || null,
            activites: d.services.activites || [],
            activite_tarif_ids: d.services.activite_tarif_ids || [],
            notes: d.services.notes || "",
          });
        }
        setActiveStep(d.step || 1);
      }
    },
  });

  const maxReached = dossier ? (STATUS_STEP[dossier.status] || 1) : 1;

  // ── Tarifs data (from Grille Tarifaire) ──
  const activeSchoolYear = form.school_year || activeYear?.name || "";
  const { data: allTarifs = [] } = useQuery({
    queryKey: ["insc_tarifs", activeSchoolYear],
    queryFn: () => apiFetchTarifs(`/?active=1${activeSchoolYear ? `&school_year=${encodeURIComponent(activeSchoolYear)}` : ""}`),
  });
  const { data: remises = [] } = useQuery({
    queryKey: ["insc_remises", activeSchoolYear],
    queryFn: () => apiFetchTarifs(`/remises${activeSchoolYear ? `?school_year=${encodeURIComponent(activeSchoolYear)}` : ""}`),
  });
  const { data: transportZones = [] } = useQuery({
    queryKey: ["insc_zones"],
    queryFn: () => apiFetchTarifs("/zones"),
  });

  // Group tarifs by fee_type
  const tarifsByType = useMemo(() => {
    const grouped = {};
    for (const t of allTarifs) {
      if (!grouped[t.fee_type]) grouped[t.fee_type] = [];
      grouped[t.fee_type].push(t);
    }
    return grouped;
  }, [allTarifs]);

  // Currency from active school settings (POST required)
  const { data: appSettings } = useQuery({
    queryKey: ["insc_app_settings"],
    queryFn: () => fetch("http://localhost:3001/api/functions/getSchoolSettings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getSession() ? { "x-session-token": getSession().token, "x-user-id": getSession().userId } : {}),
      },
    }).then(r => r.json()),
  });
  const currency = appSettings?.currency_symbol || appSettings?.currency || "DA";

  // Step 1 save (create or update)
  const handleSaveStep1 = async () => {
    if (!form.first_name || !form.last_name) {
      alert("Prénom et nom obligatoires.");
      return;
    }
    setSaving(true);
    try {
      if (!createdId) {
        const res = await apiFetch("/dossiers", { method: "POST", body: JSON.stringify(form) });
        if (res.id) { setCreatedId(res.id); setActiveStep(1); }
      } else {
        await apiFetch(`/dossiers/${createdId}`, { method: "PUT", body: JSON.stringify(form) });
        await refetchDossier();
      }
      qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
      qc.invalidateQueries({ queryKey: ["insc_stats"] });
      if (!createdId) return; // wait for id
      setActiveStep(2);
    } finally { setSaving(false); }
  };

  // Step 2 save (handles skip_evaluation)
  const handleSaveStep2 = async () => {
    setSaving(true);
    try {
      if (rdvForm.skip_evaluation) {
        // Store skip as a special rdv record (rdv_type = "ignoree"), then advance
        await apiFetch("/rdv", {
          method: "POST",
          body: JSON.stringify({
            dossier_id: createdId,
            rdv_type: "ignoree",
            avis: "favorable",
            notes: rdvForm.skip_comment || "Étape ignorée",
          }),
        });
      } else {
        await apiFetch("/rdv", { method: "POST", body: JSON.stringify({ ...rdvForm, dossier_id: createdId }) });
      }
      await refetchDossier();
      qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
      setActiveStep(3);
    } finally { setSaving(false); }
  };

  // Step 3 — save handled inside Step3 component, just advance
  const handleNextStep3 = async () => {
    if (!dossier?.famille?.length) {
      if (!window.confirm("Aucun responsable légal ajouté. Continuer quand même ?")) return;
    }
    await apiFetch(`/dossiers/${createdId}/status`, { method: "PUT", body: JSON.stringify({ status: "PROFIL_FAMILLE" }) });
    await refetchDossier();
    qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
    setActiveStep(4);
  };

  // Step 4 save
  const handleSaveStep4 = async () => {
    setSaving(true);
    try {
      // Compute breakdown to persist totals
      const bd = calcBreakdown({
        allTarifs,
        servicesForm,
        remises,
        nbFratrie: Number(payForm.nb_fratrie || 0),
        manualRemiseIds: [],
      });
      await apiFetch("/services", {
        method: "POST",
        body: JSON.stringify({
          ...servicesForm,
          dossier_id: createdId,
          tarif_gross: bd.gross,
          tarif_remise: bd.totalRemise,
          tarif_net: bd.net,
        }),
      });
      // Pre-fill payment amount with net total if available
      if (bd.net > 0) {
        setPayForm(f => ({ ...f, payment_amount: String(bd.net) }));
      }
      await refetchDossier();
      qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
      setActiveStep(5);
    } finally { setSaving(false); }
  };

  // Step 5 — Validate
  const handleValidate = async () => {
    setValidating(true);
    try {
      // Backend creates Student, AppUser (élève), and parent AppUsers automatically
      const result = await apiFetch(`/valider/${createdId}`, {
        method: "POST",
        body: JSON.stringify({ ...payForm }),
      });
      if (result?.accounts) setCreatedAccounts(result.accounts);
      await refetchDossier();
      qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
      qc.invalidateQueries({ queryKey: ["insc_stats"] });
      // Don't auto-close — stay open to show created credentials
    } catch (e) {
      console.error(e);
    } finally { setValidating(false); }
  };

  const handleFamilleDelete = async (id) => {
    await apiFetch(`/famille/${id}`, { method: "DELETE" });
    refetchDossier();
  };

  const handleRefuse = async () => {
    const motif = window.prompt("Motif du refus :");
    if (motif === null) return;
    await apiFetch(`/refuser/${createdId}`, { method: "POST", body: JSON.stringify({ motif }) });
    qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
    qc.invalidateQueries({ queryKey: ["insc_stats"] });
    onClose?.();
  };

  const isInscrit = dossier?.status === "INSCRIT";
  const isRefuse  = dossier?.status === "REFUSE";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-800">
              {createdId ? `Dossier : ${form.first_name} ${form.last_name}` : "Nouveau dossier d'inscription"}
            </DialogTitle>
            {dossier && <StatusBadge status={dossier.status} />}
          </div>
          {/* Stepper */}
          <div className="mt-4">
            <StepProgress currentStep={activeStep} maxReached={isInscrit ? 5 : maxReached} />
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isInscrit && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Inscription validée !</p>
                  <p className="text-sm text-green-700">{dossier.first_name} {dossier.last_name} est maintenant inscrit(e) dans le système.</p>
                </div>
              </div>

              {createdAccounts && (
                <div className="border border-indigo-200 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
                    <p className="font-semibold text-indigo-800 text-sm">Comptes créés automatiquement</p>
                    <p className="text-xs text-indigo-600">Communiquer ces identifiants provisoires aux intéressés — ils devront changer leur mot de passe à la première connexion.</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {createdAccounts.student && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-white">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-700">É</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 font-medium">Compte élève</p>
                          <p className="text-sm font-semibold text-slate-800">{dossier.first_name} {dossier.last_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Login</p>
                          <p className="font-mono text-sm font-bold text-slate-800">{createdAccounts.student.login}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Mot de passe provisoire</p>
                          <p className="font-mono text-sm font-bold text-indigo-700">{createdAccounts.student.provisional_password}</p>
                        </div>
                      </div>
                    )}
                    {(createdAccounts.parents || []).map((p, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-amber-700">P</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 font-medium">Compte parent · {p.lien}</p>
                          <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        </div>
                        {p.already_exists ? (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Compte existant</span>
                        ) : (
                          <>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Login</p>
                              <p className="font-mono text-sm font-bold text-slate-800">{p.login}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Mot de passe provisoire</p>
                              <p className="font-mono text-sm font-bold text-amber-700">{p.provisional_password}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {isRefuse && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Dossier refusé</p>
                <p className="text-sm text-red-700">{dossier.notes}</p>
              </div>
            </div>
          )}

          {!isInscrit && !isRefuse && activeStep === 1 && (
            <Step1
              form={form} setForm={setForm} dossier={dossier}
              schoolYears={schoolYears} activeYear={activeYear}
              onDocAdded={refetchDossier} onDocDeleted={refetchDossier}
            />
          )}
          {!isInscrit && !isRefuse && activeStep === 2 && (
            <Step2 rdvForm={rdvForm} setRdvForm={setRdvForm} dossier={dossier} />
          )}
          {!isInscrit && !isRefuse && activeStep === 3 && (
            <Step3
              famille={dossier?.famille || []}
              dossierId={createdId}
              onAdd={refetchDossier}
              onDelete={handleFamilleDelete}
            />
          )}
          {!isInscrit && !isRefuse && activeStep === 4 && (
            <Step4
              servicesForm={servicesForm}
              setServicesForm={setServicesForm}
              tarifsByType={tarifsByType}
              zones={transportZones}
              currency={currency}
              niveau={form.niveau_souhaite || ""}
            />
          )}
          {!isInscrit && !isRefuse && activeStep === 5 && (
            <Step5
              dossier={dossier}
              payForm={payForm}
              setPayForm={setPayForm}
              onValidate={handleValidate}
              isValidating={validating}
              allTarifs={allTarifs}
              remises={remises}
              servicesForm={servicesForm}
              currency={currency}
            />
          )}
        </div>

        {/* Footer — close button after inscription */}
        {(isInscrit || isRefuse) && (
          <div className="border-t px-6 py-4 flex justify-end flex-shrink-0 bg-slate-50">
            <Button onClick={onClose} className="bg-slate-700 text-white hover:bg-slate-800">
              Fermer
            </Button>
          </div>
        )}

        {/* Footer nav */}
        {!isInscrit && !isRefuse && (
          <div className="border-t px-6 py-4 flex items-center justify-between flex-shrink-0 bg-slate-50">
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={activeStep === 1}
                onClick={() => setActiveStep(s => s - 1)}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Button>
              {createdId && (
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleRefuse}>
                  Refuser le dossier
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {activeStep < 5 && (
                <Button
                  onClick={
                    activeStep === 1 ? handleSaveStep1 :
                    activeStep === 2 ? handleSaveStep2 :
                    activeStep === 3 ? handleNextStep3 :
                    activeStep === 4 ? handleSaveStep4 : undefined
                  }
                  disabled={saving || (!createdId && activeStep > 1)}
                  className="bg-blue-600 text-white hover:bg-blue-700 gap-1"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  {saving ? "Enregistrement…" : "Enregistrer & Continuer"}
                  {!saving && <ChevronRight className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Inscription() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear]   = useState("all");
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [selectedId, setSelectedId]   = useState(null);

  // School years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list(),
  });
  const activeYear = schoolYears.find(y => y.status === "active");

  // Dossiers
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ["insc_dossiers", filterStatus, filterYear, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterStatus !== "all") p.set("status", filterStatus);
      if (filterYear !== "all")   p.set("school_year", filterYear);
      if (search)                 p.set("search", search);
      return apiFetch(`/dossiers?${p}`);
    },
  });

  // Stats
  const { data: stats = {} } = useQuery({
    queryKey: ["insc_stats", filterYear],
    queryFn: () => {
      const p = filterYear !== "all" ? `?school_year=${encodeURIComponent(filterYear)}` : "";
      return apiFetch(`/stats${p}`);
    },
  });

  const openNew   = () => { setSelectedId(null); setDialogOpen(true); };
  const openEdit  = (id) => { setSelectedId(id); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setSelectedId(null); };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce dossier ?")) return;
    await apiFetch(`/dossiers/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["insc_dossiers"] });
    qc.invalidateQueries({ queryKey: ["insc_stats"] });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-blue-600" /> Inscription & Onboarding
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Gérez les candidatures et transformez les prospects en élèves actifs
            </p>
          </div>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Nouveau dossier
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total dossiers"     value={stats.total}        icon={Users}        color="bg-slate-600" />
        <KpiCard label="À l'étude"          value={(stats.A_L_ETUDE || 0) + (stats.EN_EVALUATION || 0)} icon={Clock} color="bg-blue-500" />
        <KpiCard label="Inscrits"           value={stats.INSCRIT || 0} icon={CheckCircle}  color="bg-green-500" />
        <KpiCard label="Refusés"            value={stats.REFUSE || 0}  icon={XCircle}      color="bg-red-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Année scolaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {schoolYears.map(y => (
              <SelectItem key={y.id} value={y.name}>{y.name} {y.status === "active" ? "✓" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Élève</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Niveau</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Année</th>
                <th className="text-left px-4 py-3 font-semibold">Statut</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Progression</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Date création</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Chargement…
                  </td>
                </tr>
              )}
              {!isLoading && dossiers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Aucun dossier trouvé.</p>
                    <Button variant="link" onClick={openNew} className="mt-1 text-blue-600">
                      Créer le premier dossier
                    </Button>
                  </td>
                </tr>
              )}
              {dossiers.map(d => {
                const stepNb  = STATUS_STEP[d.status] || 1;
                const pct     = d.status === "INSCRIT" ? 100 : Math.round(((stepNb - 1) / 4) * 100);
                const isInsc  = d.status === "INSCRIT";
                const isRef   = d.status === "REFUSE";
                return (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openEdit(d.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {d.first_name?.[0]}{d.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{d.first_name} {d.last_name}</p>
                          {d.date_of_birth && <p className="text-xs text-slate-400">{d.date_of_birth}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{d.niveau_souhaite || "–"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{d.school_year || "–"}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell w-36">
                      {isRef ? (
                        <span className="text-red-400 text-xs">Dossier refusé</span>
                      ) : (
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Étape {isInsc ? 5 : stepNb}/5</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", isInsc ? "bg-green-500" : "bg-blue-500")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400 text-xs">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString("fr-FR") : "–"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => openEdit(d.id)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog */}
      {dialogOpen && (
        <InscriptionDialog
          open={dialogOpen}
          onClose={closeDialog}
          dossierId={selectedId}
          schoolYears={schoolYears}
          activeYear={activeYear}
        />
      )}
    </div>
  );
}
