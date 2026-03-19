import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import TeacherForm from "@/components/forms/TeacherForm";
import CredentialsModal from "@/components/shared/CredentialsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Pencil, Trash2, Mail, Phone } from "lucide-react";
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

export default function Teachers() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [accountModal, setAccountModal] = useState(null);

  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list("-created_date"),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  const handleEdit = (teacher) => {
    setSelectedTeacher(teacher);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (teacherToDelete) {
      await base44.entities.Teacher.delete(teacherToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setDeleteDialogOpen(false);
      setTeacherToDelete(null);
    }
  };

  const filteredTeachers = teachers.filter((teacher) => {
    return (
      search === "" ||
      `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    on_leave: "bg-yellow-100 text-yellow-800",
    resigned: "bg-red-100 text-red-800",
  };

  const statusLabels = {
    active: "Actif",
    on_leave: "En congé",
    resigned: "Démissionné",
  };

  const contractLabels = {
    permanent: "CDI",
    contract: "CDD",
    part_time: "Temps partiel",
  };

  const columns = [
    {
      header: "Enseignant",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
            {row.first_name?.[0]}{row.last_name?.[0]}
          </div>
          <div>
            <p className="font-medium">{row.first_name} {row.last_name}</p>
            <p className="text-sm text-slate-500">{row.employee_code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Contact",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-3 h-3 text-slate-400" />
            {row.email}
          </div>
          {row.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Phone className="w-3 h-3 text-slate-400" />
              {row.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Matières",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subject_ids?.slice(0, 2).map((id) => (
            <Badge 
              key={id} 
              variant="outline"
              style={{ 
                borderColor: subjectMap[id]?.color,
                color: subjectMap[id]?.color 
              }}
            >
              {subjectMap[id]?.name || "..."}
            </Badge>
          ))}
          {row.subject_ids?.length > 2 && (
            <Badge variant="outline">+{row.subject_ids.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      header: "Contrat",
      cell: (row) => (
        <span className="text-sm">{contractLabels[row.contract_type] || "-"}</span>
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
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                setTeacherToDelete(row);
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
        title="Gestion des enseignants"
        description={`${teachers.length} enseignants enregistrés`}
        action={() => {
          setSelectedTeacher(null);
          setFormOpen(true);
        }}
        actionLabel="Nouvel enseignant"
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un enseignant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredTeachers}
        isLoading={isLoading}
        emptyMessage="Aucun enseignant trouvé"
      />

      <TeacherForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teacher={selectedTeacher}
        onSave={(result) => {
          queryClient.invalidateQueries({ queryKey: ["teachers"] });
          if (result?._account) {
            setAccountModal({
              title: "Compte enseignant créé",
              login: result._account.login,
              provisional_password: result._account.provisional_password,
              full_name: `${result.first_name} ${result.last_name}`,
              typeLabel: "Enseignant",
              notify_email: result._account.notify_email,
            });
          }
        }}
      />

      <CredentialsModal
        open={!!accountModal}
        onClose={() => setAccountModal(null)}
        credentials={accountModal}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet enseignant ? Cette action est irréversible.
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