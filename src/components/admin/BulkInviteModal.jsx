import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, CheckCircle, AlertTriangle, Users, GraduationCap, BookOpen, Send } from "lucide-react";

/**
 * Invite automatiquement des utilisateurs pour chaque Élève, Enseignant ou Parent
 * en créant un UserProfile + envoyant une invitation email.
 * Convention email :
 *  - Élève    : parent_email (email du parent utilisé comme contact élève)
 *  - Enseignant: teacher.email
 *  - Parent   : parent_email
 */
export default function BulkInviteModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("students");
  const [selected, setSelected] = useState({});
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]); // [{name, email, status}]

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.filter({ status: "active" }) });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: profiles = [] } = useQuery({ queryKey: ["user_profiles"], queryFn: () => base44.entities.UserProfile.list() });

  const existingEmails = useMemo(() => new Set(profiles.map(p => p.email?.toLowerCase())), [profiles]);

  // Build candidate lists
  const studentCandidates = useMemo(() =>
    students.filter(s => s.parent_email && !existingEmails.has(s.parent_email.toLowerCase()))
      .map(s => ({ id: `s_${s.id}`, name: `${s.first_name} ${s.last_name}`, email: s.parent_email, role: "eleve", entity: s })),
    [students, existingEmails]
  );

  const parentCandidates = useMemo(() => {
    const seen = new Set();
    return students
      .filter(s => s.parent_email && s.parent_name && !existingEmails.has(s.parent_email.toLowerCase()))
      .filter(s => { const key = s.parent_email.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
      .map(s => ({ id: `p_${s.id}`, name: s.parent_name, email: s.parent_email, role: "parent", entity: s }));
  }, [students, existingEmails]);

  const teacherCandidates = useMemo(() =>
    teachers.filter(t => t.email && !existingEmails.has(t.email.toLowerCase()))
      .map(t => ({ id: `t_${t.id}`, name: `${t.first_name} ${t.last_name}`, email: t.email, role: "enseignant", entity: t })),
    [teachers, existingEmails]
  );

  const candidatesByTab = { students: studentCandidates, parents: parentCandidates, teachers: teacherCandidates };
  const currentCandidates = candidatesByTab[tab] || [];

  const toggleAll = () => {
    const allSelected = currentCandidates.every(c => selected[c.id]);
    const next = { ...selected };
    currentCandidates.forEach(c => { next[c.id] = !allSelected; });
    setSelected(next);
  };

  const toggleOne = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const selectedCandidates = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => Object.values(candidatesByTab).flat().find(c => c.id === id))
    .filter(Boolean);

  const handleInvite = async () => {
    setRunning(true);
    setResults([]);
    const newResults = [];
    for (const c of selectedCandidates) {
      try {
        // Create UserProfile
        await base44.entities.UserProfile.create({
          email: c.email,
          full_name: c.name,
          edugest_role: c.role,
          status: "invited",
          invited_at: new Date().toISOString().split("T")[0],
        });
        // Send platform invitation
        await base44.users.inviteUser(c.email, "user");
        newResults.push({ name: c.name, email: c.email, status: "success" });
      } catch (err) {
        newResults.push({ name: c.name, email: c.email, status: "error", error: err.message });
      }
      setResults([...newResults]);
    }
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ["user_profiles"] });
    // Clear selection
    setSelected({});
  };

  const done = results.length > 0 && !running;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Invitation automatique en masse
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-500 -mt-2">
          Sélectionnez les membres à inviter. Chaque invitation crée un compte et envoie un email.
        </p>

        {/* Results panel */}
        {results.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto border rounded-xl p-3 bg-slate-50">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.status === "success"
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                <span className="font-medium">{r.name}</span>
                <span className="text-slate-400">{r.email}</span>
                {r.status === "error" && <span className="text-red-500">{r.error}</span>}
              </div>
            ))}
          </div>
        )}

        {!done && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="students" className="gap-1.5 text-xs">
                <GraduationCap className="w-3.5 h-3.5" />
                Élèves ({studentCandidates.length})
              </TabsTrigger>
              <TabsTrigger value="parents" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Parents ({parentCandidates.length})
              </TabsTrigger>
              <TabsTrigger value="teachers" className="gap-1.5 text-xs">
                <BookOpen className="w-3.5 h-3.5" />
                Enseignants ({teacherCandidates.length})
              </TabsTrigger>
            </TabsList>

            {["students", "parents", "teachers"].map(t => (
              <TabsContent key={t} value={t} className="mt-3">
                {candidatesByTab[t].length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    Tous les membres ont déjà un compte.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                        {candidatesByTab[t].every(c => selected[c.id]) ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                      <span className="text-xs text-slate-400">
                        {candidatesByTab[t].filter(c => selected[c.id]).length} sélectionné(s)
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {candidatesByTab[t].map(c => (
                        <div
                          key={c.id}
                          onClick={() => toggleOne(c.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selected[c.id] ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <Checkbox checked={!!selected[c.id]} onCheckedChange={() => toggleOne(c.id)} onClick={e => e.stopPropagation()} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                            <p className="text-xs text-slate-400 truncate">{c.email}</p>
                          </div>
                          <Badge className="text-[10px] capitalize bg-slate-100 text-slate-600 border border-slate-200">{c.role}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-xs text-slate-500">
            {selectedCandidates.length} invitation(s) à envoyer
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
            {!done && (
              <Button
                onClick={handleInvite}
                disabled={selectedCandidates.length === 0 || running}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Inviter ({selectedCandidates.length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}