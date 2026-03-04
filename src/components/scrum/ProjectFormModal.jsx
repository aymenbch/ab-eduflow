import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PROJECT_TYPES = [
  { value: "amelioration_niveau", label: "Amélioration Niveau" },
  { value: "reduction_absenteisme", label: "Réduction Absentéisme" },
  { value: "amelioration_matiere", label: "Amélioration Matière" },
  { value: "amelioration_discipline", label: "Amélioration Discipline" },
  { value: "optimisation_pedagogique", label: "Optimisation Pédagogique" },
  { value: "autre", label: "Autre" }
];

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"
];

export default function ProjectFormModal({ open, onClose, project }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: project?.name || "",
    description: project?.description || "",
    type: project?.type || "amelioration_niveau",
    target: project?.target || "",
    owner: project?.owner || "",
    objective: project?.objective || "",
    current_kpi: project?.current_kpi || "",
    target_kpi: project?.target_kpi || "",
    priority: project?.priority || "medium",
    color: project?.color || COLORS[0],
    status: project?.status || "draft"
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["projects"]);
      toast.success("Projet créé avec succès !");
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["projects"]);
      toast.success("Projet mis à jour !");
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (project) {
      updateMutation.mutate({ id: project.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Modifier le projet" : "Nouveau Projet Agile"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nom du projet *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Amélioration des résultats en Mathématiques"
                required
              />
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez l'objectif et le contexte du projet..."
                rows={3}
              />
            </div>

            <div>
              <Label>Type de projet *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priorité</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cible</Label>
              <Input
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                placeholder="Ex: 6ème A, Mathématiques..."
              />
            </div>

            <div>
              <Label>Responsable *</Label>
              <Input
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="Nom du responsable"
                required
              />
            </div>

            <div className="col-span-2">
              <Label>Objectif mesurable</Label>
              <Input
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="Ex: Augmenter la moyenne de classe de 12.5 à 14"
              />
            </div>

            <div>
              <Label>KPI Actuel</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.current_kpi}
                onChange={(e) => setFormData({ ...formData, current_kpi: parseFloat(e.target.value) })}
                placeholder="12.5"
              />
            </div>

            <div>
              <Label>KPI Cible</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.target_kpi}
                onChange={(e) => setFormData({ ...formData, target_kpi: parseFloat(e.target.value) })}
                placeholder="14.0"
              />
            </div>

            <div className="col-span-2">
              <Label>Couleur du projet</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 ${formData.color === color ? "border-slate-900" : "border-slate-200"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {project ? "Mettre à jour" : "Créer le projet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}