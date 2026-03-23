import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Users, FileText, AlertTriangle, MoreHorizontal, Pencil, Trash2, Plus, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSession } from "@/components/auth/appAuth";

const RH_API = "http://localhost:3001/api/rh";
function apiFetch(path, opts = {}) {
  const s = getSession();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (s?.token) headers["X-Session-Token"] = s.token;
  return fetch(`${RH_API}${path}`, { ...opts, headers }).then(r => r.json());
}

const CONTRACT_TYPES = { cdi: "CDI", cdd: "CDD", vacataire: "Vacataire" };
const CONTRACT_COLORS = {
  cdi: "bg-emerald-100 text-emerald-800",
  cdd: "bg-amber-100 text-amber-800",
  vacataire: "bg-slate-100 text-slate-700",
};

function KPI({ icon, label, value, color = "indigo" }) {
  const bg = { indigo: "bg-indigo-50", emerald: "bg-emerald-50", amber: "bg-amber-50", red: "bg-red-50" };
  const ic = { indigo: "text-indigo-600", emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <Card className={`${bg[color]} border-0`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`${ic[color]} shrink-0`}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RHCollaborateurs() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editContract, setEditContract] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "", employee_type: "teacher", contract_type: "cdi",
    hourly_rate: 0, monthly_base: 0, start_date: "", end_date: "",
    position: "", department: "", notes: "",
  });
  const qc = useQueryClient();

  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] }    = useQuery({ queryKey: ["staff"],    queryFn: () => base44.entities.Staff.list() });
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["rh_contracts"],
    queryFn: () => apiFetch("/contracts"),
  });
  const { data: stats = {} } = useQuery({
    queryKey: ["rh_contracts_stats"],
    queryFn: () => apiFetch("/contracts/stats"),
  });

  const contractByEmployee = useMemo(() => {
    const map = {};
    for (const c of contracts) {
      if (!map[c.employee_id] || c.status === "active") map[c.employee_id] = c;
    }
    return map;
  }, [contracts]);

  const filteredTeachers = teachers.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStaff = staff.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = (employee_id, employee_type) => {
    setEditContract(null);
    setFormData({
      employee_id, employee_type, contract_type: "cdi",
      hourly_rate: 0, monthly_base: 0,
      start_date: new Date().toISOString().split("T")[0],
      end_date: "", position: "", department: "", notes: "",
    });
    setFormOpen(true);
  };

  const openEdit = (contract) => {
    setEditContract(contract);
    setFormData({
      employee_id: contract.employee_id,
      employee_type: contract.employee_type,
      contract_type: contract.contract_type,
      hourly_rate: contract.hourly_rate,
      monthly_base: contract.monthly_base,
      start_date: contract.start_date,
      end_date: contract.end_date || "",
      position: contract.position || "",
      department: contract.department || "",
      notes: contract.notes || "",
      status: contract.status,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editContract) {
      await apiFetch(`/contracts/${editContract.id}`, { method: "PUT", body: JSON.stringify({ ...formData, status: formData.status || "active" }) });
    } else {
      await apiFetch("/contracts", { method: "POST", body: JSON.stringify(formData) });
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["rh_contracts"] });
    qc.invalidateQueries({ queryKey: ["rh_contracts_stats"] });
    setFormOpen(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce contrat ?")) return;
    await apiFetch(`/contracts/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["rh_contracts"] });
    qc.invalidateQueries({ queryKey: ["rh_contracts_stats"] });
  };

  const EmployeeRow = ({ person, type }) => {
    const contract = contractByEmployee[person.id];
    const name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    return (
      <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            <p className="text-xs text-slate-500">{contract?.position || (type === "teacher" ? "Enseignant" : "Personnel")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {contract ? (
            <>
              <Badge className={CONTRACT_COLORS[contract.contract_type]}>{CONTRACT_TYPES[contract.contract_type]}</Badge>
              <span className="text-xs text-slate-500 hidden md:block">
                {contract.hourly_rate > 0 ? `${contract.hourly_rate.toLocaleString()} DA/h` : `${contract.monthly_base.toLocaleString()} DA/mois`}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(contract)}><Pencil className="w-3.5 h-3.5 mr-2" />Modifier</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(contract.id)}><Trash2 className="w-3.5 h-3.5 mr-2" />Supprimer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNew(person.id, type)}>
              <Plus className="w-3 h-3 mr-1" /> Contrat
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Collaborateurs RH"
        description="Gestion des contrats et des profils du personnel"
        action={() => setFormOpen(true)}
        actionLabel="Nouveau contrat"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI icon={<Users className="w-6 h-6" />} label="Contrats actifs" value={stats.total} color="indigo" />
        <KPI icon={<FileText className="w-6 h-6" />} label="CDI" value={stats.cdi} color="emerald" />
        <KPI icon={<FileText className="w-6 h-6" />} label="CDD" value={stats.cdd} color="amber" />
        <KPI icon={<AlertTriangle className="w-6 h-6" />} label="Contrats expirant (60j)" value={stats.expiring} color="red" />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Rechercher un collaborateur…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">Enseignants ({filteredTeachers.length})</TabsTrigger>
          <TabsTrigger value="staff">Personnel ({filteredStaff.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="teachers">
          <Card>
            <CardContent className="p-2 divide-y divide-slate-100">
              {isLoading ? <p className="p-4 text-sm text-slate-400">Chargement…</p> :
                filteredTeachers.length === 0 ? <p className="p-4 text-sm text-slate-400">Aucun enseignant trouvé</p> :
                filteredTeachers.map(t => <EmployeeRow key={t.id} person={t} type="teacher" />)
              }
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="staff">
          <Card>
            <CardContent className="p-2 divide-y divide-slate-100">
              {isLoading ? <p className="p-4 text-sm text-slate-400">Chargement…</p> :
                filteredStaff.length === 0 ? <p className="p-4 text-sm text-slate-400">Aucun personnel trouvé</p> :
                filteredStaff.map(s => <EmployeeRow key={s.id} person={s} type="staff" />)
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Formulaire contrat */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editContract ? "Modifier le contrat" : "Nouveau contrat"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editContract && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type d'employé</Label>
                  <Select value={formData.employee_type} onValueChange={v => setFormData({ ...formData, employee_type: v, employee_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Enseignant</SelectItem>
                      <SelectItem value="staff">Personnel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Employé *</Label>
                  <Select value={formData.employee_id} onValueChange={v => setFormData({ ...formData, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {(formData.employee_type === "teacher" ? teachers : staff).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type de contrat</Label>
                <Select value={formData.contract_type} onValueChange={v => setFormData({ ...formData, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cdi">CDI</SelectItem>
                    <SelectItem value="cdd">CDD</SelectItem>
                    <SelectItem value="vacataire">Vacataire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Poste</Label>
                <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="Ex: Professeur de Maths" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Taux horaire (DA/h)</Label>
                <Input type="number" value={formData.hourly_rate} onChange={e => setFormData({ ...formData, hourly_rate: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Base mensuelle (DA)</Label>
                <Input type="number" value={formData.monthly_base} onChange={e => setFormData({ ...formData, monthly_base: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date début *</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Date fin (CDD)</Label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editContract ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
