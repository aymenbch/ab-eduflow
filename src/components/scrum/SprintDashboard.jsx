import React from "react";
import { Card } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Target, Zap, CheckCircle } from "lucide-react";

export default function SprintDashboard({ project, sprints, tasks }) {
  const activeSprint = sprints.find(s => s.status === "active");
  const completedSprints = sprints.filter(s => s.status === "completed");

  // Calcul de la vélocité
  const velocityData = completedSprints.map(sprint => ({
    name: sprint.name,
    target: sprint.velocity_target,
    achieved: sprint.velocity_achieved
  }));

  // Burndown chart data (simplifié)
  const sprintTasks = activeSprint 
    ? tasks.filter(t => t.sprint_id === activeSprint.id)
    : [];
  
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const completedPoints = sprintTasks
    .filter(t => t.status === "done")
    .reduce((sum, t) => sum + (t.story_points || 0), 0);
  const remainingPoints = totalPoints - completedPoints;

  const burndownData = [
    { day: "Jour 1", ideal: totalPoints, actual: totalPoints },
    { day: "Jour 5", ideal: totalPoints * 0.7, actual: totalPoints * 0.8 },
    { day: "Jour 10", ideal: totalPoints * 0.4, actual: remainingPoints },
    { day: "Fin", ideal: 0, actual: Math.max(0, remainingPoints) }
  ];

  // Calcul des KPIs
  const avgVelocity = completedSprints.length > 0
    ? (completedSprints.reduce((sum, s) => sum + s.velocity_achieved, 0) / completedSprints.length).toFixed(1)
    : 0;

  const avgCompletion = completedSprints.length > 0
    ? (completedSprints.reduce((sum, s) => sum + s.completion_rate, 0) / completedSprints.length).toFixed(0)
    : 0;

  const currentCompletion = activeSprint
    ? ((completedPoints / totalPoints) * 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Vélocité Moyenne</p>
              <p className="text-2xl font-bold text-slate-900">{avgVelocity}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Taux Complétion Moyen</p>
              <p className="text-2xl font-bold text-slate-900">{avgCompletion}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Sprint Actuel</p>
              <p className="text-2xl font-bold text-slate-900">{currentCompletion}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Sprints Terminés</p>
              <p className="text-2xl font-bold text-slate-900">{completedSprints.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vélocité */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Vélocité par Sprint</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="target" fill="#94a3b8" name="Cible" />
              <Bar dataKey="achieved" fill="#3b82f6" name="Réalisé" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Burndown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Burndown Chart - Sprint Actuel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={burndownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ideal" stroke="#94a3b8" name="Idéal" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Réel" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Sprint actif */}
      {activeSprint && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Sprint Actuel: {activeSprint.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">Objectif</p>
              <p className="text-slate-900">{activeSprint.goal}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Points Total / Complétés</p>
              <p className="text-xl font-bold text-slate-900">{completedPoints} / {totalPoints}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Tâches Complétées</p>
              <p className="text-xl font-bold text-green-600">
                {sprintTasks.filter(t => t.status === "done").length} / {sprintTasks.length}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}