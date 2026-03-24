/**
 * Grille Tarifaire — Configuration des frais d'inscription, scolarité,
 * cantine, transport (par zone) et activités extra-scolaires.
 * Accessible uniquement aux profils admin.
 */
import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Plus, Edit2, Trash2, Copy, Settings, DollarSign,
  UtensilsCrossed, Bus, Activity, Tag, Percent,
  GraduationCap, RefreshCw, CheckCircle, ChevronDown,
  Info, Save, AlertTriangle, Users, BookOpen,
} from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────
function apiFetch(path, opts = {}) {
  const session = getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session ? { "x-session-token": session.token, "x-user-id": session.userId } : {}),
    ...opts.headers,
  };
  return fetch(`http://localhost:3001/api/tarifs${path}`, { ...opts, headers }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || `Erreur ${r.status}`);
    return data;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const FEE_TYPES = [
  { value: "inscription",  label: "Inscription",      icon: GraduationCap, color: "bg-blue-500",    light: "bg-blue-50 text-blue-800 border-blue-200" },
  { value: "scolarite",    label: "Scolarité",         icon: BookOpen,       color: "bg-indigo-500",  light: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { value: "cantine",      label: "Cantine",           icon: UtensilsCrossed,color: "bg-orange-500",  light: "bg-orange-50 text-orange-800 border-orange-200" },
  { value: "transport",    label: "Transport",         icon: Bus,            color: "bg-sky-500",     light: "bg-sky-50 text-sky-800 border-sky-200" },
  { value: "activite",     label: "Activités",         icon: Activity,       color: "bg-green-500",   light: "bg-green-50 text-green-800 border-green-200" },
  { value: "autre",        label: "Autres frais",      icon: Tag,            color: "bg-slate-500",   light: "bg-slate-50 text-slate-700 border-slate-200" },
];

const BILLING_PERIODS = [
  { value: "unique",        label: "Forfait unique" },
  { value: "annuel",        label: "Annuel" },
  { value: "semestriel",    label: "Semestriel" },
  { value: "trimestriel",   label: "Trimestriel" },
  { value: "mensuel",       label: "Mensuel" },
  { value: "par_jour",      label: "Par jour" },
];

const NIVEAUX = [
  { value: "tous",       label: "Tous niveaux" },
  { value: "maternelle", label: "Maternelle" },
  { value: "primaire",   label: "Primaire (CP → CM2)" },
  { value: "college",    label: "Collège (6ème → 3ème)" },
  { value: "lycee",      label: "Lycée (2nde → Terminale)" },
  { value: "CP",  label: "CP" }, { value: "CE1", label: "CE1" },
  { value: "CE2", label: "CE2" }, { value: "CM1", label: "CM1" },
  { value: "CM2", label: "CM2" },
  { value: "6eme", label: "6ème" }, { value: "5eme", label: "5ème" },
  { value: "4eme", label: "4ème" }, { value: "3eme", label: "3ème" },
  { value: "2nde", label: "2nde" }, { value: "1ere", label: "1ère" },
  { value: "terminale", label: "Terminale" },
];

const TRANSPORT_ZONES = [
  "Zone 1 – Centre-ville",
  "Zone 2 – Nord",
  "Zone 3 – Sud",
  "Zone 4 – Est",
  "Zone 5 – Ouest",
  "Zone 6 – Périphérie",
];

const ACTIVITES_LIST = [
  "Football", "Basketball", "Volleyball", "Natation",
  "Arts plastiques", "Musique", "Théâtre",
  "Informatique", "Anglais renforcé", "Club sciences",
];

const CONDITION_TYPES = [
  { value: "fratrie",    label: "Fratrie (nième enfant)" },
  { value: "bourse",     label: "Bourse scolaire" },
  { value: "merite",     label: "Mérite académique" },
  { value: "personnel",  label: "Enfant de personnel" },
  { value: "code_promo", label: "Code promotionnel" },
  { value: "autre",      label: "Autre condition" },
];

const FEE_TYPE_APPLIES = [
  { value: "all",         label: "Tous les frais" },
  { value: "inscription", label: "Inscription seulement" },
  { value: "scolarite",   label: "Scolarité seulement" },
  { value: "cantine",     label: "Cantine seulement" },
  { value: "transport",   label: "Transport seulement" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, currency = "DA") {
  return (n || 0).toLocaleString("fr-FR") + " " + currency;
}

function feeTypeConfig(type) {
  return FEE_TYPES.find(f => f.value === type) || FEE_TYPES[FEE_TYPES.length - 1];
}

function periodLabel(p) {
  return BILLING_PERIODS.find(b => b.value === p)?.label || p;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, className }) {
  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-800 truncate">{value}</div>
          <div className="text-xs text-slate-500 truncate">{label}</div>
          {sub && <div className="text-xs font-medium text-slate-600 mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tarif Form Dialog ─────────────────────────────────────────────────────────
function TarifFormDialog({ open, onClose, onSave, initial, defaultType, schoolYear, transportZones = [], schoolYears = [], currency = "DA" }) {
  const empty = {
    fee_type: defaultType || "inscription",
    label: "", niveau: "tous", transport_zone: "", activite_name: "",
    amount: "", billing_period: "annuel",
    school_year: schoolYear || "", currency, notes: "",
  };
  const [form, setForm] = useState(() => initial ? { ...empty, ...initial } : empty);
  const [saving, setSaving] = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (open) setForm(initial
      ? { ...empty, ...initial, niveau: initial.niveau || "tous" }
      : { ...empty, fee_type: defaultType || "inscription" });
  }, [open, initial, defaultType]);

  const ft = feeTypeConfig(form.fee_type);

  const handleSubmit = async () => {
    if (!form.label || !form.amount) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ft.color)}>
              <ft.icon className="w-4 h-4 text-white" />
            </div>
            {initial?.id ? "Modifier le tarif" : "Nouveau tarif"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div>
            <Label>Type de frais *</Label>
            <Select value={form.fee_type} onValueChange={v => setForm(f => ({ ...f, fee_type: v, transport_zone: "", activite_name: "", niveau: "tous" }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div>
            <Label>Libellé *</Label>
            <Input
              className="mt-1"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder={
                form.fee_type === "transport" ? "Ex: Transport Zone 1" :
                form.fee_type === "activite"  ? "Ex: Football – trimestre 1" :
                form.fee_type === "cantine"   ? "Ex: Forfait cantine mensuel" :
                form.fee_type === "inscription" ? "Ex: Frais inscription Primaire" :
                "Libellé du tarif"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Montant */}
            <div>
              <Label>Montant ({currency}) *</Label>
              <div className="relative mt-1">
                <Input
                  type="number" min="0" step="100"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold pointer-events-none">
                  {currency}
                </span>
              </div>
            </div>

            {/* Période */}
            <div>
              <Label>Périodicité</Label>
              <Select value={form.billing_period} onValueChange={v => setForm(f => ({ ...f, billing_period: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BILLING_PERIODS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Niveau (inscription, scolarité, autres) */}
          {["inscription", "scolarite", "autre"].includes(form.fee_type) && (
            <div>
              <Label>Niveau scolaire</Label>
              <Select value={form.niveau || "tous"} onValueChange={v => setForm(f => ({ ...f, niveau: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Tous niveaux" /></SelectTrigger>
                <SelectContent>
                  {NIVEAUX.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Zone de transport */}
          {form.fee_type === "transport" && (
            <div>
              <Label>Zone de transport *</Label>
              {transportZones.length === 0 ? (
                <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Aucune zone configurée. Ajoutez des zones dans l'onglet Transport → Gérer les zones.
                </p>
              ) : (
                <Select value={form.transport_zone || ""} onValueChange={v => setForm(f => ({ ...f, transport_zone: v, label: `Transport – ${v}` }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                  <SelectContent>
                    {transportZones.map(z => <SelectItem key={z.id} value={z.label}>{z.label}{z.code ? ` (${z.code})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Activité */}
          {form.fee_type === "activite" && (
            <div>
              <Label>Activité</Label>
              <Select value={form.activite_name || ""} onValueChange={v => setForm(f => ({ ...f, activite_name: v, label: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner une activité" /></SelectTrigger>
                <SelectContent>
                  {ACTIVITES_LIST.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Année scolaire */}
          <div>
            <Label>Année scolaire</Label>
            {schoolYears.length > 0 ? (
              <Select value={form.school_year || ""} onValueChange={v => setForm(f => ({ ...f, school_year: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une année…" /></SelectTrigger>
                <SelectContent>
                  {schoolYears.map(y => (
                    <SelectItem key={y.id} value={y.name}>
                      {y.name}{y.status === "active" ? " ✓ active" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="mt-1"
                value={form.school_year}
                onChange={e => setForm(f => ({ ...f, school_year: e.target.value }))}
                placeholder="Ex: 2024-2025"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notes internes</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Précisions, conditions particulières…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.label || !form.amount}
            className="bg-blue-600 text-white hover:bg-blue-700 gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Remise Form Dialog ────────────────────────────────────────────────────────
function RemiseFormDialog({ open, onClose, onSave, initial, schoolYear }) {
  const empty = {
    label: "", condition_type: "fratrie", condition_value: "",
    discount_mode: "pourcentage", discount_value: "",
    applies_to: "all", school_year: schoolYear || "", notes: "",
  };
  const [form, setForm] = useState(() => initial ? { ...empty, ...initial } : empty);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ? { ...empty, ...initial } : empty);
  }, [open, initial]);

  const handleSubmit = async () => {
    if (!form.label || !form.discount_value) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-purple-600" />
            {initial?.id ? "Modifier la remise" : "Nouvelle remise / réduction"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Libellé *</Label>
            <Input className="mt-1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Remise 2ème enfant" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type de condition</Label>
              <Select value={form.condition_type} onValueChange={v => setForm(f => ({ ...f, condition_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {form.condition_type === "fratrie" ? "Rang (2ème, 3ème…)" :
                 form.condition_type === "code_promo" ? "Code" : "Valeur condition"}
              </Label>
              <Input
                className="mt-1"
                value={form.condition_value}
                onChange={e => setForm(f => ({ ...f, condition_value: e.target.value }))}
                placeholder={form.condition_type === "fratrie" ? "2" : form.condition_type === "code_promo" ? "PROMO2025" : ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode de réduction</Label>
              <Select value={form.discount_mode} onValueChange={v => setForm(f => ({ ...f, discount_mode: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pourcentage">Pourcentage (%)</SelectItem>
                  <SelectItem value="montant_fixe">Montant fixe (DA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valeur *</Label>
              <div className="relative mt-1">
                <Input
                  type="number" min="0"
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.discount_mode === "pourcentage" ? "10" : "5000"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  {form.discount_mode === "pourcentage" ? "%" : "DA"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label>S'applique à</Label>
            <Select value={form.applies_to} onValueChange={v => setForm(f => ({ ...f, applies_to: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEE_TYPE_APPLIES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Année scolaire (vide = toutes années)</Label>
            <Input className="mt-1" value={form.school_year} onChange={e => setForm(f => ({ ...f, school_year: e.target.value }))} placeholder="Ex: 2024-2025" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.label || !form.discount_value}
            className="bg-purple-600 text-white hover:bg-purple-700 gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tarif Row ─────────────────────────────────────────────────────────────────
function TarifRow({ tarif, onEdit, onDelete, currency = "DA" }) {
  const ft = feeTypeConfig(tarif.fee_type);
  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{tarif.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {tarif.niveau && (
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {NIVEAUX.find(n => n.value === (tarif.niveau || "tous"))?.label || tarif.niveau || "Tous niveaux"}
              </span>
            )}
            {tarif.transport_zone && (
              <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                {tarif.transport_zone}
              </span>
            )}
            {tarif.activite_name && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                {tarif.activite_name}
              </span>
            )}
            {tarif.notes && (
              <span className="text-xs text-slate-400 italic truncate max-w-[160px]">{tarif.notes}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-lg font-bold text-slate-800">{fmt(tarif.amount, currency)}</span>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {periodLabel(tarif.billing_period)}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">{tarif.school_year || "–"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => onEdit(tarif)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(tarif.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Zone Form Dialog ─────────────────────────────────────────────────────────
function ZoneFormDialog({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ label: "", code: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (open) setForm(initial ? { label: initial.label, code: initial.code || "", sort_order: initial.sort_order || 0 } : { label: "", code: "", sort_order: 0 });
  }, [open, initial]);
  const handleSubmit = async () => {
    if (!form.label) return;
    setSaving(true);
    try { await onSave({ ...(initial?.id ? { id: initial.id } : {}), ...form }); onClose(); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-sky-600" />
            {initial?.id ? "Modifier la zone" : "Nouvelle zone de transport"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nom de la zone *</Label>
            <Input className="mt-1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Zone Centre-ville" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code (optionnel)</Label>
              <Input className="mt-1" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex: Z1" />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input className="mt-1" type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.label} className="bg-sky-600 text-white hover:bg-sky-700 gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Zone Manager (used inside Transport tab) ──────────────────────────────────
function ZoneManager({ zones, onAdd, onEdit, onDelete }) {
  return (
    <div className="border border-sky-200 rounded-xl bg-sky-50/50 p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-sky-600" />
          <span className="text-sm font-semibold text-sky-800">Zones de transport</span>
          <span className="text-xs text-sky-500 bg-sky-100 rounded-full px-2">{zones.length} zone(s)</span>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd} className="border-sky-300 text-sky-700 hover:bg-sky-100 gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Ajouter une zone
        </Button>
      </div>
      {zones.length === 0 ? (
        <p className="text-xs text-sky-500 text-center py-2">Aucune zone. Cliquez sur "Ajouter une zone".</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {zones.map(z => (
            <div key={z.id} className="flex items-center gap-1.5 bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 group">
              <span className="text-xs font-semibold text-sky-800">{z.label}</span>
              {z.code && <span className="text-[10px] bg-sky-100 text-sky-600 px-1.5 rounded">{z.code}</span>}
              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                <button onClick={() => onEdit(z)} className="text-slate-400 hover:text-blue-600 p-0.5 rounded">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => onDelete(z.id)} className="text-slate-400 hover:text-red-600 p-0.5 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fee Tab Content ───────────────────────────────────────────────────────────
function FeeTab({ feeType, tarifs, onAdd, onEdit, onDelete, transportZones, onAddZone, onEditZone, onDeleteZone, currency = "DA" }) {
  const ft = feeTypeConfig(feeType);
  const rows = tarifs.filter(t => t.fee_type === feeType);
  const total = rows.reduce((s, t) => s + (t.amount || 0), 0);

  // For transport: group by zone
  const isTransport = feeType === "transport";

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ft.color)}>
            <ft.icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{ft.label}</h3>
            <p className="text-xs text-slate-500">{rows.length} tarif(s) configuré(s)</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onAdd(feeType)}
          className="bg-blue-600 text-white hover:bg-blue-700 gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un tarif
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ft.icon className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun tarif configuré pour <strong>{ft.label}</strong>.</p>
            <Button variant="link" className="text-blue-600 mt-1 text-sm" onClick={() => onAdd(feeType)}>
              + Créer le premier tarif
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Libellé</th>
                <th className="text-right px-4 py-2.5 font-semibold">Montant</th>
                <th className="text-left px-4 py-2.5 font-semibold hidden sm:table-cell">Périodicité</th>
                <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Année</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(t => (
                <TarifRow key={t.id} tarif={t} onEdit={onEdit} onDelete={onDelete} currency={currency} />
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Total</td>
                  <td className="px-4 py-2 text-right font-bold text-slate-800">
                    {fmt(total, currency)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Transport zone manager */}
      {isTransport && (
        <ZoneManager
          zones={transportZones || []}
          onAdd={onAddZone}
          onEdit={onEditZone}
          onDelete={onDeleteZone}
        />
      )}

      {/* Transport zones summary cards */}
      {isTransport && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {rows.map(t => (
            <div key={t.id} className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sky-800 text-xs">{t.transport_zone || t.label}</p>
                  <p className="text-lg font-bold text-sky-900 mt-1">{fmt(t.amount, currency)}</p>
                  <p className="text-xs text-sky-600">{periodLabel(t.billing_period)}</p>
                </div>
                <Bus className="w-4 h-4 text-sky-400 mt-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Remises Tab ───────────────────────────────────────────────────────────────
function RemisesTab({ remises, onAdd, onEdit, onDelete, currency = "DA" }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
            <Percent className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Remises & Réductions</h3>
            <p className="text-xs text-slate-500">{remises.length} règle(s) configurée(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={onAdd} className="bg-purple-600 text-white hover:bg-purple-700 gap-1">
          <Plus className="w-3.5 h-3.5" /> Ajouter une remise
        </Button>
      </div>

      {remises.length === 0 ? (
        <div className="border rounded-xl py-12 text-center text-slate-400 bg-white">
          <Percent className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Aucune remise configurée.</p>
          <Button variant="link" className="text-purple-600 mt-1 text-sm" onClick={onAdd}>
            + Créer la première remise
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {remises.map(r => {
            const condLabel = CONDITION_TYPES.find(c => c.value === r.condition_type)?.label || r.condition_type;
            const appliesLabel = FEE_TYPE_APPLIES.find(f => f.value === r.applies_to)?.label || r.applies_to;
            return (
              <div key={r.id} className="border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{r.label}</p>
                      <span className={cn(
                        "text-sm font-bold px-2 py-0.5 rounded-full",
                        r.discount_mode === "pourcentage" ? "bg-purple-100 text-purple-800" : "bg-teal-100 text-teal-800"
                      )}>
                        {r.discount_mode === "pourcentage"
                          ? `-${r.discount_value}%`
                          : `-${fmt(+r.discount_value, currency)}`}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{condLabel}</span>
                        {r.condition_value && <span className="text-slate-400">→ rang {r.condition_value}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>S'applique à :</span>
                        <span className="font-medium text-slate-700">{appliesLabel}</span>
                      </div>
                      {r.school_year && <div>Année : <span className="font-medium">{r.school_year}</span></div>}
                      {r.notes && <p className="italic text-slate-400 truncate">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => onEdit(r)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-amber-800 text-xs">
          Les remises sont appliquées automatiquement lors de la génération des factures
          en fonction des conditions définies (rang de fratrie, bourse, etc.).
          Elles peuvent se cumuler sauf si une seule est marquée exclusive.
        </p>
      </div>
    </div>
  );
}

// ── Duplicate Year Dialog ─────────────────────────────────────────────────────
function DuplicateDialog({ open, onClose, onConfirm, schoolYears, currentYear }) {
  const [toYear, setToYear] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!toYear || !currentYear) return;
    setSaving(true);
    try { await onConfirm(currentYear, toYear); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-600" /> Dupliquer la grille tarifaire
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-slate-600">
            Copier tous les tarifs de <strong>{currentYear}</strong> vers :
          </p>
          <div>
            <Label>Année de destination</Label>
            <Select value={toYear} onValueChange={setToYear}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une année…" /></SelectTrigger>
              <SelectContent>
                {schoolYears.filter(y => y.name !== currentYear).map(y => (
                  <SelectItem key={y.id} value={y.name}>{y.name} {y.status === "active" ? "✓" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Les tarifs déjà existants dans l'année cible ne seront pas écrasés.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={saving || !toYear} className="bg-blue-600 text-white hover:bg-blue-700 gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Tarifs() {
  const qc = useQueryClient();

  // School year selector
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list(),
  });
  const activeYear = schoolYears.find(y => y.status === "active");
  const [selectedYear, setSelectedYear] = useState(null);
  const year = selectedYear ?? activeYear?.name ?? "";

  // Data
  const { data: tarifs = [], isLoading, refetch } = useQuery({
    queryKey: ["tarifs", year],
    queryFn: () => apiFetch(`?school_year=${encodeURIComponent(year)}&active=1`),
    enabled: !!year,
  });

  const { data: remises = [] } = useQuery({
    queryKey: ["tarifs_remises", year],
    queryFn: () => apiFetch(`/remises?school_year=${encodeURIComponent(year)}`),
    enabled: !!year,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ["tarifs_summary", year],
    queryFn: () => apiFetch(`/summary?school_year=${encodeURIComponent(year)}`),
    enabled: !!year,
  });

  // Transport zones (dynamic)
  const { data: transportZones = [], refetch: refetchZones } = useQuery({
    queryKey: ["tarifs_zones"],
    queryFn: () => apiFetch("/zones"),
  });

  // App currency setting
  const { data: appSettings = {} } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => fetch("http://localhost:3001/api/functions/getSchoolSettings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getSession() ? { "x-session-token": getSession().token } : {}) },
      body: "{}",
    }).then(r => r.json()),
  });
  const currency = appSettings.currency || "DA";

  // Dialogs
  const [tarifDialog, setTarifDialog] = useState({ open: false, initial: null, defaultType: "inscription" });
  const [remiseDialog, setRemiseDialog] = useState({ open: false, initial: null });
  const [dupDialog, setDupDialog] = useState(false);
  const [zoneDialog, setZoneDialog] = useState({ open: false, initial: null });
  const [currencyDialog, setCurrencyDialog] = useState(false);
  const [currencyForm, setCurrencyForm] = useState({ currency: "DA", currency_symbol: "DA" });
  const [savingCurrency, setSavingCurrency] = useState(false);

  const openCurrencyDialog = () => {
    setCurrencyForm({ currency: appSettings.currency || "DA", currency_symbol: appSettings.currency_symbol || appSettings.currency || "DA" });
    setCurrencyDialog(true);
  };

  const saveCurrencySettings = async () => {
    setSavingCurrency(true);
    try {
      const session = getSession();
      await fetch("http://localhost:3001/api/functions/updateSchoolSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { "x-session-token": session.token, "x-user-id": session.userId } : {}) },
        body: JSON.stringify(currencyForm),
      });
      toast.success("Devise enregistrée ✓");
      qc.invalidateQueries({ queryKey: ["appSettings"] });
      setCurrencyDialog(false);
    } catch (e) { toast.error(`Erreur : ${e.message}`); }
    finally { setSavingCurrency(false); }
  };

  const openAddTarif  = (type) => setTarifDialog({ open: true, initial: null, defaultType: type });
  const openEditTarif = (t)    => setTarifDialog({ open: true, initial: t, defaultType: t.fee_type });
  const openAddRemise = ()     => setRemiseDialog({ open: true, initial: null });
  const openEditRemise= (r)    => setRemiseDialog({ open: true, initial: r });
  const openAddZone   = ()     => setZoneDialog({ open: true, initial: null });
  const openEditZone  = (z)    => setZoneDialog({ open: true, initial: z });

  // Zone mutations
  const saveZone = async (form) => {
    try {
      if (form.id) {
        await apiFetch(`/zones/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/zones", { method: "POST", body: JSON.stringify(form) });
      }
      toast.success(form.id ? "Zone modifiée" : "Zone ajoutée ✓");
      refetchZones();
    } catch (e) { toast.error(`Erreur : ${e.message}`); throw e; }
  };

  const deleteZone = async (id) => {
    if (!window.confirm("Supprimer cette zone ?")) return;
    try {
      await apiFetch(`/zones/${id}`, { method: "DELETE" });
      toast.success("Zone supprimée");
      refetchZones();
    } catch (e) { toast.error(`Erreur : ${e.message}`); }
  };

  // Mutations
  const saveTarif = async (form) => {
    try {
      // "tous" is a UI sentinel for null in DB
      const payload = { ...form, niveau: form.niveau === "tous" ? null : (form.niveau || null), school_year: form.school_year || year };
      if (form.id) {
        await apiFetch(`/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/", { method: "POST", body: JSON.stringify(payload) });
      }
      toast.success(form.id ? "Tarif modifié" : "Tarif ajouté ✓");
      qc.invalidateQueries({ queryKey: ["tarifs"] });
      qc.invalidateQueries({ queryKey: ["tarifs_summary"] });
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
      throw e; // Propagate so dialog stays open
    }
  };

  const deleteTarif = async (id) => {
    if (!window.confirm("Supprimer ce tarif ?")) return;
    try {
      await apiFetch(`/${id}?hard=1`, { method: "DELETE" });
      toast.success("Tarif supprimé");
      qc.invalidateQueries({ queryKey: ["tarifs"] });
      qc.invalidateQueries({ queryKey: ["tarifs_summary"] });
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const saveRemise = async (form) => {
    try {
      if (form.id) {
        await apiFetch(`/remises/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/remises", { method: "POST", body: JSON.stringify({ ...form, school_year: form.school_year || year }) });
      }
      toast.success(form.id ? "Remise modifiée" : "Remise ajoutée ✓");
      qc.invalidateQueries({ queryKey: ["tarifs_remises"] });
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
      throw e;
    }
  };

  const deleteRemise = async (id) => {
    if (!window.confirm("Supprimer cette remise ?")) return;
    try {
      await apiFetch(`/remises/${id}`, { method: "DELETE" });
      toast.success("Remise supprimée");
      qc.invalidateQueries({ queryKey: ["tarifs_remises"] });
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const handleDuplicate = async (from, to) => {
    try {
      const res = await apiFetch("/duplicate", { method: "POST", body: JSON.stringify({ from_year: from, to_year: to }) });
      toast.success(`${res.count || 0} tarif(s) copié(s) vers ${to}`);
      qc.invalidateQueries({ queryKey: ["tarifs"] });
      qc.invalidateQueries({ queryKey: ["tarifs_remises"] });
      qc.invalidateQueries({ queryKey: ["tarifs_summary"] });
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
      throw e;
    }
  };

  // KPI aggregates
  const byType = useMemo(() => {
    const map = {};
    (summary.by_type || []).forEach(r => { map[r.fee_type] = r; });
    return map;
  }, [summary]);

  const totalTarifs = tarifs.length;
  const totalRemises = remises.length;
  const hasTransport = tarifs.some(t => t.fee_type === "transport");

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" /> Grille Tarifaire
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Configurez les frais d'inscription, de scolarité, de cantine, de transport et d'activités
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year selector */}
            <Select value={year} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-44 bg-white">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map(y => (
                  <SelectItem key={y.id} value={y.name}>
                    {y.name} {y.status === "active" ? "✓ active" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDupDialog(true)}
              disabled={!year}
              className="gap-1.5"
            >
              <Copy className="w-4 h-4" /> Dupliquer vers…
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openCurrencyDialog}
              className="gap-1.5"
            >
              <Settings className="w-4 h-4" />
              <span className="font-semibold">{currency}</span>
            </Button>
          </div>
        </div>

        {/* Year badge */}
        {year && (
          <div className="mt-3 flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
              year === activeYear?.name ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"
            )}>
              {year === activeYear?.name && <span className="w-2 h-2 bg-green-500 rounded-full" />}
              Année scolaire : {year}
              {year === activeYear?.name && " (active)"}
            </span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {FEE_TYPES.map(ft => {
          const data = byType[ft.value];
          return (
            <Card key={ft.value} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", ft.color)}>
                  <ft.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-slate-800">{data?.cnt || 0}</div>
                <div className="text-xs text-slate-500 truncate">{ft.label}</div>
                {data?.total > 0 && (
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">
                    {fmt(data.total, currency)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Remise summary pill */}
      {totalRemises > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
            <Percent className="w-3.5 h-3.5" />
            {totalRemises} remise(s) configurée(s)
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="inscription">
        <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-white border rounded-xl p-1 shadow-sm">
          {FEE_TYPES.map(ft => {
            const cnt = tarifs.filter(t => t.fee_type === ft.value).length;
            return (
              <TabsTrigger
                key={ft.value}
                value={ft.value}
                className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg"
              >
                <ft.icon className="w-3.5 h-3.5" />
                {ft.label}
                {cnt > 0 && (
                  <span className="ml-1 text-[10px] font-bold bg-white/30 rounded-full px-1.5">{cnt}</span>
                )}
              </TabsTrigger>
            );
          })}
          <TabsTrigger
            value="remises"
            className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-lg"
          >
            <Percent className="w-3.5 h-3.5" />
            Remises
            {totalRemises > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-white/30 rounded-full px-1.5">{totalRemises}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {FEE_TYPES.map(ft => (
          <TabsContent key={ft.value} value={ft.value}>
            {isLoading ? (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Chargement…
              </div>
            ) : (
              <FeeTab
                feeType={ft.value}
                tarifs={tarifs}
                onAdd={openAddTarif}
                onEdit={openEditTarif}
                onDelete={deleteTarif}
                transportZones={transportZones}
                onAddZone={openAddZone}
                onEditZone={openEditZone}
                onDeleteZone={deleteZone}
                currency={currency}
              />
            )}
          </TabsContent>
        ))}

        <TabsContent value="remises">
          <RemisesTab
            remises={remises}
            onAdd={openAddRemise}
            onEdit={openEditRemise}
            onDelete={deleteRemise}
            currency={currency}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TarifFormDialog
        open={tarifDialog.open}
        onClose={() => setTarifDialog(d => ({ ...d, open: false }))}
        onSave={saveTarif}
        initial={tarifDialog.initial}
        defaultType={tarifDialog.defaultType}
        schoolYear={year}
        schoolYears={schoolYears}
        transportZones={transportZones}
        currency={currency}
      />

      <ZoneFormDialog
        open={zoneDialog.open}
        onClose={() => setZoneDialog(d => ({ ...d, open: false }))}
        onSave={saveZone}
        initial={zoneDialog.initial}
      />

      <RemiseFormDialog
        open={remiseDialog.open}
        onClose={() => setRemiseDialog(d => ({ ...d, open: false }))}
        onSave={saveRemise}
        initial={remiseDialog.initial}
        schoolYear={year}
      />

      <DuplicateDialog
        open={dupDialog}
        onClose={() => setDupDialog(false)}
        onConfirm={handleDuplicate}
        schoolYears={schoolYears}
        currentYear={year}
      />

      {/* Currency Settings Dialog */}
      <Dialog open={currencyDialog} onOpenChange={setCurrencyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" /> Paramètres de devise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code devise</Label>
              <Select value={currencyForm.currency} onValueChange={v => setCurrencyForm(f => ({ ...f, currency: v, currency_symbol: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: "DA",  label: "Dinar Algérien (DA)" },
                    { value: "DZD", label: "Dinar Algérien (DZD)" },
                    { value: "MAD", label: "Dirham Marocain (MAD)" },
                    { value: "TND", label: "Dinar Tunisien (TND)" },
                    { value: "EUR", label: "Euro (EUR)" },
                    { value: "USD", label: "Dollar américain (USD)" },
                    { value: "XOF", label: "Franc CFA (XOF)" },
                    { value: "GNF", label: "Franc Guinéen (GNF)" },
                  ].map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Symbole affiché</Label>
              <Input
                className="mt-1"
                value={currencyForm.currency_symbol}
                onChange={e => setCurrencyForm(f => ({ ...f, currency_symbol: e.target.value }))}
                placeholder="Ex: DA, DZD, €, $"
              />
              <p className="text-xs text-slate-400 mt-1">Ce symbole sera affiché dans tous les montants de l'application.</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 flex items-center gap-2">
              <span>Aperçu :</span>
              <span className="font-bold text-slate-800">15 000 {currencyForm.currency_symbol || currencyForm.currency}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCurrencyDialog(false)}>Annuler</Button>
            <Button
              onClick={saveCurrencySettings}
              disabled={savingCurrency}
              className="bg-slate-700 text-white hover:bg-slate-800 gap-2"
            >
              {savingCurrency ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
