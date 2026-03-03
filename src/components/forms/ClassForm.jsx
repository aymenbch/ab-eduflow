import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getCurrentLevels } from "@/components/config/educationSystems";

export default function ClassForm({ open, onClose, classData, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    level: "",
    school_year: "",
    main_teacher_id: "",
    room: "",
    capacity: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name || "",
        level: classData.level || "",
        school_year: classData.school_year || "",
        main_teacher_id: classData.main_teacher_id || "",
        room: classData.room || "",
        capacity: classData.capacity || "",
      });
    } else {
      const currentYear = new Date().getFullYear();
      setFormData({
        name: "",
        level: "",
        school_year: `${currentYear}-${currentYear + 1}`,
        main_teacher_id: "",
        room: "",
        capacity: 30,
      });
    }
  }, [classData, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      capacity: formData.capacity ? Number(formData.capacity) : null,
    };

    if (classData) {
      await base44.entities.Class.update(classData.id, data);
    } else {
      await base44.entities.Class.create(data);
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
            {classData ? "Modifier la classe" : "Nouvelle classe"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de la classe *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: 6ème A"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Niveau *</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData({ ...formData, level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Année scolaire *</Label>
              <Input
                value={formData.school_year}
                onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                placeholder="2024-2025"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Professeur principal</Label>
            <Select
              value={formData.main_teacher_id}
              onValueChange={(value) => setFormData({ ...formData, main_teacher_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un enseignant" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Salle</Label>
              <Input
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="Ex: A101"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacité</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {classData ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}