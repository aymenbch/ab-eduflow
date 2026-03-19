import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Building2,
  Users,
  CheckCircle2,
  Wrench,
  XCircle,
  Projector,
  Monitor,
  FlaskConical,
  Dumbbell,
  BookOpen,
  Wind,
  Wifi,
  Mic,
  Camera,
  RefreshCw,
} from "lucide-react";

// ── Room types ──────────────────────────────────────────────────────────────
const ROOM_TYPES = [
  { value: "classroom",    label: "Salle de classe",     icon: "🏫", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "lab",          label: "Laboratoire",          icon: "🔬", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "computer_lab", label: "Salle informatique",   icon: "💻", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "amphitheater", label: "Amphithéâtre",         icon: "🎭", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "sports",       label: "Salle de sport",       icon: "⚽", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "library",      label: "Bibliothèque",         icon: "📚", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "meeting",      label: "Salle de réunion",     icon: "🤝", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "other",        label: "Autre",                icon: "📦", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

// ── Equipment options ────────────────────────────────────────────────────────
const EQUIPMENT_OPTIONS = [
  { value: "projector",       label: "Projecteur",          icon: Projector },
  { value: "smartboard",      label: "Tableau interactif",  icon: Monitor },
  { value: "computers",       label: "Ordinateurs",         icon: Monitor },
  { value: "lab_equipment",   label: "Équipement de labo",  icon: FlaskConical },
  { value: "sports_equipment",label: "Équipement sportif",  icon: Dumbbell },
  { value: "library_shelves", label: "Rayonnages",          icon: BookOpen },
  { value: "air_conditioning",label: "Climatisation",       icon: Wind },
  { value: "wifi",            label: "Wi-Fi",               icon: Wifi },
  { value: "microphone",      label: "Microphone/Sono",     icon: Mic },
  { value: "camera",          label: "Caméra/Visio",        icon: Camera },
  { value: "whiteboard",      label: "Tableau blanc",       icon: Monitor },
];

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:      { label: "Disponible",    color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  maintenance: { label: "Maintenance",   color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Wrench },
  inactive:    { label: "Hors service",  color: "bg-red-100 text-red-700 border-red-200",         icon: XCircle },
};

function getRoomType(val) {
  return ROOM_TYPES.find((t) => t.value === val) || ROOM_TYPES[ROOM_TYPES.length - 1];
}

function parseEquipment(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Room card ────────────────────────────────────────────────────────────────
function RoomCard({ room, onEdit, onDelete }) {
  const type = getRoomType(room.type);
  const status = STATUS_CFG[room.status] || STATUS_CFG.active;
  const StatusIcon = status.icon;
  const equipment = parseEquipment(room.equipment);

  return (
    <Card className={`transition-shadow hover:shadow-md ${room.status === "inactive" ? "opacity-60" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Icon + name */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">
              {type.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 truncate">{room.name}</h3>
                {room.code && (
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {room.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${type.color}`}>
                  {type.icon} {type.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(room)}>
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onDelete(room)}>
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </Button>
          </div>
        </div>

        {/* Details row */}
        <div className="mt-3 flex items-center gap-4 text-sm text-slate-500 flex-wrap">
          {room.capacity && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {room.capacity} places
            </span>
          )}
          {(room.building || room.floor) && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {[room.building, room.floor].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        {/* Equipment badges */}
        {equipment.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {equipment.map((eq) => {
              const opt = EQUIPMENT_OPTIONS.find((e) => e.value === eq);
              const EqIcon = opt?.icon;
              return (
                <span
                  key={eq}
                  className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full"
                >
                  {EqIcon && <EqIcon className="w-3 h-3" />}
                  {opt?.label || eq}
                </span>
              );
            })}
          </div>
        )}

        {room.description && (
          <p className="mt-2 text-xs text-slate-400 line-clamp-2">{room.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Room form dialog ─────────────────────────────────────────────────────────
function RoomFormDialog({ open, onOpenChange, room, onSuccess }) {
  const isEdit = !!room;
  const [formData, setFormData] = useState({
    name: "", code: "", type: "classroom", capacity: "",
    building: "", floor: "", status: "active", description: "", equipment: [],
  });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (open) {
      if (room) {
        setFormData({
          name: room.name || "",
          code: room.code || "",
          type: room.type || "classroom",
          capacity: room.capacity ?? "",
          building: room.building || "",
          floor: room.floor || "",
          status: room.status || "active",
          description: room.description || "",
          equipment: parseEquipment(room.equipment),
        });
      } else {
        setFormData({ name: "", code: "", type: "classroom", capacity: "", building: "", floor: "", status: "active", description: "", equipment: [] });
      }
    }
  }, [open, room]);

  const toggleEquipment = (val) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(val)
        ? prev.equipment.filter((e) => e !== val)
        : [...prev.equipment, val],
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        capacity: formData.capacity !== "" ? parseInt(formData.capacity) || null : null,
        code: formData.code.trim() || null,
        equipment: JSON.stringify(formData.equipment),
      };
      if (isEdit) {
        await base44.entities.Room.update(room.id, payload);
      } else {
        await base44.entities.Room.create(payload);
      }
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la salle" : "Nouvelle salle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nom de la salle *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ex: Salle de cours A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="B101"
                className="font-mono"
              />
            </div>
          </div>

          {/* Type + capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Capacité (places)</Label>
              <Input
                type="number"
                min={1}
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>

          {/* Building + floor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bâtiment</Label>
              <Input
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                placeholder="Bâtiment A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Étage</Label>
              <Input
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="RDC, 1er, 2ème…"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">✅ Disponible</SelectItem>
                <SelectItem value="maintenance">🔧 En maintenance</SelectItem>
                <SelectItem value="inactive">❌ Hors service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Equipment checkboxes */}
          <div className="space-y-2">
            <Label>Équipements disponibles</Label>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const EqIcon = eq.icon;
                const checked = formData.equipment.includes(eq.value);
                return (
                  <button
                    key={eq.value}
                    type="button"
                    onClick={() => toggleEquipment(eq.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      checked
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <EqIcon className={`w-4 h-4 flex-shrink-0 ${checked ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className="truncate">{eq.label}</span>
                    {checked && <span className="ml-auto text-indigo-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description / Notes</Label>
            <Textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Informations complémentaires…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!formData.name.trim() || saving}>
            {saving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Rooms() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => base44.entities.Room.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Room.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setDeleteTarget(null);
    },
  });

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || r.name?.toLowerCase().includes(q)
        || r.code?.toLowerCase().includes(q)
        || r.building?.toLowerCase().includes(q);
      const matchType = filterType === "all" || r.type === filterType;
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [rooms, search, filterType, filterStatus]);

  const stats = useMemo(() => ({
    total:       rooms.length,
    available:   rooms.filter((r) => r.status === "active").length,
    maintenance: rooms.filter((r) => r.status === "maintenance").length,
    labs:        rooms.filter((r) => r.type === "lab" || r.type === "computer_lab").length,
    totalCapacity: rooms.reduce((sum, r) => sum + (r.capacity || 0), 0),
  }), [rooms]);

  const handleEdit = (room) => { setEditingRoom(room); setFormOpen(true); };
  const handleNew  = () => { setEditingRoom(null); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🏛️</div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Salles & Infrastructures</h1>
              <p className="text-white/80">
                {stats.total} salle{stats.total !== 1 ? "s" : ""} — {stats.totalCapacity} places au total
              </p>
            </div>
          </div>
          <Button
            onClick={handleNew}
            className="bg-white text-teal-700 hover:bg-teal-50 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle salle
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total salles",     value: stats.total,       color: "border-l-slate-400",  icon: DoorOpen,     iconColor: "text-slate-400" },
          { label: "Disponibles",      value: stats.available,   color: "border-l-green-500",  icon: CheckCircle2, iconColor: "text-green-500" },
          { label: "En maintenance",   value: stats.maintenance, color: "border-l-amber-500",  icon: Wrench,       iconColor: "text-amber-500" },
          { label: "Laboratoires",     value: stats.labs,        color: "border-l-indigo-500", icon: FlaskConical, iconColor: "text-indigo-500" },
        ].map((s) => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
              <s.icon className={`w-8 h-8 ${s.iconColor}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Rechercher par nom, code, bâtiment…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">✅ Disponible</SelectItem>
                <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                <SelectItem value="inactive">❌ Hors service</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Room grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-40 bg-slate-100 rounded-xl" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <DoorOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">
              {rooms.length === 0 ? "Aucune salle enregistrée" : "Aucune salle ne correspond à votre recherche"}
            </p>
            {rooms.length === 0 && (
              <p className="text-sm mt-1">Cliquez sur « Nouvelle salle » pour commencer</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {filtered.length} salle{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== rooms.length && ` sur ${rooms.length}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </>
      )}

      {/* Occupancy summary by building */}
      {rooms.length > 0 && (
        <BuildingSummary rooms={rooms} />
      )}

      {/* Create/Edit dialog */}
      <RoomFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingRoom(null); }}
        room={editingRoom}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la salle ?</AlertDialogTitle>
            <AlertDialogDescription>
              La salle <strong>{deleteTarget?.name}</strong>
              {deleteTarget?.code && ` (${deleteTarget.code})`} sera supprimée définitivement.
              Les créneaux horaires liés devront être mis à jour manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Building summary panel ───────────────────────────────────────────────────
function BuildingSummary({ rooms }) {
  const buildings = useMemo(() => {
    const map = {};
    for (const r of rooms) {
      const key = r.building || "Non renseigné";
      if (!map[key]) map[key] = { name: key, rooms: [] };
      map[key].rooms.push(r);
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms]);

  if (buildings.length <= 1 && !buildings[0]?.name.includes("Bâtiment")) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          Récapitulatif par bâtiment
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {buildings.map((b) => {
            const available = b.rooms.filter((r) => r.status === "active").length;
            const capacity = b.rooms.reduce((s, r) => s + (r.capacity || 0), 0);
            return (
              <div key={b.name} className="p-3 rounded-lg border bg-slate-50">
                <p className="font-medium text-slate-800 text-sm">{b.name}</p>
                <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                  <span>{b.rooms.length} salle{b.rooms.length !== 1 ? "s" : ""}</span>
                  <span className="text-green-600 font-medium">{available} dispo.</span>
                  {capacity > 0 && <span>{capacity} places</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.rooms.map((r) => {
                    const sc = STATUS_CFG[r.status] || STATUS_CFG.active;
                    return (
                      <span
                        key={r.id}
                        title={`${r.name} — ${sc.label}`}
                        className={`text-xs px-1.5 py-0.5 rounded border font-mono ${sc.color}`}
                      >
                        {r.code || r.name.slice(0, 4)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
