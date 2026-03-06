import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { MoreHorizontal, Pencil, Trash2, FileSpreadsheet, Loader2 } from "lucide-react";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useTeacherProfile } from "@/components/teachers/useTeacherProfile";
import { createPageUrl } from "@/utils";

const EXAM_TYPES = {
  controle: "Contrôle",
  devoir: "Devoir",
  examen_final: "Examen final",
  oral: "Oral",
  tp: "TP",
};

export default function Exams() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    class_id: "",
    teacher_id: "",
    date: "",
    type: "controle",
    max_score: 20,
    coefficient: 1,
    trimester: "T1",
    description: "",
  });

  const queryClient = useQueryClient();
  const { mySubjectIds, isTeacherRole, teacherProfile } = useTeacherProfile();

  const { data: examsAll = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list("-date"),
  });

  const exams = isTeacherRole && mySubjectIds.length > 0
    ? examsAll.filter(e => mySubjectIds.includes(e.subject_id))
    : examsAll;

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

  // Filtrer les matières disponibles pour l'enseignant connecté
  const availableSubjects = isTeacherRole
    ? subjects.filter(s => mySubjectIds.includes(s.id))
    : subjects;

  const handleNew = () => {
    setSelectedExam(null);
    setFormData({
      title: "",
      subject_id: "",
      class_id: "",
      teacher_id: "",
      date: new Date().toISOString().split("T")[0],
      type: "controle",
      max_score: 20,
      coefficient: 1,
      trimester: "T1",
      description: "",
    });
    setFormOpen(true);
  };

  const handleEdit = (exam) => {
    setSelectedExam(exam);
    setFormData({
      title: exam.title || "",
      subject_id: exam.subject_id || "",
      class_id: exam.class_id || "",
      teacher_id: exam.teacher_id || "",
      date: exam.date || "",
      type: exam.type || "controle",
      max_score: exam.max_score || 20,
      coefficient: exam.coefficient || 1,
      trimester: exam.trimester || "T1",
      description: exam.description || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      max_score: Number(formData.max_score),
      coefficient: Number(formData.coefficient),
    };

    if (selectedExam) {
      await base44.entities.Exam.update(selectedExam.id, data);
    } else {
      await base44.entities.Exam.create(data);
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["exams"] });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (examToDelete) {
      await base44.entities.Exam.delete(examToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  const typeColors = {
    controle: "bg-blue-100 text-blue-800",
    devoir: "bg-green-100 text-green-800",
    examen_final: "bg-purple-100 text-purple-800",
    oral: "bg-orange-100 text-orange-800",
    tp: "bg-cyan-100 text-cyan-800",
  };

  const columns = [
    {
      header: "Examen",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={typeColors[row.type]}>{EXAM_TYPES[row.type]}</Badge>
            <Badge variant="outline">{row.trimester}</Badge>
          </div>
        </div>
      ),
    },
    {
      header: "Matière",
      cell: (row) => {
        const subject = subjectMap[row.subject_id];
        return (
          <Badge
            variant="outline"
            style={{
              borderColor: subject?.color,
              color: subject?.color,
            }}
          >
            {subject?.name || "-"}
          </Badge>
        );
      },
    },
    {
      header: "Classe",
      cell: (row) => <span>{classMap[row.class_id]?.name || "-"}</span>,
    },
    {
      header: "Date",
      cell: (row) => (
        <span>
          {row.date ? format(new Date(row.date), "d MMM yyyy", { locale: fr }) : "-"}
        </span>
      ),
    },
    {
      header: "Barème",
      cell: (row) => (
        <span>
          /{row.max_score || 20} (coef. {row.coefficient || 1})
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={createPageUrl(`Grades?exam_id=${row.id}`)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Saisir les notes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                setExamToDelete(row);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Examens & Notes"
        description={`${exams.length} examens planifiés`}
        action={handleNew}
        actionLabel="Nouvel examen"
      />

      <Tabs defaultValue="T1" className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="T1">Trimestre 1</TabsTrigger>
          <TabsTrigger value="T2">Trimestre 2</TabsTrigger>
          <TabsTrigger value="T3">Trimestre 3</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable columns={columns} data={exams} isLoading={isLoading} />
        </TabsContent>
        {["T1", "T2", "T3"].map((t) => (
          <TabsContent key={t} value={t}>
            <DataTable
              columns={columns}
              data={exams.filter((e) => e.trimester === t)}
              isLoading={isLoading}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedExam ? "Modifier l'examen" : "Nouvel examen"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Contrôle de mathématiques"
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
                    {availableSubjects.map((s) => (
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trimestre</Label>
                <Select
                  value={formData.trimester}
                  onValueChange={(value) => setFormData({ ...formData, trimester: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T1">Trimestre 1</SelectItem>
                    <SelectItem value="T2">Trimestre 2</SelectItem>
                    <SelectItem value="T3">Trimestre 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Barème</Label>
                <Input
                  type="number"
                  value={formData.max_score}
                  onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient</Label>
                <Input
                  type="number"
                  value={formData.coefficient}
                  onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                />
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedExam ? "Mettre à jour" : "Créer"}
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
              Êtes-vous sûr de vouloir supprimer cet examen et toutes ses notes ?
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