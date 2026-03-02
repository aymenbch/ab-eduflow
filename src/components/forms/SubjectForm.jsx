import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

const COLORS = [
  { name: "Bleu", value: "#3B82F6" },
  { name: "Vert", value: "#10B981" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Orange", value: "#F97316" },
  { name: "Rose", value: "#EC4899" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Rouge", value: "#EF4444" },
  { name: "Jaune", value: "#EAB308" },
];

export default function SubjectForm({ open, onClose, subject, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    coefficient: 1,
    color: "#3B82F6",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name || "",
        code: subject.code || "",
        coefficient: subject.coefficient || 1,
        color: subject.color || "#3B82F6",
        description: subject.description || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        coefficient: 1,
        color: "#3B82F6",
        description: "",
      });
    }
  }, [subject, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      coefficient: Number(formData.coefficient),
    };

    if (subject) {
      await base44.entities.Subject.update(subject.id, data);
    } else {
      await base44.entities.Subject.create(data);
    }

    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {subject ? "Modifier la matière" : "Nouvelle matière"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de la matière *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Mathématiques"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: MATH"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Coefficient</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.coefficient}
                onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color.value
                      ? "border-slate-900 scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {subject ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}