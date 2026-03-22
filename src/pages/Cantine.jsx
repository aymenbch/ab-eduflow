import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  UtensilsCrossed, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  Check, X, Clock, Loader2, Users, BookOpen, ThumbsUp, Star, AlertTriangle,
  Calendar, ClipboardList, Lightbulb, Eye, EyeOff, CheckCircle2, XCircle,
  ChefHat, Soup, Apple, Coffee, Save
} from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── API ────────────────────────────────────────────────────────────────────────
const API = "http://localhost:3001/api/cantine";

function apiHeaders() {
  const s = getSession();
  const h = { "Content-Type": "application/json" };
  if (s?.token) h["X-Session-Token"] = s.token;
  if (s?.id)    h["X-User-Id"] = s.id;
  return h;
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(`${API}${url}`, { headers: apiHeaders(), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
const WEEKDAY_LABELS = { lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi", vendredi: "Vendredi" };

const DISH_TYPES = [
  { value: "entree",  label: "Entrée",   icon: Soup },
  { value: "plat",    label: "Plat",     icon: ChefHat },
  { value: "dessert", label: "Dessert",  icon: Apple },
  { value: "boisson", label: "Boisson",  icon: Coffee },
  { value: "autre",   label: "Autre",    icon: Star },
];

const REGIMES = [
  { value: "complet",      label: "Complet (tous les jours)" },
  { value: "personnalise", label: "Personnalisé (jours choisis)" },
];

const SUGGESTION_STATUS = {
  pending:  { label: "En attente",  color: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "Acceptée",    color: "bg-blue-100 text-blue-800" },
  done:     { label: "Réalisée !",  color: "bg-green-100 text-green-800" },
  rejected: { label: "Refusée",     color: "bg-red-100 text-red-800" },
};

const RESERVATION_STATUS = {
  pending:   { label: "En attente",  color: "bg-yellow-100 text-yellow-800",  icon: Clock },
  approved:  { label: "Approuvée",   color: "bg-green-100 text-green-800",   icon: CheckCircle2 },
  rejected:  { label: "Refusée",     color: "bg-red-100 text-red-800",       icon: XCircle },
  cancelled: { label: "Annulée",     color: "bg-slate-100 text-slate-600",   icon: X },
};

// ── Week helpers ───────────────────────────────────────────────────────────────
function getWeekDates(weekStart) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}
function isoDate(d) { return format(d, "yyyy-MM-dd"); }

// ── Role detection ─────────────────────────────────────────────────────────────
function useRole() {
  const session = getSession();
  const role = session?.role || localStorage.getItem("edugest_role") || "";
  const isAdmin = ["directeur_general","directeur_primaire","directeur_college","directeur_lycee","cpe","secretaire","admin_systeme"].includes(role);
  const isParent = role === "parent";
  const isEleve  = role === "eleve";
  const isEnseignant = role === "enseignant";
  return { role, isAdmin, isParent, isEleve, isEnseignant, session };
}

// ── MenuDayCard ────────────────────────────────────────────────────────────────
function MenuDayCard({ date, menu, isAdmin, onEdit, onPublish, onDelete }) {
  const dayLabel = format(date, "EEEE", { locale: fr });
  const dateLabel = format(date, "d MMM", { locale: fr });
  const isToday = isoDate(date) === isoDate(new Date());
  const isPast  = date < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className={cn(
      "flex flex-col rounded-2xl border-2 overflow-hidden transition-all",
      isToday  ? "border-orange-400 shadow-md shadow-orange-100" : "border-slate-100",
      isPast   ? "opacity-60" : "",
      !menu    ? "bg-slate-50 border-dashed" : "bg-white",
    )}>
      {/* Day header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isToday ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"
      )}>
        <div>
          <p className="font-bold text-sm capitalize">{dayLabel}</p>
          <p className={cn("text-xs", isToday ? "text-orange-100" : "text-slate-500")}>{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          {menu && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
              menu.published
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            )}>
              {menu.published ? "Publié" : "Brouillon"}
            </span>
          )}
          {isAdmin && (
            <div className="flex gap-1 ml-1">
              {menu ? (
                <>
                  <button onClick={() => onEdit(menu, date)}
                    className={cn("p-1 rounded hover:bg-white/30 transition-colors",
                      isToday ? "text-white" : "text-slate-500")}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onPublish(menu)}
                    className={cn("p-1 rounded hover:bg-white/30 transition-colors",
                      isToday ? "text-white" : "text-slate-500")}>
                    {menu.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => onDelete(menu)}
                    className={cn("p-1 rounded hover:bg-red-100 transition-colors text-red-400")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button onClick={() => onEdit(null, date)}
                  className={cn("p-1 rounded hover:bg-white/30 transition-colors",
                    isToday ? "text-white" : "text-slate-500")}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Menu content */}
      <div className="p-4 flex-1">
        {menu ? (
          <div className="space-y-2.5">
            {menu.starter && (
              <div className="flex items-start gap-2">
                <Soup className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Entrée</p>
                  <p className="text-sm font-medium text-slate-800">{menu.starter}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <ChefHat className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Plat principal</p>
                <p className="text-sm font-bold text-slate-900">{menu.main_course}</p>
              </div>
            </div>
            {menu.garnish && (
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs">🥗</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Accompagnement</p>
                  <p className="text-sm text-slate-700">{menu.garnish}</p>
                </div>
              </div>
            )}
            {menu.dessert && (
              <div className="flex items-start gap-2">
                <Apple className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Dessert</p>
                  <p className="text-sm text-slate-700">{menu.dessert}{menu.dessert2 ? ` / ${menu.dessert2}` : ""}</p>
                </div>
              </div>
            )}
            {menu.notes && (
              <p className="text-xs text-slate-400 italic border-t pt-2 mt-2">{menu.notes}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            {isAdmin ? (
              <>
                <Plus className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Cliquez + pour<br />ajouter le menu</p>
              </>
            ) : (
              <>
                <UtensilsCrossed className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Menu non disponible</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MenuFormModal ──────────────────────────────────────────────────────────────
function MenuFormModal({ open, onClose, onSave, editMenu, editDate }) {
  const isEdit = !!editMenu;
  const defaultDate = editDate ? isoDate(editDate) : "";
  const [form, setForm] = useState(editMenu || {
    date: defaultDate,
    meal_period: "midi",
    starter: "", main_course: "", garnish: "", dessert: "", dessert2: "", notes: "",
    published: false,
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editMenu) {
      setForm({ ...editMenu, published: !!editMenu.published });
    } else {
      setForm({
        date: editDate ? isoDate(editDate) : "",
        meal_period: "midi",
        starter: "", main_course: "", garnish: "", dessert: "", dessert2: "", notes: "",
        published: false,
      });
    }
  }, [editMenu, editDate, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-500" />
            {isEdit ? "Modifier le menu" : "Ajouter un menu"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={form.meal_period} onValueChange={v => set("meal_period", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="midi">Déjeuner (midi)</SelectItem>
                  <SelectItem value="soir">Dîner (soir)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Soup className="w-4 h-4 text-amber-400" /> Entrée</Label>
            <Input value={form.starter} onChange={e => set("starter", e.target.value)} placeholder="Salade de crudités, soupe..." />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><ChefHat className="w-4 h-4 text-orange-500" /> Plat principal *</Label>
            <Input value={form.main_course} onChange={e => set("main_course", e.target.value)}
              placeholder="Poulet rôti, bœuf bourguignon..." required />
          </div>

          <div className="space-y-1.5">
            <Label>Accompagnement / Garniture</Label>
            <Input value={form.garnish} onChange={e => set("garnish", e.target.value)}
              placeholder="Frites, riz, légumes vapeur..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Apple className="w-4 h-4 text-rose-400" /> Dessert 1</Label>
              <Input value={form.dessert} onChange={e => set("dessert", e.target.value)} placeholder="Fruit, yaourt..." />
            </div>
            <div className="space-y-1.5">
              <Label>Dessert 2 (optionnel)</Label>
              <Input value={form.dessert2} onChange={e => set("dessert2", e.target.value)} placeholder="Gâteau..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Allergènes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Contient gluten, sans porc, menu halal..." rows={2} />
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-green-800">Publier le menu</p>
              <p className="text-xs text-green-600">Les parents et élèves pourront le consulter</p>
            </div>
            <Switch checked={!!form.published} onCheckedChange={v => set("published", v)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {isEdit ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Week Menu View ────────────────────────────────────────────────────────────
function WeekMenuView({ isAdmin, onlyPublished = false }) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editMenu, setEditMenu] = useState(null);
  const [editDate, setEditDate] = useState(null);

  const from = isoDate(weekStart);
  const to   = isoDate(addDays(weekStart, 4));

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["cantine_menus", from, to, onlyPublished],
    queryFn: () => apiFetch(`/menus?from=${from}&to=${to}${onlyPublished ? "&published=1" : ""}`),
    refetchOnWindowFocus: true,
  });

  const menuByDate = useMemo(() => {
    const m = {};
    menus.forEach(menu => { m[menu.date] = menu; });
    return m;
  }, [menus]);

  const saveMut = useMutation({
    mutationFn: (form) => {
      if (form.id) {
        return apiFetch(`/menus/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      }
      return apiFetch("/menus", { method: "POST", body: JSON.stringify(form) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cantine_menus"] }),
  });

  const togglePublish = useMutation({
    mutationFn: (menu) => apiFetch(`/menus/${menu.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...menu, published: !menu.published }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cantine_menus"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (menu) => apiFetch(`/menus/${menu.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cantine_menus"] }),
  });

  const weekDates = getWeekDates(weekStart);
  const weekLabel = `${format(weekStart, "d MMM", { locale: fr })} – ${format(addDays(weekStart, 4), "d MMM yyyy", { locale: fr })}`;

  return (
    <div className="space-y-4">
      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold text-slate-800">Semaine du {weekLabel}</p>
          <button className="text-xs text-indigo-600 hover:underline" onClick={() =>
            setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
          }>
            Semaine en cours
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Publish week button (admin only) */}
      {isAdmin && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            onClick={async () => {
              const unpublished = menus.filter(m => !m.published);
              for (const m of unpublished) {
                await saveMut.mutateAsync({ ...m, published: true });
              }
            }}
            disabled={menus.every(m => m.published) || saveMut.isPending}
          >
            <Eye className="w-3.5 h-3.5" /> Publier tous les menus de la semaine
          </Button>
        </div>
      )}

      {/* Day cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {weekDates.map(date => (
            <MenuDayCard
              key={isoDate(date)}
              date={date}
              menu={menuByDate[isoDate(date)] || null}
              isAdmin={isAdmin}
              onEdit={(menu, d) => { setEditMenu(menu); setEditDate(d); setFormOpen(true); }}
              onPublish={(menu) => togglePublish.mutate(menu)}
              onDelete={(menu) => {
                if (window.confirm("Supprimer ce menu ?")) deleteMut.mutate(menu);
              }}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <MenuFormModal
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditMenu(null); setEditDate(null); }}
          onSave={(form) => saveMut.mutateAsync(form)}
          editMenu={editMenu}
          editDate={editDate}
        />
      )}
    </div>
  );
}

// ── Inscriptions Tab ───────────────────────────────────────────────────────────
function InscriptionsTab({ students }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", regime: "complet", days_json: '["lundi","mardi","mercredi","jeudi","vendredi"]', start_date: "", end_date: "", notes: "" });
  const [selectedDays, setSelectedDays] = useState([...WEEKDAYS]);
  const [saving, setSaving] = useState(false);

  const { data: inscriptions = [], isLoading } = useQuery({
    queryKey: ["cantine_inscriptions"],
    queryFn: () => apiFetch("/inscriptions?active=1"),
  });

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const inscribedIds = new Set(inscriptions.map(i => i.student_id));

  const createMut = useMutation({
    mutationFn: (data) => apiFetch("/inscriptions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cantine_inscriptions"] }); qc.invalidateQueries({ queryKey: ["cantine_stats"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiFetch(`/inscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cantine_inscriptions"] }); qc.invalidateQueries({ queryKey: ["cantine_stats"] }); },
  });

  const toggleDay = (day) => {
    setSelectedDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day]);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const days = form.regime === "complet" ? WEEKDAYS : selectedDays;
    await createMut.mutateAsync({ ...form, days_json: JSON.stringify(days) });
    setSaving(false);
    setFormOpen(false);
    setForm({ student_id: "", regime: "complet", days_json: "", start_date: "", end_date: "", notes: "" });
    setSelectedDays([...WEEKDAYS]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-slate-800">{inscriptions.length}</span> élève(s) inscrit(s) à la cantine
        </p>
        <Button onClick={() => setFormOpen(true)} className="gap-2 bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Inscrire un élève
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
      ) : inscriptions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun élève inscrit</p>
          <p className="text-sm">Cliquez sur "Inscrire un élève" pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inscriptions.map(ins => {
            const student = studentMap[ins.student_id];
            let days = [];
            try { days = JSON.parse(ins.days_json); } catch {}
            return (
              <div key={ins.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                    {student?.first_name?.[0]}{student?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">{student ? `${student.first_name} ${student.last_name}` : ins.student_id}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {days.map(d => (
                        <span key={d} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ins.end_date && (
                    <span className="text-xs text-muted-foreground">
                      jusqu'au {format(parseISO(ins.end_date), "d MMM yyyy", { locale: fr })}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => { if (window.confirm(`Désinscrire ${student?.first_name} ${student?.last_name} ?`)) deleteMut.mutate(ins.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inscription modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" /> Inscrire un élève à la cantine
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Élève *</Label>
              <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))} required>
                <SelectTrigger><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
                <SelectContent>
                  {students.filter(s => !inscribedIds.has(s.id)).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Régime</Label>
              <Select value={form.regime} onValueChange={v => setForm(f => ({ ...f, regime: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.regime === "personnalise" && (
              <div className="space-y-1.5">
                <Label>Jours de présence</Label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                        selectedDays.includes(d)
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
                      )}>
                      {WEEKDAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Allergies, régime particulier..." rows={2} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={saving || !form.student_id}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Inscrire
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reservations Tab (Admin) ───────────────────────────────────────────────────
function ReservationsAdminTab({ students }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["cantine_reservations", statusFilter],
    queryFn: () => apiFetch(`/reservations${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, admin_note }) =>
      apiFetch(`/reservations/${id}`, { method: "PUT", body: JSON.stringify({ status, admin_note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cantine_reservations"] }); qc.invalidateQueries({ queryKey: ["cantine_stats"] }); },
  });

  const StatusIcon = ({ status }) => {
    const cfg = RESERVATION_STATUS[status] || RESERVATION_STATUS.pending;
    const Icon = cfg.icon;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "", label: "Toutes" },
          { value: "pending", label: "En attente" },
          { value: "approved", label: "Approuvées" },
          { value: "rejected", label: "Refusées" },
        ].map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              statusFilter === f.value
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune réservation {statusFilter ? `"${RESERVATION_STATUS[statusFilter]?.label}"` : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map(r => {
            const student = studentMap[r.student_id];
            const cfg = RESERVATION_STATUS[r.status] || RESERVATION_STATUS.pending;
            return (
              <div key={r.id} className="p-4 bg-white border rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                      {student?.first_name?.[0]}{student?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium">{student ? `${student.first_name} ${student.last_name}` : r.student_id}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {format(parseISO(r.menu_date), "EEEE d MMMM yyyy", { locale: fr })}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">({r.meal_period})</span>
                      </div>
                      {r.parent_note && (
                        <p className="text-xs text-slate-500 italic mt-0.5">« {r.parent_note} »</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", cfg.color)}>
                      <StatusIcon status={r.status} /> {cfg.label}
                    </span>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 h-8"
                          onClick={() => updateMut.mutate({ id: r.id, status: "approved" })}>
                          <Check className="w-3.5 h-3.5" /> Approuver
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                          onClick={() => updateMut.mutate({ id: r.id, status: "rejected" })}>
                          <X className="w-3.5 h-3.5" /> Refuser
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Suggestions Tab (Admin view) ───────────────────────────────────────────────
function SuggestionsAdminTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["cantine_suggestions", statusFilter],
    queryFn: () => apiFetch(`/suggestions${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, admin_note }) =>
      apiFetch(`/suggestions/${id}`, { method: "PUT", body: JSON.stringify({ status, admin_note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cantine_suggestions"] }); qc.invalidateQueries({ queryKey: ["cantine_stats"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiFetch(`/suggestions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cantine_suggestions"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "", label: "Toutes" },
          { value: "pending", label: "En attente" },
          { value: "accepted", label: "Acceptées" },
          { value: "done", label: "Réalisées" },
          { value: "rejected", label: "Refusées" },
        ].map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              statusFilter === f.value
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl text-slate-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune suggestion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => {
            const dtCfg = DISH_TYPES.find(d => d.value === s.dish_type) || DISH_TYPES[1];
            const DishIcon = dtCfg.icon;
            const statusCfg = SUGGESTION_STATUS[s.status] || SUGGESTION_STATUS.pending;
            return (
              <div key={s.id} className="p-4 bg-white border rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white">
                      <DishIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{s.dish_name}</p>
                        <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{dtCfg.label}</span>
                      </div>
                      {s.description && <p className="text-sm text-slate-600 mt-0.5">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> {s.votes} vote(s)
                        </span>
                        {s.student_name && <span className="text-xs text-muted-foreground">par {s.student_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 gap-1"
                          onClick={() => updateMut.mutate({ id: s.id, status: "accepted" })}>
                          <Check className="w-3.5 h-3.5" /> Accepter
                        </Button>
                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 gap-1"
                          onClick={() => updateMut.mutate({ id: s.id, status: "done" })}>
                          <Star className="w-3.5 h-3.5" /> Réalisée
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-red-500 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => updateMut.mutate({ id: s.id, status: "rejected" })}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-slate-400 hover:text-red-500 px-2"
                      onClick={() => { if (window.confirm("Supprimer ?")) deleteMut.mutate(s.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Parent View ────────────────────────────────────────────────────────────────
function ParentView({ session }) {
  const qc = useQueryClient();
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveForm, setReserveForm] = useState({ menu_date: "", meal_period: "midi", parent_note: "" });
  const [saving, setSaving] = useState(false);
  const [reserveError, setReserveError] = useState("");

  // Get student linked to this parent session
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  // Try to find linked student (member_id is the parent's id → look for students with this parent)
  // In the system, parents may be linked via parent_id on student or just access all students
  const { data: myReservations = [] } = useQuery({
    queryKey: ["cantine_my_reservations"],
    queryFn: () => apiFetch("/reservations"),
    refetchInterval: 30000,
  });

  async function handleReserve(e) {
    e.preventDefault();
    setReserveError("");
    if (students.length === 0) return;
    setSaving(true);
    try {
      await apiFetch("/reservations", {
        method: "POST",
        body: JSON.stringify({
          ...reserveForm,
          student_id: students[0]?.id,
          requested_by: `Parent (${session?.login || ""})`,
        }),
      });
      qc.invalidateQueries({ queryKey: ["cantine_my_reservations"] });
      setReserveOpen(false);
      setReserveForm({ menu_date: "", meal_period: "midi", parent_note: "" });
    } catch (e) {
      setReserveError(e.message);
    }
    setSaving(false);
  }

  const minDate = format(addDays(new Date(), 2), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-orange-500" /> Menu de la cantine
          </h2>
          <p className="text-sm text-slate-500">Consultez les repas de la semaine</p>
        </div>
        <Button onClick={() => setReserveOpen(true)} className="gap-2 bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Réserver un repas
        </Button>
      </div>

      {/* Week menu (published only) */}
      <WeekMenuView isAdmin={false} onlyPublished={true} />

      {/* My reservations */}
      {myReservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-500" /> Mes réservations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myReservations.slice(0, 5).map(r => {
              const cfg = RESERVATION_STATUS[r.status] || RESERVATION_STATUS.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                  <span>{format(parseISO(r.menu_date), "EEEE d MMMM yyyy", { locale: fr })} ({r.meal_period})</span>
                  <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", cfg.color)}>
                    <StatusIcon className="w-3 h-3" /> {cfg.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Reservation modal */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" /> Réserver un repas à la cantine
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReserve} className="space-y-4 mt-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>La réservation doit être effectuée <strong>au minimum 48h à l'avance</strong>.</span>
            </div>

            <div className="space-y-1.5">
              <Label>Date du repas *</Label>
              <Input type="date" min={minDate} value={reserveForm.menu_date}
                onChange={e => setReserveForm(f => ({ ...f, menu_date: e.target.value }))} required />
            </div>

            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={reserveForm.meal_period} onValueChange={v => setReserveForm(f => ({ ...f, meal_period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="midi">Déjeuner (midi)</SelectItem>
                  <SelectItem value="soir">Dîner (soir)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Message (optionnel)</Label>
              <Textarea value={reserveForm.parent_note} rows={2}
                onChange={e => setReserveForm(f => ({ ...f, parent_note: e.target.value }))}
                placeholder="Allergie particulière, régime spécial..." />
            </div>

            {reserveError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {reserveError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReserveOpen(false)}>Annuler</Button>
              <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600"
                disabled={saving || !reserveForm.menu_date}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Envoyer la demande
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Student View ───────────────────────────────────────────────────────────────
function EleveView({ session }) {
  const qc = useQueryClient();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [form, setForm] = useState({ dish_name: "", dish_type: "plat", description: "" });
  const [saving, setSaving] = useState(false);
  const [votedIds, setVotedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cantine_votes") || "[]"); } catch { return []; }
  });

  const { data: suggestions = [], isLoading: loadingSug } = useQuery({
    queryKey: ["cantine_suggestions"],
    queryFn: () => apiFetch("/suggestions"),
    refetchInterval: 30000,
  });

  const voteMut = useMutation({
    mutationFn: (id) => apiFetch(`/suggestions/${id}/vote`, { method: "POST" }),
    onSuccess: (_, id) => {
      const newVotes = [...votedIds, id];
      setVotedIds(newVotes);
      localStorage.setItem("cantine_votes", JSON.stringify(newVotes));
      qc.invalidateQueries({ queryKey: ["cantine_suggestions"] });
    },
  });

  async function handleSuggest(e) {
    e.preventDefault();
    setSaving(true);
    await apiFetch("/suggestions", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        student_id: session?.member_id || session?.id || "unknown",
        student_name: session?.full_name || session?.login || "Élève",
      }),
    });
    qc.invalidateQueries({ queryKey: ["cantine_suggestions"] });
    setSaving(false);
    setSuggestOpen(false);
    setForm({ dish_name: "", dish_type: "plat", description: "" });
  }

  return (
    <div className="space-y-6">
      {/* Menu */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <UtensilsCrossed className="w-5 h-5 text-orange-500" /> Menu de la semaine
        </h2>
        <WeekMenuView isAdmin={false} onlyPublished={true} />
      </div>

      {/* Suggestions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" /> Vos idées de plats
            </h2>
            <p className="text-sm text-slate-500">Proposez un plat et votez pour vos favoris</p>
          </div>
          <Button onClick={() => setSuggestOpen(true)} className="gap-2 bg-yellow-500 hover:bg-yellow-600">
            <Plus className="w-4 h-4" /> Proposer un plat
          </Button>
        </div>

        {loadingSug ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-yellow-400" /></div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-2xl text-slate-400">
            <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Soyez le premier à faire une suggestion !</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map(s => {
              const dtCfg = DISH_TYPES.find(d => d.value === s.dish_type) || DISH_TYPES[1];
              const DishIcon = dtCfg.icon;
              const statusCfg = SUGGESTION_STATUS[s.status] || SUGGESTION_STATUS.pending;
              const hasVoted = votedIds.includes(s.id);
              return (
                <div key={s.id} className={cn(
                  "p-4 rounded-2xl border-2 flex items-start gap-3 transition-all",
                  s.status === "done" ? "border-green-200 bg-green-50" :
                  s.status === "accepted" ? "border-blue-200 bg-blue-50" :
                  "border-slate-100 bg-white hover:shadow-sm"
                )}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                    <DishIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900 truncate">{s.dish_name}</p>
                      <Badge className={cn("text-xs flex-shrink-0", statusCfg.color)}>{statusCfg.label}</Badge>
                    </div>
                    {s.description && <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">{dtCfg.label}</span>
                      {s.student_name && <span className="text-xs text-muted-foreground">— {s.student_name}</span>}
                      <button
                        onClick={() => !hasVoted && voteMut.mutate(s.id)}
                        disabled={hasVoted}
                        className={cn(
                          "ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                          hasVoted
                            ? "bg-indigo-100 text-indigo-700 cursor-default"
                            : "bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer"
                        )}
                      >
                        <ThumbsUp className="w-3 h-3" /> {s.votes}
                        {hasVoted ? " (voté)" : ""}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggest modal */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" /> Proposer un plat
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSuggest} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nom du plat *</Label>
              <Input value={form.dish_name} onChange={e => setForm(f => ({ ...f, dish_name: e.target.value }))}
                placeholder="Pizza Margherita, Tajine de poulet..." required />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <div className="grid grid-cols-3 gap-2">
                {DISH_TYPES.map(dt => {
                  const DtIcon = dt.icon;
                  return (
                    <button key={dt.value} type="button" onClick={() => setForm(f => ({ ...f, dish_type: dt.value }))}
                      className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-colors",
                        form.dish_type === dt.value
                          ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                          : "border-slate-200 hover:border-yellow-300"
                      )}>
                      <DtIcon className="w-5 h-5" />
                      {dt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez ce que vous aimez dans ce plat..." rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSuggestOpen(false)}>Annuler</Button>
              <Button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-600" disabled={saving || !form.dish_name}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Envoyer ma suggestion
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Admin Dashboard Stats ──────────────────────────────────────────────────────
function StatsBar() {
  const { data: stats = {} } = useQuery({
    queryKey: ["cantine_stats"],
    queryFn: () => apiFetch("/stats"),
    refetchInterval: 60000,
  });

  const items = [
    { label: "Élèves inscrits", value: stats.inscriptions ?? "–", icon: Users, color: "text-orange-600 bg-orange-100" },
    { label: "Réservations en attente", value: stats.pendingReservations ?? "–", icon: Clock, color: "text-yellow-600 bg-yellow-100" },
    { label: "Repas aujourd'hui", value: stats.todayMeals ?? "–", icon: UtensilsCrossed, color: "text-green-600 bg-green-100" },
    { label: "Suggestions à traiter", value: stats.pendingSuggestions ?? "–", icon: Lightbulb, color: "text-purple-600 bg-purple-100" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", item.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Cantine() {
  const { isAdmin, isParent, isEleve, isEnseignant, session } = useRole();

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
    enabled: isAdmin,
  });

  // ── Parent view ──────────────────────────────────────────────────────────────
  if (isParent) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🍽️</div>
            <div>
              <h1 className="text-2xl font-bold">Cantine Scolaire</h1>
              <p className="text-white/80 text-sm">Consultez les menus et réservez des repas pour votre enfant</p>
            </div>
          </div>
        </div>
        <ParentView session={session} />
      </div>
    );
  }

  // ── Élève view ───────────────────────────────────────────────────────────────
  if (isEleve) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🍕</div>
            <div>
              <h1 className="text-2xl font-bold">Ma Cantine</h1>
              <p className="text-white/80 text-sm">Découvrez les menus et proposez vos plats préférés !</p>
            </div>
          </div>
        </div>
        <EleveView session={session} />
      </div>
    );
  }

  // ── Teacher view (read-only menu) ────────────────────────────────────────────
  if (isEnseignant) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🍽️</div>
            <div>
              <h1 className="text-2xl font-bold">Cantine Scolaire</h1>
              <p className="text-white/80 text-sm">Menu de la semaine</p>
            </div>
          </div>
        </div>
        <WeekMenuView isAdmin={false} onlyPublished={true} />
      </div>
    );
  }

  // ── Admin view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🍽️</div>
            <div>
              <h1 className="text-2xl font-bold">Gestion de la Cantine</h1>
              <p className="text-white/80 text-sm">Menus, inscriptions, réservations et suggestions des élèves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Tabs */}
      <Tabs defaultValue="menus">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menus" className="gap-1.5">
            <ChefHat className="w-4 h-4" /> Menus
          </TabsTrigger>
          <TabsTrigger value="inscriptions" className="gap-1.5">
            <Users className="w-4 h-4" /> Inscriptions
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Réservations
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5">
            <Lightbulb className="w-4 h-4" /> Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menus" className="mt-6">
          <WeekMenuView isAdmin={true} onlyPublished={false} />
        </TabsContent>

        <TabsContent value="inscriptions" className="mt-6">
          <InscriptionsTab students={students} />
        </TabsContent>

        <TabsContent value="reservations" className="mt-6">
          <ReservationsAdminTab students={students} />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
