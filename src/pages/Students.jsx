import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import StudentForm from "@/components/forms/StudentForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
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
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Students() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list("-created_date"),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

  const handleEdit = (student) => {
    setSelectedStudent(student);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (studentToDelete) {
      await base44.entities.Student.delete(studentToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      search === "" ||
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      student.student_code?.toLowerCase().includes(search.toLowerCase());
    
    const matchesClass = classFilter === "all" || student.class_id === classFilter;
    
    return matchesSearch && matchesClass;
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    graduated: "bg-blue-100 text-blue-800",
    transferred: "bg-orange-100 text-orange-800",
  };

  const statusLabels = {
    active: "Actif",
    inactive: "Inactif",
    graduated: "Diplômé",
    transferred: "Transféré",
  };

  const columns = [
    {
      header: "Élève",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
            {row.first_name?.[0]}{row.last_name?.[0]}
          </div>
          <div>
            <p className="font-medium">{row.first_name} {row.last_name}</p>
            <p className="text-sm text-slate-500">{row.student_code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Classe",
      cell: (row) => (
        <span>{classMap[row.class_id]?.name || "-"}</span>
      ),
    },
    {
      header: "Parent/Tuteur",
      cell: (row) => (
        <div>
          <p>{row.parent_name || "-"}</p>
          <p className="text-sm text-slate-500">{row.parent_phone}</p>
        </div>
      ),
    },
    {
      header: "Statut",
      cell: (row) => (
        <Badge className={statusColors[row.status] || statusColors.active}>
          {statusLabels[row.status] || "Actif"}
        </Badge>
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
              <Link to={createPageUrl(`StudentDetail?id=${row.id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                Voir détails
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                setStudentToDelete(row);
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
        title="Gestion des élèves"
        description={`${students.length} élèves enregistrés`}
        action={() => {
          setSelectedStudent(null);
          setFormOpen(true);
        }}
        actionLabel="Nouvel élève"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un élève..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredStudents}
        isLoading={isLoading}
        emptyMessage="Aucun élève trouvé"
      />

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={selectedStudent}
        onSave={() => queryClient.invalidateQueries({ queryKey: ["students"] })}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet élève ? Cette action est irréversible.
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