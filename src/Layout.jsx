import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  MessageSquare,
  FileText,
  AlertTriangle,
  Settings,
  Menu,
  X,
  School,
  UserCog,
  Clock,
  Bell,
  ChevronDown,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";

const navigation = [
  { name: "Tableau de bord", href: "Dashboard", icon: LayoutDashboard },
  { name: "Élèves", href: "Students", icon: Users },
  { name: "Enseignants", href: "Teachers", icon: GraduationCap },
  { name: "Classes", href: "Classes", icon: School },
  { name: "Matières", href: "Subjects", icon: BookOpen },
  { name: "Personnel", href: "Staff", icon: UserCog },
  { name: "Emploi du temps", href: "Schedule", icon: Clock },
  { name: "Examens & Notes", href: "Exams", icon: ClipboardList },
  { name: "Devoirs", href: "Homework", icon: FileText },
  { name: "Ressources", href: "Resources", icon: BookOpen },
  { name: "Présences", href: "Attendance", icon: Calendar },
  { name: "Sanctions", href: "Sanctions", icon: AlertTriangle },
  { name: "Messages", href: "Messages", icon: MessageSquare },
  { name: "Événements", href: "Events", icon: Calendar },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPath = location.pathname.split('/').pop() || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --primary: 222.2 47.4% 11.2%;
          --primary-foreground: 210 40% 98%;
        }
        
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .sidebar-item {
          transition: all 0.2s ease;
        }
        
        .sidebar-item:hover {
          transform: translateX(4px);
        }
        
        .sidebar-item.active {
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        
        .glass-effect {
          backdrop-filter: blur(12px);
          background: rgba(255, 255, 255, 0.9);
        }
      `}</style>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <School className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg">EduGest</h1>
                <p className="text-xs text-slate-500">Gestion Scolaire</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4 py-6">
            <nav className="space-y-1.5">
              {navigation.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.href)}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "sidebar-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium",
                      isActive
                        ? "active"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                    AD
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">Admin</p>
                    <p className="text-xs text-slate-500">Administrateur</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass-effect border-b border-slate-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-slate-900">
                  {navigation.find(n => n.href === currentPath)?.name || "Tableau de bord"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}