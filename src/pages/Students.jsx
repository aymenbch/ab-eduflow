import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import StudentForm from "@/components/forms/StudentForm";
import CredentialsModal from "@/components/shared/CredentialsModal";
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
import { Search, MoreHorizontal, Pencil, Trash2, Eye, AlertTriangle } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountModal, setAccountModal] = useState(null);

  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list("-created_date"),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["promotions"],
    queryFn: () => base44.entities.Promotion.list(),
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

  // Count repeating promotion decisions per student
  const repeatCountMap = promotions.reduce((acc, p) => {
    if (p.status === "repeating") acc[p.student_id] = (acc[p.student_id] || 0) + 1;
    return acc;
  }, {});

  // Students with 2+ redoublements
  const repeatedRedoublants = students.filter(s => (repeatCountMap[s.id] || 0) >= 2);

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
    const matchesStatus = statusFilter === "all" || student.status === statusFilter;

    return matchesSearch && matchesClass && matchesStatus;
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    suspended: "bg-yellow-100 text-yellow-800",
    transferred: "bg-orange-100 text-orange-800",
    graduated: "bg-blue-100 text-blue-800",
    abandoned: "bg-red-100 text-red-800",
  };

  const statusLabels = {
    active: "Actif",
    inactive: "Inactif",
    suspended: "Suspendu",
    transferred: "Transféré",
    graduated: "Diplômé",
    abandoned: "Abandonné",
  };

  const STUDENT_STATUSES_FILTER = [
    { value: "all", label: "Tous les statuts" },
    { value: "active", label: "Actif" },
    { value: "suspended", label: "Suspendu" },
    { value: "transferred", label: "Transféré" },
    { value: "graduated", label: "Diplômé" },
    { value: "abandoned", label: "Abandonné" },
  ];

  // Count students without a class for the alert banner
  const studentsWithoutClass = students.filter(s => !s.class_id && s.status === 'active');

  const columns = [
    {
      header: "Élève",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
            {row.first_name?.[0]}{row.last_name?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{row.first_name} {row.last_name}</p>
              {(repeatCountMap[row.id] || 0) >= 2 && (
                <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {repeatCountMap[row.id]}x redoub.
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{row.student_code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Classe",
      cell: (row) => row.class_id ? (
        <span>{classMap[row.class_id]?.name || row.class_id}</span>
      ) : (
        <span className="flex items-center gap-1 text-amber-600 text-sm font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          Sans classe
        </span>
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
        description={`${students.length} élèves enregistrés • ${students.filter(s => s.status === 'active').length} actifs`}
        action={() => {
          setSelectedStudent(null);
          setFormOpen(true);
        }}
        actionLabel="Nouvel élève"
      />

      {/* Alert: active students without a class */}
      {studentsWithoutClass.length > 0 && (
        <div className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{studentsWithoutClass.length} élève{studentsWithoutClass.length > 1 ? "s actifs" : " actif"}</strong> sans classe affectée.{" "}
            <button
              className="underline font-medium"
              onClick={() => { setStatusFilter("active"); setClassFilter("all"); setSearch(""); }}
            >
              Voir les élèves concernés
            </button>
          </span>
        </div>
      )}

      {/* Alert: repeated grade repetition */}
      {repeatedRedoublants.length > 0 && (
        <div className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{repeatedRedoublants.length} élève{repeatedRedoublants.length > 1 ? "s" : ""}</strong> en situation de redoublement répété (2x ou plus).{" "}
            Vérifiez leur suivi pédagogique.
          </span>
        </div>
      )}

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STUDENT_STATUSES_FILTER.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        onSave={(result) => {
          queryClient.invalidateQueries({ queryKey: ["students"] });
          if (result?._account) {
            setAccountModal({
              title: "Compte élève créé",
              login: result._account.login,
              provisional_password: result._account.provisional_password,
              full_name: `${result.first_name} ${result.last_name}`,
              typeLabel: "Élève",
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