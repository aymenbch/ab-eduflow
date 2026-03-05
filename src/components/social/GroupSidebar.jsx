import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, BookOpen, Megaphone, GraduationCap, Bus,
  Building2, FolderKanban, Search, Plus, Lock
} from "lucide-react";

const GROUP_TYPE_CONFIG = {
  classe_eleves:  { label: "Classe (Élèves)",    icon: Users,        color: "bg-blue-100 text-blue-700" },
  classe_parents: { label: "Classe (Parents)",   icon: Users,        color: "bg-purple-100 text-purple-700" },
  classe_prof:    { label: "Classe + Prof",       icon: GraduationCap,color: "bg-indigo-100 text-indigo-700" },
  matiere:        { label: "Matière",             icon: BookOpen,     color: "bg-green-100 text-green-700" },
  club:           { label: "Club / Activité",     icon: Users,        color: "bg-yellow-100 text-yellow-700" },
  internat:       { label: "Internat",            icon: Building2,    color: "bg-orange-100 text-orange-700" },
  transport:      { label: "Transport",           icon: Bus,          color: "bg-cyan-100 text-cyan-700" },
  projet:         { label: "Projet",              icon: FolderKanban, color: "bg-pink-100 text-pink-700" },
  enseignants:    { label: "Enseignants",         icon: GraduationCap,color: "bg-teal-100 text-teal-700" },
  annonces:       { label: "Annonces",            icon: Megaphone,    color: "bg-red-100 text-red-700" },
};

export default function GroupSidebar({ groups, selectedGroupId, onSelectGroup, onCreateGroup }) {
  const [search, setSearch] = React.useState("");

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by type category
  const categories = {
    "Canaux officiels": filtered.filter(g => g.type === "annonces"),
    "Classes": filtered.filter(g => ["classe_eleves","classe_parents","classe_prof"].includes(g.type)),
    "Pédagogique": filtered.filter(g => ["matiere","club","projet"].includes(g.type)),
    "Services": filtered.filter(g => ["internat","transport","enseignants"].includes(g.type)),
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 text-sm">Réseau Social</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCreateGroup}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.entries(categories).map(([category, items]) =>
          items.length === 0 ? null : (
            <div key={category}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">{category}</p>
              <div className="space-y-0.5">
                {items.map(group => {
                  const cfg = GROUP_TYPE_CONFIG[group.type] || {};
                  const Icon = cfg.icon || Users;
                  const isActive = selectedGroupId === group.id;
                  return (
                    <button
                      key={group.id}
                      onClick={() => onSelectGroup(group)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                        isActive ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="flex-1 truncate font-medium text-xs">{group.name}</span>
                      {group.is_readonly && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                      {group.unread_count > 0 && (
                        <Badge className="bg-blue-600 text-white text-[9px] h-4 min-w-4 px-1">
                          {group.unread_count}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">Aucun groupe trouvé</p>
        )}
      </div>
    </div>
  );
}