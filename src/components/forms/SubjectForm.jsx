import React, { useState, useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Loader2, FlaskConical } from "lucide-react";
import { SUBJECT_CATEGORIES } from "@/pages/Subjects";

const COLORS = [
  "#3B82F6", // bleu
  "#10B981", // vert
  "#8B5CF6", // violet
  "#F97316", // orange
  "#EC4899", // rose
  "#06B6D4", // cyan
  "#EF4444", // rouge
  "#EAB308", // jaune
  "#14B8A6", // teal
  "#6366F1", // indigo
  "#F43F5E", // rose-red
  "#84CC16", // lime
];

const LEVELS = [
  "CP","CE1","CE2","CM1","CM2",
  "6ème","5ème","4ème","3ème",
  "2nde","1ère","Terminale",
  "Tous niveaux",
];

export default function SubjectForm({ open, onClose, subject, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    coefficient: 1,
    color: "#3B82F6",
    category: "general",
    level: "",
    weekly_hours: "",
    description: "",
    is_evaluable: true,
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    if (subject) {
      setFormData({
        name:         subject.name || "",
        code:         subject.code || "",
        coefficient:  subject.coefficient ?? 1,
        color:        subject.color || "#3B82F6",
        category:     subject.category || "general",
        level:        subject.level || "",
        weekly_hours: subject.weekly_hours ?? "",
        description:  subject.description || "",
        is_evaluable: subject.is_evaluable !== false,
        status:       subject.status || "active",
      });
    } else {
      setFormData({
        name: "", code: "", coefficient: 1, color: "#3B82F6",
        category: "general", level: "", weekly_hours: "", description: "",
        is_evaluable: true, status: "active",
      });
    }
  }, [subject, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...formData,
        coefficient:  Number(formData.coefficient) || 1,
        weekly_hours: formData.weekly_hours !== "" ? Number(formData.weekly_hours) : null,
        level:        formData.level || null,
        code:         formData.code.trim().toUpperCase() || null,
        is_evaluable: Boolean(formData.is_evaluable),
      };
      if (subject) {
        await base44.entities.Subject.update(subject.id, payload);
      } else {
        await base44.entities.Subject.create(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  // Prévisualisation de la carte
  const previewCat = SUBJECT_CATEGORIES.find((c) => c.value === formData.category) || SUBJECT_CATEGORIES[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {subject ? "Modifier la matière" : "Nouvelle matière"}
          </DialogTitle>
        </DialogHeader>

        {/* Mini preview */}
        <div
          className="rounded-xl p-4 border-2 flex items-center gap-3"
          style={{ borderColor: formData.color, backgroundColor: `${formData.color}11` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${formData.color}33` }}
          >
            {previewCat.icon}
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">
              {formData.name || <span className="text-slate-300">Nom de la matière</span>}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {formData.code && (
                <span className="text-xs font-mono font-bold" style={{ color: formData.color }}>
                  {formData.code}
                </span>
              )}
              <span className="text-xs text-slate-400">Coef. {formData.coefficient || 1}</span>
              {formData.weekly_hours && <span className="text-xs text-slate-400">{formData.weekly_hours}h/sem</span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Nom + Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nom de la matière *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ex: Mathématiques"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="MATH"
                className="font-mono"
              />
            </div>
          </div>

          {/* Catégorie + Niveau */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Niveau</Label>
              <Select
                value={formData.level || "_none"}
                onValueChange={(v) => setFormData({ ...formData, level: v === "_none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Tous niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tous niveaux</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coeff + H/sem */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Coefficient</Label>
              <Input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={formData.coefficient}
                onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Heures / semaine</Label>
              <Input
                type="number"
                min="0.5"
                max="40"
                step="0.5"
                value={formData.weekly_hours}
                onChange={(e) => setFormData({ ...formData, weekly_hours: e.target.value })}
                placeholder="ex: 3"
              />
            </div>
          </div>

          {/* Couleur */}
          <div className="space-y-2">
            <Label>Couleur d'identification</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: formData.color === c ? "#1e293b" : "transparent",
                    transform: formData.color === c ? "scale(1.2)" : undefined,
                    boxShadow: formData.color === c ? `0 0 0 3px ${c}44` : undefined,
                  }}
                  title={c}
                />
              ))}
              {/* Saisie libre */}
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-7 h-7 rounded-full border-2 border-slate-200 cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>

          {/* is_evaluable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
            <div className="flex items-center gap-2">
              <FlaskConical className={`w-4 h-4 ${formData.is_evaluable ? "text-indigo-600" : "text-slate-400"}`} />
              <div>
                <p className="text-sm font-medium text-slate-800">Matière évaluable</p>
                <p className="text-xs text-slate-400">
                  {formData.is_evaluable
                    ? "Participe au calcul des moyennes et bulletins (coefficient appliqué)"
                    : "Hors calcul de moyenne — aucune note au bulletin (ex: club, activité parascolaire)"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({
                ...prev,
                is_evaluable: !prev.is_evaluable,
                // RG-MAT-02 : si non évaluable, coefficient n'a plus d'importance
              }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                formData.is_evaluable ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                formData.is_evaluable ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* Statut (édition uniquement) */}
          {subject && (
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">✅ Active — utilisable pour nouveaux cours/examens</SelectItem>
                  <SelectItem value="inactive">📦 Archivée — historique préservé, plus utilisable</SelectItem>
                </SelectContent>
              </Select>
              {formData.status === "inactive" && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠️ RG-MAT-03 : Une matière archivée n'apparaîtra plus dans les listes de sélection (emploi du temps, examens, devoirs).
                  Les données historiques (notes, bulletins) restent intactes.
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Programme, objectifs pédagogiques…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {subject ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
