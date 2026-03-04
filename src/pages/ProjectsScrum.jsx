import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Kanban, BarChart3, Sparkles } from "lucide-react";
import ProjectList from "@/components/scrum/ProjectList";
import KanbanBoard from "@/components/scrum/KanbanBoard";
import SprintDashboard from "@/components/scrum/SprintDashboard";
import AIPriorization from "@/components/scrum/AIPriorization";
import ProjectFormModal from "@/components/scrum/ProjectFormModal";

export default function ProjectsScrum() {
  const [activeTab, setActiveTab] = useState("projects");
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const { data: sprints = [], isLoading: loadingSprints } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list("-created_date"),
  });

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setActiveTab("kanban");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion de Projets Agile</h1>
          <p className="text-slate-600 mt-1">Plans d'action et amélioration continue</p>
        </div>
        <Button onClick={() => setShowProjectForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Projet
        </Button>
      </div>

      {/* Selected Project Info */}
      {selectedProject && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
              <p className="text-blue-100 mt-1">{selectedProject.description}</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-xs text-blue-100">KPI Actuel</p>
                  <p className="text-xl font-bold">{selectedProject.current_kpi}</p>
                </div>
                <div className="text-2xl">→</div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-xs text-blue-100">KPI Cible</p>
                  <p className="text-xl font-bold">{selectedProject.target_kpi}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSelectedProject(null)} className="text-white border-white hover:bg-white/20">
              Changer de projet
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="projects" className="gap-2">
            <Kanban className="w-4 h-4" />
            Projets
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2" disabled={!selectedProject}>
            <Kanban className="w-4 h-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2" disabled={!selectedProject}>
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2" disabled={!selectedProject}>
            <Sparkles className="w-4 h-4" />
            IA Priorisation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6">
          <ProjectList
            projects={projects}
            onProjectSelect={handleProjectSelect}
            onCreateNew={() => setShowProjectForm(true)}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          {selectedProject && (
            <KanbanBoard
              project={selectedProject}
              tasks={tasks.filter(t => t.project_id === selectedProject.id)}
            />
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          {selectedProject && (
            <SprintDashboard
              project={selectedProject}
              sprints={sprints.filter(s => s.project_id === selectedProject.id)}
              tasks={tasks.filter(t => t.project_id === selectedProject.id)}
            />
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          {selectedProject && (
            <AIPriorization
              project={selectedProject}
              tasks={tasks.filter(t => t.project_id === selectedProject.id)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Project Form Modal */}
      {showProjectForm && (
        <ProjectFormModal
          open={showProjectForm}
          onClose={() => setShowProjectForm(false)}
        />
      )}
    </div>
  );
}