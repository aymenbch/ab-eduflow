import React, { useState, useEffect } from "react";
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
  Menu,
  X,
  School,
  UserCog,
  Clock,
  Bell,
  ChevronDown,
  LogOut,
  RefreshCw,
  DollarSign,
  ShieldCheck,
  BarChart2,
  CalendarDays,
  Smartphone,
  Star,
  TrendingUp,
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
import { ROLES } from "@/components/roles/roles";

const ALL_NAVIGATION = [
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
  { name: "Finance & Contentieux", href: "Finance", icon: DollarSign },
  { name: "Bulletins Scolaires", href: "Bulletins", icon: FileText },
  { name: "Années Scolaires", href: "SchoolYearManager", icon: CalendarDays },
  { name: "Saisie Rapide Mobile", href: "MobileSaisie", icon: Smartphone },
  { name: "Espace Parents Premium", href: "EspaceParent", icon: Star },
  { name: "Pilotage & Performance", href: "Pilotage", icon: TrendingUp },
];

const ADMIN_NAV = [
  { name: "Administration", href: "Administration", icon: ShieldCheck },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || 'Dashboard';

  useEffect(() => {
    const role = localStorage.getItem("edugest_role");
    setCurrentRole(role);
  }, [currentPageName]);

  // If no role selected and not on RoleSelect page, redirect
  useEffect(() => {
    const role = localStorage.getItem("edugest_role");
    if (!role && currentPageName !== "RoleSelect" && currentPageName !== "roleselect") {
      // Use navigate instead of hard redirect to avoid page-not-found loops
      const url = createPageUrl("RoleSelect");
      if (window.location.href !== url) {
        window.location.replace(url);
      }
    }
  }, [currentPageName]);

  const roleConfig = currentRole ? ROLES[currentRole] : null;

  // Filter navigation based on role
  const navigation = currentRole && roleConfig
    ? ALL_NAVIGATION.filter(item => roleConfig.pages.includes(item.href))
    : ALL_NAVIGATION;

  // Only directeur_general sees the Administration page
  const isAdmin = currentRole === "directeur_general";


  // Block access to unauthorized pages
  useEffect(() => {
    if (currentRole && roleConfig && currentPageName && currentPageName !== "RoleSelect") {
      const allowedPages = [...roleConfig.pages, "Grades", "StudentDetail"];
      if (isAdmin) allowedPages.push("Administration", "Analytics");
      if (!allowedPages.includes(currentPageName)) {
        window.location.href = createPageUrl("Dashboard");
      }
    }
  }, [currentPageName, currentRole]);

  const handleChangeRole = () => {
    localStorage.removeItem("edugest_role");
    window.location.href = createPageUrl("RoleSelect");
  };

  if (currentPageName === "RoleSelect") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        .sidebar-item { transition: all 0.2s ease; }
        .sidebar-item:hover { transform: translateX(4px); }
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

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
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
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Role badge */}
          {roleConfig && (
            <div className={`mx-4 mt-4 px-3 py-2 rounded-xl bg-gradient-to-r ${roleConfig.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{roleConfig.icon}</span>
                <div>
                  <p className="text-xs text-white/70 font-medium">Espace</p>
                  <p className="text-sm font-bold text-white">{roleConfig.label}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4 py-4">
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
                      isActive ? "active" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}

              {/* Admin section */}
              {isAdmin && (
                <>
                  <div className="pt-3 pb-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wider px-4">Administration</p>
                  </div>
                  {ADMIN_NAV.map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.href)}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "sidebar-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium",
                          isActive ? "active" : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${roleConfig?.color || "from-blue-400 to-blue-600"} flex items-center justify-center text-xl`}>
                    {roleConfig?.icon || "👤"}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{roleConfig?.label || "Utilisateur"}</p>
                    <p className="text-xs text-slate-500">Mode démo</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleChangeRole}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Changer de profil
                </DropdownMenuItem>
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
        <header className="sticky top-0 z-30 glass-effect border-b border-slate-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-slate-900">
                  {[...ALL_NAVIGATION, ...ADMIN_NAV].find(n => n.href === currentPath)?.name || "Tableau de bord"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {roleConfig && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-xs font-medium`}>
                  <span>{roleConfig.icon}</span>
                  <span>{roleConfig.label}</span>
                </div>
              )}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeRole}
                className="hidden md:flex items-center gap-2 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Changer
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}