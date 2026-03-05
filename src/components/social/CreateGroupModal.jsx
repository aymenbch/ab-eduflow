import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Users, Search, CheckSquare, Square } from "lucide-react";

const GROUP_TYPES = [
  { value: "classe_eleves",  label: "🏫 Groupe Classe (Élèves)" },
  { value: "classe_parents", label: "👨‍👩‍👧 Groupe Classe (Parents)" },
  { value: "classe_prof",    label: "🎓 Groupe Classe + Prof" },
  { value: "matiere",        label: "📚 Groupe Matière" },
  { value: "club",           label: "⭐ Club / Activité" },
  { value: "internat",       label: "🏠 Groupe Internat" },
  { value: "transport",      label: "🚌 Groupe Transport" },
  { value: "projet",         label: "📋 Groupe Projet Scrum" },
  { value: "enseignants",    label: "👩‍🏫 Groupe Enseignants" },
  { value: "annonces",       label: "📢 Canal Annonces Officielles" },
];

export default function CreateGroupModal({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const qc = useQueryClient();

  const { data: classes = [] } = useQuery({
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

  // Auto-select members based on type and selected class
  useEffect(() => {
    if (!type) return;
    let autoSelected = [];

    if (type === "classe_eleves" && selectedClass) {
      const classStudents = students.filter(s => s.class_id === selectedClass && s.status === "active");
      autoSelected = classStudents.map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, role: "élève", avatar: s.photo_url }));
    } else if (type === "classe_parents" && selectedClass) {
      const classStudents = students.filter(s => s.class_id === selectedClass && s.status === "active");
      autoSelected = classStudents.filter(s => s.parent_name).map(s => ({
        id: `parent_${s.id}`, name: s.parent_name, role: "parent", avatar: null, email: s.parent_email
      }));
    } else if (type === "classe_prof" && selectedClass) {
      const classStudents = students.filter(s => s.class_id === selectedClass && s.status === "active");
      const classMem = classStudents.map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, role: "élève", avatar: s.photo_url }));
      const teacherMem = teachers.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, role: "enseignant", avatar: t.photo_url }));
      autoSelected = [...classMem, ...teacherMem];
    } else if (type === "enseignants") {
      autoSelected = teachers.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, role: "enseignant", avatar: t.photo_url }));
    }

    setSelectedMembers(autoSelected);
  }, [type, selectedClass, students, teachers]);

  // All candidates for manual selection
  const allCandidates = [
    ...students.filter(s => s.status === "active").map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, role: "élève" })),
    ...teachers.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, role: "enseignant" })),
  ];

  const filteredCandidates = allCandidates.filter(c =>
    c.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const isSelected = (id) => selectedMembers.some(m => m.id === id);

  const toggleMember = (candidate) => {
    if (isSelected(candidate.id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== candidate.id));
    } else {
      setSelectedMembers(prev => [...prev, candidate]);
    }
  };

  const selectAll = () => setSelectedMembers(filteredCandidates);
  const deselectAll = () => setSelectedMembers([]);

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.SocialGroup.create(data),
    onSuccess: () => {
      qc.invalidateQueries(["social-groups"]);
      toast.success("Groupe créé avec " + selectedMembers.length + " membre(s) !");
      handleClose();
    }
  });

  const handleClose = () => {
    setStep(1); setName(""); setType(""); setDescription("");
    setSelectedClass(""); setSelectedMembers([]); setMemberSearch("");
    onClose();
  };

  const handleCreate = () => {
    if (!name || !type) return;
    mutation.mutate({
      name,
      type,
      description,
      class_id: selectedClass || undefined,
      member_ids: selectedMembers.map(m => m.id),
      is_readonly: type === "annonces",
      status: "active",
      school_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    });
  };

  const needsClassSelection = ["classe_eleves", "classe_parents", "classe_prof"].includes(type);
  const roleColors = { élève: "bg-blue-100 text-blue-700", enseignant: "bg-green-100 text-green-700", parent: "bg-purple-100 text-purple-700" };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un groupe</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Type de groupe</Label>
              <Select value={type} onValueChange={v => { setType(v); setSelectedClass(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir le type..." />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsClassSelection && (
              <div>
                <Label>Classe concernée</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une classe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} – {c.level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Nom du groupe</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: 5ème B – Mathématiques" className="mt-1" />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="mt-1" />
            </div>

            {type === "annonces" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                📢 Ce canal sera en lecture seule. Seule la direction pourra publier.
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Annuler</Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => setStep(2)}
                disabled={!name || !type || (needsClassSelection && !selectedClass)}
              >
                Suivant → Membres
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">Membres sélectionnés</span>
                <Badge className="bg-blue-100 text-blue-700 border-0">{selectedMembers.length}</Badge>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Tout sélectionner</button>
                <span className="text-slate-300">|</span>
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">Tout désélectionner</button>
              </div>
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 bg-blue-50 rounded-lg max-h-20 overflow-y-auto">
                {selectedMembers.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-200 rounded-full text-xs">
                    {m.name}
                    <button onClick={() => toggleMember(m)} className="text-slate-400 hover:text-red-500 ml-1">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher un élève, enseignant..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-56 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredCandidates.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-4">Aucun résultat</p>
                )}
                {filteredCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    onClick={() => toggleMember(candidate)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected(candidate.id) ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}
                  >
                    <Checkbox checked={isSelected(candidate.id)} onCheckedChange={() => toggleMember(candidate)} />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {candidate.name.charAt(0)}
                    </div>
                    <span className="text-sm flex-1">{candidate.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[candidate.role] || "bg-slate-100 text-slate-600"}`}>
                      {candidate.role}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Retour</Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleCreate}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Création..." : `Créer (${selectedMembers.length} membre${selectedMembers.length !== 1 ? "s" : ""})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}