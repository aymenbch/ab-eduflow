import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, UserCheck, UserPlus, Trash2, Plus, Users, ChevronDown } from "lucide-react";

const STUDENT_STATUSES = [
  { value: "active", label: "Actif" },
  { value: "suspended", label: "Suspendu" },
  { value: "transferred", label: "Transféré" },
  { value: "graduated", label: "Diplômé" },
  { value: "abandoned", label: "Abandonné" },
];

const RELATION_OPTIONS = [
  { value: "père", label: "Père" },
  { value: "mère", label: "Mère" },
  { value: "tuteur", label: "Tuteur légal" },
  { value: "grand-père", label: "Grand-père" },
  { value: "grand-mère", label: "Grand-mère" },
  { value: "oncle", label: "Oncle" },
  { value: "tante", label: "Tante" },
  { value: "frère", label: "Frère" },
  { value: "sœur", label: "Sœur" },
  { value: "autre", label: "Autre" },
];

/** Empty guardian entry template */
const emptyGuardian = () => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  relation: "tuteur",
});

/** Single guardian entry row used in create mode */
function GuardianEntryRow({ index, guardian, isPrimary, canRemove, onChange, onRemove }) {
  const [lookup, setLookup] = useState({ status: "idle", parent: null });
  const timerRef = useRef(null);

  const handleEmailChange = useCallback((val) => {
    onChange(index, { email: val });
    clearTimeout(timerRef.current);
    if (!val.trim() || !val.includes("@")) {
      setLookup({ status: "idle", parent: null });
      return;
    }
    setLookup({ status: "searching", parent: null });
    timerRef.current = setTimeout(async () => {
      try {
        const results = await base44.entities.Parent.filter({ email: val.trim() });
        if (results?.length > 0) {
          const p = results[0];
          setLookup({ status: "found", parent: p });
          // Auto-fill name/phone if fields are still empty
          onChange(index, {
            first_name: guardian.first_name || p.first_name || "",
            last_name: guardian.last_name || p.last_name || "",
            phone: guardian.phone || p.phone || "",
          });
        } else {
          setLookup({ status: "not_found", parent: null });
        }
      } catch {
        setLookup({ status: "idle", parent: null });
      }
    }, 500);
  }, [guardian.first_name, guardian.last_name, guardian.phone, index, onChange]);

  // Reset lookup if email cleared
  useEffect(() => {
    if (!guardian.email) setLookup({ status: "idle", parent: null });
  }, [guardian.email]);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
            {index + 1}
          </div>
          <span className="text-sm font-medium text-slate-700">
            {isPrimary ? "Contact principal" : `Contact supplémentaire`}
          </span>
          {isPrimary && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              Principal
            </span>
          )}
        </div>
        {canRemove && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onRemove(index)}
            title="Supprimer ce contact"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Email field with live lookup */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email *</Label>
          {lookup.status === "searching" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Recherche…
            </span>
          )}
          {lookup.status === "found" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <UserCheck className="w-3.5 h-3.5" />
              Parent existant : {lookup.parent?.first_name} {lookup.parent?.last_name}
            </span>
          )}
          {lookup.status === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <UserPlus className="w-3.5 h-3.5" /> Nouveau parent
            </span>
          )}
        </div>
        <Input
          type="email"
          value={guardian.email}
          onChange={(e) => handleEmailChange(e.target.value)}
          required={isPrimary}
          placeholder="email@exemple.com — obligatoire"
          className={`text-sm ${lookup.status === "found" ? "border-emerald-400 focus-visible:ring-emerald-300" : ""}`}
        />
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Prénom</Label>
          <Input
            value={guardian.first_name}
            onChange={(e) => onChange(index, { first_name: e.target.value })}
            placeholder="Prénom"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom</Label>
          <Input
            value={guardian.last_name}
            onChange={(e) => onChange(index, { last_name: e.target.value })}
            placeholder="Nom de famille"
            className="text-sm"
          />
        </div>
      </div>

      {/* Phone + Relation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Téléphone</Label>
          <Input
            value={guardian.phone}
            onChange={(e) => onChange(index, { phone: e.target.value })}
            placeholder="+213…"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lien familial</Label>
          <Select value={guardian.relation} onValueChange={(val) => onChange(index, { relation: val })}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/** Small inline form for adding a new guardian to an EXISTING student */
function AddGuardianForm({ studentId, existingParentIds, onAdded }) {
  const [guardian, setGuardian] = useState(emptyGuardian());
  const [lookup, setLookup] = useState({ status: "idle", parent: null });
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);

  const handleEmailChange = (val) => {
    setGuardian((prev) => ({ ...prev, email: val }));
    clearTimeout(timerRef.current);
    if (!val.trim() || !val.includes("@")) {
      setLookup({ status: "idle", parent: null });
      return;
    }
    setLookup({ status: "searching", parent: null });
    timerRef.current = setTimeout(async () => {
      try {
        const results = await base44.entities.Parent.filter({ email: val.trim() });
        if (results?.length > 0) {
          const p = results[0];
          setLookup({ status: "found", parent: p });
          setGuardian((prev) => ({
            ...prev,
            first_name: prev.first_name || p.first_name || "",
            last_name: prev.last_name || p.last_name || "",
            phone: prev.phone || p.phone || "",
          }));
        } else {
          setLookup({ status: "not_found", parent: null });
        }
      } catch {
        setLookup({ status: "idle", parent: null });
      }
    }, 500);
  };

  const handleAdd = async () => {
    if (!guardian.email.trim()) return;
    setSaving(true);
    try {
      let parent = lookup.parent;
      if (!parent) {
        parent = await base44.entities.Parent.create({
          first_name: guardian.first_name || "Parent",
          last_name: guardian.last_name || "",
          email: guardian.email.trim(),
          phone: guardian.phone || null,
        });
      } else {
        await base44.entities.Parent.update(parent.id, {
          ...(guardian.first_name && { first_name: guardian.first_name }),
          ...(guardian.last_name && { last_name: guardian.last_name }),
          ...(guardian.phone && { phone: guardian.phone }),
        });
      }
      await base44.entities.StudentGuardian.create({
        student_id: studentId,
        parent_id: parent.id,
        relation: guardian.relation,
        is_primary: existingParentIds.length === 0,
      });
      onAdded();
      setGuardian(emptyGuardian());
      setLookup({ status: "idle", parent: null });
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email *</Label>
          {lookup.status === "searching" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Recherche…
            </span>
          )}
          {lookup.status === "found" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <UserCheck className="w-3.5 h-3.5" />
              {lookup.parent?.first_name} {lookup.parent?.last_name}
            </span>
          )}
          {lookup.status === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <UserPlus className="w-3.5 h-3.5" /> Nouveau parent
            </span>
          )}
        </div>
        <Input
          type="email"
          value={guardian.email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="email@exemple.com"
          className={`h-8 text-sm ${lookup.status === "found" ? "border-emerald-300" : ""}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Prénom</Label>
          <Input
            value={guardian.first_name}
            onChange={(e) => setGuardian((prev) => ({ ...prev, first_name: e.target.value }))}
            className="h-8 text-sm"
            placeholder="Prénom"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom</Label>
          <Input
            value={guardian.last_name}
            onChange={(e) => setGuardian((prev) => ({ ...prev, last_name: e.target.value }))}
            className="h-8 text-sm"
            placeholder="Nom"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Téléphone</Label>
          <Input
            value={guardian.phone}
            onChange={(e) => setGuardian((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+213…"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lien familial</Label>
          <Select value={guardian.relation} onValueChange={(val) => setGuardian((prev) => ({ ...prev, relation: val }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATION_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!guardian.email.trim() || saving}
        className="w-full"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
        Ajouter ce contact
      </Button>
    </div>
  );
}

/** Guardian section shown when EDITING an existing student */
function GuardianSection({ student }) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: guardianLinks = [], isLoading } = useQuery({
    queryKey: ["studentGuardians", student?.id],
    queryFn: () => base44.entities.StudentGuardian.filter({ student_id: student.id }),
    enabled: !!student?.id,
  });

  const { data: parents = [] } = useQuery({
    queryKey: ["parents"],
    queryFn: () => base44.entities.Parent.list(),
    enabled: guardianLinks.length > 0,
  });

  const parentMap = Object.fromEntries(parents.map((p) => [p.id, p]));

  const handleRemove = async (linkId) => {
    await base44.entities.StudentGuardian.delete(linkId);
    qc.invalidateQueries({ queryKey: ["studentGuardians", student.id] });
  };

  const handleAdded = () => {
    qc.invalidateQueries({ queryKey: ["studentGuardians", student.id] });
    setShowAddForm(false);
  };

  const existingParentIds = guardianLinks.map((g) => g.parent_id);

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Tuteurs / Parents
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm((v) => !v)}
          className="text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ajouter
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      )}

      {!isLoading && guardianLinks.length === 0 && !showAddForm && (
        <p className="text-sm text-slate-400 italic">Aucun tuteur lié.</p>
      )}

      {guardianLinks.length > 0 && (
        <div className="space-y-2">
          {guardianLinks.map((link) => {
            const p = parentMap[link.parent_id];
            return (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {p ? `${p.first_name?.[0] || ""}${p.last_name?.[0] || ""}`.toUpperCase() : "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {p ? `${p.first_name} ${p.last_name}` : link.parent_id}
                      {link.is_primary && (
                        <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">Principal</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {RELATION_OPTIONS.find((r) => r.value === link.relation)?.label || link.relation}
                      {p?.phone && ` · ${p.phone}`}
                      {p?.email && ` · ${p.email}`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                  onClick={() => handleRemove(link.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <AddGuardianForm
          studentId={student.id}
          existingParentIds={existingParentIds}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

export default function StudentForm({ open, onClose, student, onSave }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    class_id: "",
    enrollment_date: "",
    status: "active",
    address: "",
    medical_notes: "",
  });

  // Multi-guardian list for create mode (at least one entry always present)
  const [guardians, setGuardians] = useState([emptyGuardian()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  useEffect(() => {
    setError(null);
    if (student) {
      setFormData({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        date_of_birth: student.date_of_birth || "",
        gender: student.gender || "",
        class_id: student.class_id || "",
        enrollment_date: student.enrollment_date || "",
        status: student.status || "active",
        address: student.address || "",
        medical_notes: student.medical_notes || "",
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        date_of_birth: "",
        gender: "",
        class_id: "",
        enrollment_date: new Date().toISOString().split("T")[0],
        status: "active",
        address: "",
        medical_notes: "",
      });
      setGuardians([emptyGuardian()]);
    }
  }, [student, open]);

  // Update a specific guardian field by index
  const handleGuardianChange = useCallback((index, patch) => {
    setGuardians((prev) => prev.map((g, i) => i === index ? { ...g, ...patch } : g));
  }, []);

  const addGuardian = () => {
    setGuardians((prev) => [...prev, emptyGuardian()]);
  };

  const removeGuardian = (index) => {
    setGuardians((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate: create mode requires primary guardian email
    if (!student) {
      if (!guardians[0]?.email?.trim()) {
        setError("L'email du contact principal est obligatoire.");
        return;
      }
      // Validate all additional entries that have data but missing email
      for (let i = 1; i < guardians.length; i++) {
        const g = guardians[i];
        const hasData = g.first_name || g.last_name || g.phone;
        if (hasData && !g.email?.trim()) {
          setError(`L'email est obligatoire pour le contact ${i + 1}.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (student) {
        await base44.entities.Student.update(student.id, formData);
        onSave(null);
      } else {
        // Build payload: primary guardian → flat fields, extras → guardians array
        const primary = guardians[0];
        const additionalGuardians = guardians.slice(1).filter((g) => g.email?.trim());

        const payload = {
          ...formData,
          parent_email: primary.email.trim(),
          parent_name: `${primary.first_name} ${primary.last_name}`.trim() || primary.first_name || "",
          parent_phone: primary.phone || "",
          parent_relation: primary.relation || "tuteur",
          ...(additionalGuardians.length > 0 ? { guardians: additionalGuardians } : {}),
        };

        const result = await base44.entities.Student.create(payload);
        onSave(result);
      }
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Une erreur est survenue.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {student ? "Modifier l'élève" : "Nouvel élève"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de naissance *</Label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Classe</Label>
              <Select
                value={formData.class_id}
                onValueChange={(value) => setFormData({ ...formData, class_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {student?.student_code && (
            <div className="space-y-2">
              <Label>Matricule (généré automatiquement)</Label>
              <Input value={student.student_code} readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Adresse</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          {/* ── Guardian section ──────────────────────────────────────────── */}
          {student ? (
            /* Edit mode: dynamic guardian list via StudentGuardian records */
            <GuardianSection student={student} />
          ) : (
            /* Create mode: multi-guardian entry list */
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-slate-800">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Contacts parent / tuteur
                </h3>
                <span className="text-xs text-slate-400">Un compte sera créé pour chaque email</span>
              </div>

              <div className="space-y-3">
                {guardians.map((g, idx) => (
                  <GuardianEntryRow
                    key={idx}
                    index={idx}
                    guardian={g}
                    isPrimary={idx === 0}
                    canRemove={guardians.length > 1 && idx > 0}
                    onChange={handleGuardianChange}
                    onRemove={removeGuardian}
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addGuardian}
                className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                Ajouter un contact parent / tuteur
              </Button>
            </div>
          )}

          {/* Medical notes */}
          <div className="space-y-2">
            <Label>Notes médicales</Label>
            <Textarea
              value={formData.medical_notes}
              onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
              rows={2}
              placeholder="Allergies, conditions médicales, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {student ? "Mettre à jour" : "Créer l'élève"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
