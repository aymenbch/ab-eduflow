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
import { Checkbox } from "@/components/ui/checkbox";

export default function TeacherForm({ open, onClose, teacher, onSave }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    subject_ids: [],
    hire_date: "",
    status: "active",
    address: "",
    qualification: "",
    employee_code: "",
    contract_type: "permanent",
    salary: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  useEffect(() => {
    if (teacher) {
      setFormData({
        first_name: teacher.first_name || "",
        last_name: teacher.last_name || "",
        email: teacher.email || "",
        phone: teacher.phone || "",
        subject_ids: teacher.subject_ids || [],
        hire_date: teacher.hire_date || "",
        status: teacher.status || "active",
        address: teacher.address || "",
        qualification: teacher.qualification || "",
        employee_code: teacher.employee_code || "",
        contract_type: teacher.contract_type || "permanent",
        salary: teacher.salary || "",
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        subject_ids: [],
        hire_date: new Date().toISOString().split("T")[0],
        status: "active",
        address: "",
        qualification: "",
        employee_code: `TCH-${Date.now().toString(36).toUpperCase()}`,
        contract_type: "permanent",
        salary: "",
      });
    }
  }, [teacher, open]);

  const handleSubjectToggle = (subjectId) => {
    setFormData((prev) => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(subjectId)
        ? prev.subject_ids.filter((id) => id !== subjectId)
        : [...prev.subject_ids, subjectId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : null,
    };

    if (teacher) {
      await base44.entities.Teacher.update(teacher.id, data);
    } else {
      await base44.entities.Teacher.create(data);
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
            {teacher ? "Modifier l'enseignant" : "Nouvel enseignant"}
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
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Matières enseignées</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={subject.id}
                    checked={formData.subject_ids.includes(subject.id)}
                    onCheckedChange={() => handleSubjectToggle(subject.id)}
                  />
                  <label
                    htmlFor={subject.id}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {subject.name}
                  </label>
                </div>
              ))}
              {subjects.length === 0 && (
                <p className="text-sm text-slate-500 col-span-2">Aucune matière disponible</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date d'embauche</Label>
              <Input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de contrat</Label>
              <Select
                value={formData.contract_type}
                onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">CDI</SelectItem>
                  <SelectItem value="contract">CDD</SelectItem>
                  <SelectItem value="part_time">Temps partiel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code employé</Label>
              <Input
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Salaire</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Qualification</Label>
            <Textarea
              value={formData.qualification}
              onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
              rows={2}
              placeholder="Diplômes, certifications..."
            />
          </div>

          <div className="space-y-2">
            <Label>Adresse</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {teacher ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}