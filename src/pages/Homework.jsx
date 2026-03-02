import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar, Loader2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";

export default function Homework() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [homeworkToDelete, setHomeworkToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject_id: "",
    class_id: "",
    assigned_date: "",
    due_date: "",
    file_url: "",
    priority: "normal",
  });

  const queryClient = useQueryClient();

  const { data: homework = [], isLoading } = useQuery({
    queryKey: ["homework"],
    queryFn: () => base44.entities.Homework.list("-due_date"),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  const handleNew = () => {
    setSelectedHomework(null);
    setFormData({
      title: "",
      description: "",
      subject_id: "",
      class_id: "",
      assigned_date: new Date().toISOString().split("T")[0],
      due_date: "",
      file_url: "",
      priority: "normal",
    });
    setFormOpen(true);
  };

  const handleEdit = (hw) => {
    setSelectedHomework(hw);
    setFormData({
      title: hw.title || "",
      description: hw.description || "",
      subject_id: hw.subject_id || "",
      class_id: hw.class_id || "",
      assigned_date: hw.assigned_date || "",
      due_date: hw.due_date || "",
      file_url: hw.file_url || "",
      priority: hw.priority || "normal",
    });
    setFormOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, file_url });
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (selectedHomework) {
      await base44.entities.Homework.update(selectedHomework.id, formData);
    } else {
      await base44.entities.Homework.create(formData);
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["homework"] });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (homeworkToDelete) {
      await base44.entities.Homework.delete(homeworkToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      setDeleteDialogOpen(false);
      setHomeworkToDelete(null);
    }
  };

  const priorityColors = {
    low: "bg-slate-100 text-slate-800",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-red-100 text-red-800",
  };

  const priorityLabels = {
    low: "Faible",
    normal: "Normal",
    high: "Important",
  };

  const getDueDateStatus = (dueDate) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "overdue";
    if (isToday(date)) return "today";
    return "upcoming";
  };

  return (
    <div>
      <PageHeader
        title="Devoirs à faire"
        description={`${homework.length} devoirs assignés`}
        action={handleNew}
        actionLabel="Nouveau devoir"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-40" />
              </Card>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homework.map((hw) => {
            const subject = subjectMap[hw.subject_id];
            const cls = classMap[hw.class_id];
            const dueDateStatus = getDueDateStatus(hw.due_date);

            return (
              <Card key={hw.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div
                  className="h-1.5"
                  style={{ backgroundColor: subject?.color || "#3B82F6" }}
                />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg line-clamp-1">{hw.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: subject?.color,
                            color: subject?.color,
                          }}
                        >
                          {subject?.name || "..."}
                        </Badge>
                        <Badge variant="secondary">{cls?.name}</Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(hw)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setHomeworkToDelete(hw);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {hw.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {hw.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span
                        className={`text-sm ${
                          dueDateStatus === "overdue"
                            ? "text-red-600 font-medium"
                            : dueDateStatus === "today"
                            ? "text-orange-600 font-medium"
                            : "text-slate-600"
                        }`}
                      >
                        {hw.due_date
                          ? format(new Date(hw.due_date), "d MMM yyyy", { locale: fr })
                          : "Non définie"}
                      </span>
                    </div>
                    <Badge className={priorityColors[hw.priority]}>
                      {priorityLabels[hw.priority]}
                    </Badge>
                  </div>

                  {hw.file_url && (
                    <a
                      href={hw.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-sm text-blue-600 hover:underline"
                    >
                      📎 Fichier joint
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {homework.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-slate-500">Aucun devoir assigné</p>
          <Button className="mt-4" onClick={handleNew}>
            Créer un devoir
          </Button>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedHomework ? "Modifier le devoir" : "Nouveau devoir"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Exercices page 42"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matière *</Label>
                <Select
                  value={formData.subject_id}
                  onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classe *</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Instructions détaillées..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date limite *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Important</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fichier joint</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              {formData.file_url && (
                <p className="text-sm text-green-600">✓ Fichier uploadé</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedHomework ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce devoir ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}