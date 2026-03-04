import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Target, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const PROJECT_TYPE_LABELS = {
  amelioration_niveau: "Amélioration Niveau",
  reduction_absenteisme: "Réduction Absentéisme",
  amelioration_matiere: "Amélioration Matière",
  amelioration_discipline: "Amélioration Discipline",
  optimisation_pedagogique: "Optimisation Pédagogique",
  autre: "Autre"
};

const PRIORITY_CONFIG = {
  critical: { label: "Critique", color: "bg-red-100 text-red-800" },
  high: { label: "Haute", color: "bg-orange-100 text-orange-800" },
  medium: { label: "Moyenne", color: "bg-yellow-100 text-yellow-800" },
  low: { label: "Basse", color: "bg-green-100 text-green-800" }
};

export default function ProjectList({ projects, onProjectSelect, onCreateNew }) {
  const activeProjects = projects.filter(p => p.status === "active");
  const draftProjects = projects.filter(p => p.status === "draft");
  const completedProjects = projects.filter(p => p.status === "completed");

  const ProjectCard = ({ project }) => {
    const priorityConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium;
    
    return (
      <Card
        className="p-6 hover:shadow-lg transition-all cursor-pointer border-l-4"
        style={{ borderLeftColor: project.color || "#3b82f6" }}
        onClick={() => onProjectSelect(project)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg text-slate-900">{project.name}</h3>
              <Badge className={priorityConfig.color}>
                {priorityConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">{PROJECT_TYPE_LABELS[project.type]}</p>
          </div>
        </div>

        <p className="text-slate-700 text-sm mb-4 line-clamp-2">{project.description}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">KPI Actuel → Cible</p>
              <p className="font-semibold text-slate-900">
                {project.current_kpi} → {project.target_kpi}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Progression</p>
              <p className="font-semibold text-green-600">
                +{((project.current_kpi / project.target_kpi) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="w-4 h-4" />
            <span>{project.team_members?.length || 0} membres</span>
          </div>
          {project.start_date && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(project.start_date), "dd/MM/yyyy")}</span>
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucun projet</h3>
        <p className="text-slate-600 mb-6">Créez votre premier plan d'action Agile</p>
        <Button onClick={onCreateNew}>Créer un projet</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activeProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Projets actifs ({activeProjects.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {draftProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Brouillons ({draftProjects.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {draftProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {completedProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Complétés ({completedProjects.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}