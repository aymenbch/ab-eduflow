import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import SubjectForm from "@/components/forms/SubjectForm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function Subjects() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  const queryClient = useQueryClient();

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const getTeacherCount = (subjectId) => {
    return teachers.filter((t) => t.subject_ids?.includes(subjectId)).length;
  };

  const handleEdit = (subject) => {
    setSelectedSubject(subject);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (subjectToDelete) {
      await base44.entities.Subject.delete(subjectToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setDeleteDialogOpen(false);
      setSubjectToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Gestion des matières" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Gestion des matières"
        description={`${subjects.length} matières configurées`}
        action={() => {
          setSelectedSubject(null);
          setFormOpen(true);
        }}
        actionLabel="Nouvelle matière"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {subjects.map((subject) => {
          const teacherCount = getTeacherCount(subject.id);
          
          return (
            <Card key={subject.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div 
                className="h-2" 
                style={{ backgroundColor: subject.color || "#3B82F6" }} 
              />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: subject.color,
                          color: subject.color 
                        }}
                      >
                        {subject.code}
                      </Badge>
                      <Badge variant="secondary">
                        Coef. {subject.coefficient || 1}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{subject.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {teacherCount} enseignant{teacherCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(subject)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setSubjectToDelete(subject);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {subject.description && (
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                    {subject.description}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {subjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">Aucune matière créée</p>
          <Button
            className="mt-4"
            onClick={() => {
              setSelectedSubject(null);
              setFormOpen(true);
            }}
          >
            Créer une matière
          </Button>
        </div>
      )}

      <SubjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        subject={selectedSubject}
        onSave={() => queryClient.invalidateQueries({ queryKey: ["subjects"] })}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette matière ? Cette action est irréversible.
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