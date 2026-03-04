import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function TaskFormModal({ open, onClose, projectId, initialStatus, task }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    project_id: task?.project_id || projectId,
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || initialStatus || "backlog",
    priority: task?.priority || "medium",
    assigned_to: task?.assigned_to || "",
    story_points: task?.story_points || 0,
    due_date: task?.due_date || "",
    blocked: task?.blocked || false,
    blocked_reason: task?.blocked_reason || ""
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["tasks"]);
      toast.success("Tâche créée !");
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["tasks"]);
      toast.success("Tâche mise à jour !");
      onClose();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["tasks"]);
      toast.success("Tâche supprimée !");
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (task) {
      updateMutation.mutate({ id: task.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Supprimer cette tâche ?")) {
      deleteMutation.mutate(task.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle Tâche"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Titre de la tâche"
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description détaillée..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Statut</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="review">Revue</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
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
              <Label>Assigné à</Label>
              <Input
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                placeholder="Nom de la personne"
              />
            </div>

            <div>
              <Label>Story Points</Label>
              <Input
                type="number"
                min="0"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
            <Switch
              checked={formData.blocked}
              onCheckedChange={(checked) => setFormData({ ...formData, blocked: checked })}
            />
            <Label>Tâche bloquée</Label>
          </div>

          {formData.blocked && (
            <div>
              <Label>Raison du blocage</Label>
              <Textarea
                value={formData.blocked_reason}
                onChange={(e) => setFormData({ ...formData, blocked_reason: e.target.value })}
                placeholder="Pourquoi cette tâche est-elle bloquée ?"
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-between pt-4">
            {task && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit">
                {task ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}