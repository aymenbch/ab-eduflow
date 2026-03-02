import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import ClassForm from "@/components/forms/ClassForm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, MoreVertical, Pencil, Trash2, MapPin } from "lucide-react";
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

export default function Classes() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);

  const queryClient = useQueryClient();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

  const getStudentCount = (classId) => {
    return students.filter((s) => s.class_id === classId).length;
  };

  const handleEdit = (classData) => {
    setSelectedClass(classData);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (classToDelete) {
      await base44.entities.Class.delete(classToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      setDeleteDialogOpen(false);
      setClassToDelete(null);
    }
  };

  const levelColors = {
    "6ème": "from-blue-400 to-blue-600",
    "5ème": "from-cyan-400 to-cyan-600",
    "4ème": "from-teal-400 to-teal-600",
    "3ème": "from-green-400 to-green-600",
    "2nde": "from-purple-400 to-purple-600",
    "1ère": "from-pink-400 to-pink-600",
    "Terminale": "from-orange-400 to-orange-600",
  };

  const groupedClasses = classes.reduce((acc, cls) => {
    const level = cls.level || "Autre";
    if (!acc[level]) acc[level] = [];
    acc[level].push(cls);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Gestion des classes" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Gestion des classes"
        description={`${classes.length} classes au total`}
        action={() => {
          setSelectedClass(null);
          setFormOpen(true);
        }}
        actionLabel="Nouvelle classe"
      />

      {Object.entries(groupedClasses).map(([level, levelClasses]) => (
        <div key={level} className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">{level}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {levelClasses.map((cls) => {
              const studentCount = getStudentCount(cls.id);
              const mainTeacher = teacherMap[cls.main_teacher_id];
              
              return (
                <Card key={cls.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className={`h-2 bg-gradient-to-r ${levelColors[cls.level] || "from-gray-400 to-gray-600"}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{cls.name}</h3>
                        <p className="text-sm text-slate-500">{cls.school_year}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(cls)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setClassToDelete(cls);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>{studentCount} élève{studentCount > 1 ? "s" : ""}</span>
                        {cls.capacity && (
                          <span className="text-slate-400">/ {cls.capacity}</span>
                        )}
                      </div>
                      
                      {cls.room && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>Salle {cls.room}</span>
                        </div>
                      )}

                      {mainTeacher && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-slate-500 mb-1">Professeur principal</p>
                          <p className="text-sm font-medium">
                            {mainTeacher.first_name} {mainTeacher.last_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {classes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">Aucune classe créée</p>
          <Button
            className="mt-4"
            onClick={() => {
              setSelectedClass(null);
              setFormOpen(true);
            }}
          >
            Créer une classe
          </Button>
        </div>
      )}

      <ClassForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        classData={selectedClass}
        onSave={() => queryClient.invalidateQueries({ queryKey: ["classes"] })}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette classe ? Cette action est irréversible.
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