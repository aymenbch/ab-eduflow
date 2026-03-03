import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DirectionDashboard from "@/components/analytics/DirectionDashboard.jsx";
import StudentAnalytics from "@/components/analytics/StudentAnalytics.jsx";
import TeacherAnalytics from "@/components/analytics/TeacherAnalytics.jsx";
import EarlyWarningSystem from "@/components/analytics/EarlyWarningSystem.jsx";
import { BarChart2, Users, GraduationCap, AlertTriangle } from "lucide-react";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="text-5xl">📊</div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Intelligence Analytique</h1>
            <p className="text-white/80">Tableau de bord BI — Suivi des performances & alertes automatiques</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="direction">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="direction" className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> Direction
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Élèves
          </TabsTrigger>
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Enseignants
          </TabsTrigger>
          <TabsTrigger value="warnings" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direction" className="mt-6">
          <DirectionDashboard />
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <StudentAnalytics />
        </TabsContent>
        <TabsContent value="teachers" className="mt-6">
          <TeacherAnalytics />
        </TabsContent>
        <TabsContent value="warnings" className="mt-6">
          <EarlyWarningSystem />
        </TabsContent>
      </Tabs>
    </div>
  );
}