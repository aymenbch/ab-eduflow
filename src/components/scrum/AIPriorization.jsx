import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AIPriorization({ project, tasks }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["tasks"]);
    }
  });

  const analyzeWithAI = async () => {
    setAnalyzing(true);
    try {
      const projectContext = `
Projet: ${project.name}
Type: ${project.type}
Objectif: ${project.objective}
KPI Actuel: ${project.current_kpi}
KPI Cible: ${project.target_kpi}

Tâches:
${tasks.map(t => `- ${t.title} (Priorité: ${t.priority}, Points: ${t.story_points || 0}, Status: ${t.status})`).join("\n")}
      `;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en gestion de projet éducatif Agile. Analyse ce projet scolaire et priorise les tâches selon leur impact sur l'objectif.

${projectContext}

Fournis:
1. Un score de priorité (0-100) pour chaque tâche basé sur:
   - Impact sur l'objectif du projet
   - Urgence (KPI actuel vs cible)
   - Dépendances
   - Effort estimé (story points)

2. Des suggestions d'amélioration pour maximiser l'impact éducatif

Réponds au format JSON suivant.`,
        response_json_schema: {
          type: "object",
          properties: {
            task_priorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_title: { type: "string" },
                  priority_score: { type: "number" },
                  reasoning: { type: "string" },
                  suggested_priority: { type: "string", enum: ["critical", "high", "medium", "low"] }
                }
              }
            },
            overall_recommendations: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setAiSuggestions(response);
      toast.success("Analyse IA terminée !");
    } catch (error) {
      toast.error("Erreur lors de l'analyse IA");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyAIPriorities = async () => {
    if (!aiSuggestions?.task_priorities) return;

    const updates = tasks.map(task => {
      const suggestion = aiSuggestions.task_priorities.find(
        s => s.task_title === task.title
      );
      
      if (suggestion) {
        return updateTaskMutation.mutateAsync({
          id: task.id,
          data: {
            ai_priority_score: suggestion.priority_score,
            priority: suggestion.suggested_priority,
            ai_suggestion: suggestion.reasoning
          }
        });
      }
    }).filter(Boolean);

    await Promise.all(updates);
    toast.success("Priorités IA appliquées !");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Priorisation IA</h2>
            </div>
            <p className="text-purple-100">
              L'IA analyse votre projet et suggère les priorités optimales pour atteindre vos objectifs éducatifs
            </p>
          </div>
          <Button
            onClick={analyzeWithAI}
            disabled={analyzing || tasks.length === 0}
            variant="outline"
            className="bg-white text-purple-600 hover:bg-purple-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Lancer l'analyse IA
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* AI Suggestions */}
      {aiSuggestions && (
        <>
          {/* Recommendations */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Recommandations Globales
            </h3>
            <div className="space-y-3">
              {aiSuggestions.overall_recommendations?.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-slate-700">{rec}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Task Priorities */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Priorités Suggérées par l'IA</h3>
              <Button onClick={applyAIPriorities} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Appliquer les priorités
              </Button>
            </div>

            <div className="space-y-3">
              {aiSuggestions.task_priorities
                ?.sort((a, b) => b.priority_score - a.priority_score)
                .map((suggestion, index) => {
                  const task = tasks.find(t => t.title === suggestion.task_title);
                  if (!task) return null;

                  const priorityColors = {
                    critical: "bg-red-100 text-red-800 border-red-300",
                    high: "bg-orange-100 text-orange-800 border-orange-300",
                    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
                    low: "bg-green-100 text-green-800 border-green-300"
                  };

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border-2 ${priorityColors[suggestion.suggested_priority]}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold">#{index + 1}</div>
                          <div>
                            <h4 className="font-semibold">{task.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">Score: {suggestion.priority_score}/100</Badge>
                              <Badge>{suggestion.suggested_priority.toUpperCase()}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-3 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>{suggestion.reasoning}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!aiSuggestions && !analyzing && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Priorisation Intelligente</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Utilisez l'IA pour analyser votre projet et obtenir des recommandations de priorisation basées sur l'impact éducatif
          </p>
          <Button onClick={analyzeWithAI} disabled={tasks.length === 0}>
            <Sparkles className="w-4 h-4 mr-2" />
            Démarrer l'analyse
          </Button>
        </Card>
      )}
    </div>
  );
}