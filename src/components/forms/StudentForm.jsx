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
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    medical_notes: "",
    student_code: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  useEffect(() => {
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
        parent_name: student.parent_name || "",
        parent_phone: student.parent_phone || "",
        parent_email: student.parent_email || "",
        medical_notes: student.medical_notes || "",
        student_code: student.student_code || "",
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
        parent_name: "",
        parent_phone: "",
        parent_email: "",
        medical_notes: "",
        student_code: `STU-${Date.now().toString(36).toUpperCase()}`,
      });
    }
  }, [student, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    if (student) {
      await base44.entities.Student.update(student.id, formData);
    } else {
      await base44.entities.Student.create(formData);
    }
    
    setSaving(false);
    onSave();
    onClose();
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
              <Label>Classe *</Label>
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
              <Label>Matricule</Label>
              <Input
                value={formData.student_code}
                onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adresse</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Informations du parent/tuteur</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Nom du parent/tuteur</Label>
                <Input
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={formData.parent_phone}
                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.parent_email}
                    onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

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
              {student ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}