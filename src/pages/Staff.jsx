import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import CredentialsModal from "@/components/shared/CredentialsModal";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
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

const ROLES = {
  admin: "Administrateur",
  secretary: "Secrétaire",
  accountant: "Comptable",
  maintenance: "Maintenance",
  security: "Sécurité",
  librarian: "Bibliothécaire",
  nurse: "Infirmier(e)",
  other: "Autre",
};

export default function Staff() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountModal, setAccountModal] = useState(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "",
    hire_date: "",
    status: "active",
    contract_type: "permanent",
    salary: "",
    employee_code: "",
  });

  const queryClient = useQueryClient();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.Staff.list("-created_date"),
  });

  const handleEdit = (staffMember) => {
    setSelectedStaff(staffMember);
    setFormData({
      first_name: staffMember.first_name || "",
      last_name: staffMember.last_name || "",
      email: staffMember.email || "",
      phone: staffMember.phone || "",
      role: staffMember.role || "",
      hire_date: staffMember.hire_date || "",
      status: staffMember.status || "active",
      contract_type: staffMember.contract_type || "permanent",
      salary: staffMember.salary || "",
      employee_code: staffMember.employee_code || "",
    });
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedStaff(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "",
      hire_date: new Date().toISOString().split("T")[0],
      status: "active",
      contract_type: "permanent",
      salary: "",
      employee_code: `STF-${Date.now().toString(36).toUpperCase()}`,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : null,
    };

    try {
      if (selectedStaff) {
        await base44.entities.Staff.update(selectedStaff.id, data);
      } else {
        const result = await base44.entities.Staff.create(data);
        if (result?._account) {
          setAccountModal({
            title: "Compte personnel créé",
            login: result._account.login,
            provisional_password: result._account.provisional_password,
            full_name: `${result.first_name} ${result.last_name}`,
            typeLabel: "Personnel",
            notify_email: result._account.notify_email,
          });
        }
      }
    } finally {
      setSaving(false);
    }
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (staffToDelete) {
      await base44.entities.Staff.delete(staffToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setDeleteDialogOpen(false);
      setStaffToDelete(null);
    }
  };

  const filteredStaff = staff.filter((s) => {
    return (
      search === "" ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
    );
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    on_leave: "bg-yellow-100 text-yellow-800",
    resigned: "bg-red-100 text-red-800",
  };

  const columns = [
    {
      header: "Employé",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-medium">
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
      header: "Rôle",
      cell: (row) => (
        <Badge variant="outline">{ROLES[row.role] || row.role}</Badge>
      ),
    },
    {
      header: "Contact",
      cell: (row) => (
        <div>
          <p className="text-sm">{row.email || "-"}</p>
          <p className="text-sm text-slate-500">{row.phone}</p>
        </div>
      ),
    },
    {
      header: "Statut",
      cell: (row) => (
        <Badge className={statusColors[row.status] || statusColors.active}>
          {row.status === "active" ? "Actif" : row.status === "on_leave" ? "En congé" : "Démissionné"}
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
                setStaffToDelete(row);
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
        title="Gestion du personnel"
        description={`${staff.length} membres du personnel`}
        action={handleNew}
        actionLabel="Nouveau membre"
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredStaff}
        isLoading={isLoading}
        emptyMessage="Aucun membre du personnel trouvé"
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedStaff ? "Modifier le membre" : "Nouveau membre du personnel"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Salaire</Label>
                <Input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedStaff ? "Mettre à jour" : "Créer"}
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
              Êtes-vous sûr de vouloir supprimer ce membre du personnel ?
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

      <CredentialsModal
        open={!!accountModal}
        onClose={() => setAccountModal(null)}
        credentials={accountModal}
      />
    </div>
  );
}