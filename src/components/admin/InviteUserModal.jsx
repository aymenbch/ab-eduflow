import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { ROLES, PAGE_LABELS } from "@/components/roles/roles";
import { Badge } from "@/components/ui/badge";

const ALL_PAGES = [
  "Dashboard", "Students", "Teachers", "Classes", "Subjects", "Staff",
  "Schedule", "Exams", "Homework", "Resources", "Attendance", "Sanctions",
  "Messages", "Events", "Finance"
];

export default function InviteUserModal({ open, onClose, onSaved, profile }) {
  const isEdit = !!profile;
  const [form, setForm] = useState({
    email: profile?.email || "",
    full_name: profile?.full_name || "",
    edugest_role: profile?.edugest_role || "",
    use_custom_pages: profile?.use_custom_pages || false,
    custom_pages: profile?.custom_pages || [],
    notes: profile?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const selectedRolePages = form.edugest_role ? (ROLES[form.edugest_role]?.pages || []) : [];
  const effectivePages = form.use_custom_pages ? form.custom_pages : selectedRolePages;

  const togglePage = (page) => {
    setForm(f => ({
      ...f,
      custom_pages: f.custom_pages.includes(page)
        ? f.custom_pages.filter(p => p !== page)
        : [...f.custom_pages, page]
    }));
  };

  const handleRoleChange = (role) => {
    setForm(f => ({
      ...f,
      edugest_role: role,
      custom_pages: ROLES[role]?.pages || [],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setInviteError("");
    try {
      const data = {
        ...form,
        status: isEdit ? (profile.status || "invited") : "invited",
        invited_at: isEdit ? profile.invited_at : new Date().toISOString().split("T")[0],
      };
      if (isEdit) {
        await base44.entities.UserProfile.update(profile.id, data);
      } else {
        await base44.entities.UserProfile.create(data);
        // Send invite
        try {
          await base44.users.inviteUser(form.email, "user");
        } catch (inviteErr) {
          // Invitation may already exist, continue
        }
      }
      onSaved();
    } catch (err) {
      setInviteError(err.message || "Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'utilisateur" : "Inviter un utilisateur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="utilisateur@ecole.fr"
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Nom complet</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Rôle EduGest *</Label>
            <Select value={form.edugest_role} onValueChange={handleRoleChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([key, r]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span>{r.icon}</span>
                      <span>{r.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.edugest_role && (
              <p className="text-xs text-slate-500 mt-1">{ROLES[form.edugest_role]?.description}</p>
            )}
          </div>

          {/* Module access */}
          <div className="space-y-3 border rounded-xl p-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Accès aux modules</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="custom_pages"
                  checked={form.use_custom_pages}
                  onCheckedChange={v => setForm({ ...form, use_custom_pages: !!v })}
                />
                <label htmlFor="custom_pages" className="text-xs text-slate-600 cursor-pointer">
                  Personnaliser les accès
                </label>
              </div>
            </div>

            {!form.use_custom_pages && form.edugest_role ? (
              <div className="flex flex-wrap gap-2">
                {selectedRolePages.map(p => (
                  <Badge key={p} className="bg-blue-100 text-blue-800 text-xs">{PAGE_LABELS[p] || p}</Badge>
                ))}
              </div>
            ) : form.use_custom_pages ? (
              <div className="grid grid-cols-3 gap-2">
                {ALL_PAGES.map(page => (
                  <div key={page} className="flex items-center gap-2">
                    <Checkbox
                      id={`page-${page}`}
                      checked={form.custom_pages.includes(page)}
                      onCheckedChange={() => togglePage(page)}
                    />
                    <label htmlFor={`page-${page}`} className="text-xs cursor-pointer">
                      {PAGE_LABELS[page] || page}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Sélectionnez d'abord un rôle</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Informations complémentaires..."
            />
          </div>

          {inviteError && (
            <p className="text-sm text-red-500">{inviteError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Enregistrer" : "Inviter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}