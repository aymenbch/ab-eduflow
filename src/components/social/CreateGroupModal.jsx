import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const GROUP_TYPES = [
  { value: "classe_eleves",  label: "🏫 Groupe Classe (Élèves)" },
  { value: "classe_parents", label: "👨‍👩‍👧 Groupe Classe (Parents)" },
  { value: "classe_prof",    label: "🎓 Groupe Classe + Prof" },
  { value: "matiere",        label: "📚 Groupe Matière" },
  { value: "club",           label: "⭐ Club / Activité" },
  { value: "internat",       label: "🏠 Groupe Internat" },
  { value: "transport",      label: "🚌 Groupe Transport" },
  { value: "projet",         label: "📋 Groupe Projet Scrum" },
  { value: "enseignants",    label: "👩‍🏫 Groupe Enseignants" },
  { value: "annonces",       label: "📢 Canal Annonces Officielles" },
];

export default function CreateGroupModal({ open, onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.SocialGroup.create(data),
    onSuccess: () => {
      qc.invalidateQueries(["social-groups"]);
      toast.success("Groupe créé !");
      setName(""); setType(""); setDescription("");
      onClose();
    }
  });

  const handleCreate = () => {
    if (!name || !type) return;
    mutation.mutate({
      name,
      type,
      description,
      is_readonly: type === "annonces",
      status: "active",
      school_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un groupe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type de groupe</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir le type..." />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nom du groupe</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: 5ème B - Mathématiques" className="mt-1" />
          </div>
          <div>
            <Label>Description (optionnel)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="mt-1" />
          </div>
          {type === "annonces" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              📢 Ce canal sera en lecture seule. Seule la direction pourra publier.
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleCreate}
            disabled={!name || !type || mutation.isPending}>
            Créer le groupe
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}