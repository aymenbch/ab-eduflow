import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, BarChart2, Users, Menu, X } from "lucide-react";
import GroupSidebar from "@/components/social/GroupSidebar";
import ChatArea from "@/components/social/ChatArea";
import SocialAnalytics from "@/components/social/SocialAnalytics";
import CreateGroupModal from "@/components/social/CreateGroupModal";
import { cn } from "@/lib/utils";

export default function SocialNetwork() {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");

  const currentRole = localStorage.getItem("edugest_role") || "directeur_general";

  const { data: groups = [] } = useQuery({
    queryKey: ["social-groups"],
    queryFn: () => base44.entities.SocialGroup.filter({ status: "active" }),
  });

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setSidebarOpen(false);
    setActiveTab("chat");
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Page title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Réseau Social Éducatif</h1>
          <p className="text-sm text-slate-500">Communication sécurisée, intelligente et traçable</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 hidden sm:flex">
            🔒 Sécurisé & Conforme
          </Badge>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="chat" className="gap-1 text-xs">
                <MessageSquare className="w-3.5 h-3.5" /> Messages
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1 text-xs">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {activeTab === "analytics" ? (
        <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <SocialAnalytics groups={groups} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <div className={cn(
            "flex-shrink-0 w-64 lg:w-72 border-r border-slate-200 transition-all duration-300",
            "lg:relative lg:translate-x-0",
            "fixed top-0 left-0 h-full z-50 lg:z-auto",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}>
            <div className="h-full">
              {sidebarOpen && (
                <Button variant="ghost" size="icon" className="absolute top-3 right-3 z-10 lg:hidden"
                  onClick={() => setSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
              <GroupSidebar
                groups={groups}
                selectedGroupId={selectedGroup?.id}
                onSelectGroup={handleSelectGroup}
                onCreateGroup={() => setShowCreateModal(true)}
              />
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center gap-3 p-3 border-b border-slate-200">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-slate-700">
                {selectedGroup ? selectedGroup.name : "Sélectionner un groupe"}
              </span>
            </div>

            {selectedGroup ? (
              <ChatArea
                group={selectedGroup}
                currentRole={currentRole}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Réseau Social Éducatif</h3>
                <p className="text-sm text-slate-500 max-w-xs mb-6">
                  Sélectionnez un groupe pour commencer à communiquer de manière sécurisée et traçable.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 max-w-xs">
                  {["💬 Messagerie sécurisée","🤖 IA & Modération","📊 Analytics BI","🎖️ Gamification"].map(f => (
                    <div key={f} className="bg-slate-50 rounded-xl p-3 text-center font-medium">{f}</div>
                  ))}
                </div>
                {groups.length === 0 && (
                  <Button className="mt-6 bg-blue-600 hover:bg-blue-700 gap-2"
                    onClick={() => setShowCreateModal(true)}>
                    <Users className="w-4 h-4" />
                    Créer le premier groupe
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <CreateGroupModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}