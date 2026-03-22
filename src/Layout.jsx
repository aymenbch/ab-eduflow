import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  ClipboardList, MessageSquare, FileText, AlertTriangle, Menu, X,
  School, UserCog, Clock, Bell, ChevronDown, LogOut, RefreshCw, UserCircle,
  DollarSign, ShieldCheck, BarChart2, CalendarDays, Smartphone,
  Star, TrendingUp, Network, DoorOpen, Video, Upload, GitBranch, Ticket, UtensilsCrossed, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { ROLES, PAGE_LABELS } from "@/components/roles/roles";
import { getSession, clearSession } from "@/components/auth/appAuth";
import AIChatbot from "@/components/chatbot/AIChatbot";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import WelcomeBanner from "@/components/layout/WelcomeBanner";
import { useTheme } from "@/lib/ThemeContext";

const ALL_NAVIGATION = [
  { name: "Tableau de bord",        href: "Dashboard",        icon: LayoutDashboard },
  { name: "Élèves",                 href: "Students",         icon: Users },
  { name: "Enseignants",            href: "Teachers",         icon: GraduationCap },
  { name: "Classes",                href: "Classes",          icon: School },
  { name: "Matières",               href: "Subjects",         icon: BookOpen },
  { name: "Personnel",              href: "Staff",            icon: UserCog },
  { name: "Emploi du temps",        href: "Schedule",         icon: Clock },
  { name: "Salles & Infrastructures", href: "Rooms",          icon: DoorOpen },
  { name: "Examens & Notes",        href: "Exams",            icon: ClipboardList },
  { name: "Calculs & Moyennes",     href: "Moyennes",         icon: BarChart2 },
  { name: "Devoirs",                href: "Homework",         icon: FileText },
  { name: "Ressources",             href: "Resources",        icon: BookOpen },
  { name: "Présences",              href: "Attendance",       icon: Calendar },
  { name: "Sanctions",              href: "Sanctions",        icon: AlertTriangle },
  { name: "Messages",               href: "Messages",         icon: MessageSquare },
  { name: "Événements",             href: "Events",           icon: Calendar },
  { name: "Visioconférence",        href: "Visio",            icon: Video },
  { name: "Finance & Contentieux",  href: "Finance",          icon: DollarSign },
  { name: "Bulletins Scolaires",    href: "Bulletins",        icon: FileText },
  { name: "Années Scolaires",       href: "SchoolYearManager",icon: CalendarDays },
  { name: "Passage de Classe",      href: "PassageDeClasse",  icon: GraduationCap },
  { name: "Saisie Rapide Mobile",   href: "MobileSaisie",     icon: Smartphone },
  { name: "Espace Parents Premium", href: "EspaceParent",     icon: Star },
  { name: "Pilotage & Performance", href: "Pilotage",         icon: TrendingUp },
  { name: "Projets Agile / Scrum",  href: "ProjectsScrum",    icon: BarChart2 },
  { name: "Réseau Social Éducatif", href: "SocialNetwork",    icon: Network },
  { name: "Affectation Intelligente",href: "Affectation",     icon: Users },
  { name: "Affectation Élèves",     href: "AffectationEleves",icon: GraduationCap },
  { name: "Mon Espace Élève",       href: "StudentDashboard", icon: GraduationCap },
  { name: "Import de données",      href: "Import",           icon: Upload },
  { name: "Organigramme",           href: "OrgChart",         icon: GitBranch },
  { name: "Demandes Internes",      href: "Tickets",          icon: Ticket },
  { name: "Cantine Scolaire",       href: "Cantine",          icon: UtensilsCrossed },
  { name: "Absences Enseignants",   href: "AbsencesEnseignants", icon: UserX },
  { name: "Administration",         href: "Administration",   icon: ShieldCheck },
];

// Regroupement des modules en catégories pour la sidebar
const NAV_CATEGORIES = [
  {
    label: null,
    hrefs: ["Dashboard"],
  },
  {
    label: "Élèves",
    hrefs: ["Students", "Classes", "AffectationEleves", "PassageDeClasse", "StudentDashboard"],
  },
  {
    label: "Équipe pédagogique",
    hrefs: ["Teachers", "Subjects", "Staff", "Schedule", "Rooms", "AbsencesEnseignants"],
  },
  {
    label: "Pédagogie",
    hrefs: ["Exams", "Moyennes", "Homework", "Resources", "Bulletins", "MobileSaisie"],
  },
  {
    label: "Vie scolaire",
    hrefs: ["Attendance", "Sanctions", "Cantine"],
  },
  {
    label: "Communication",
    hrefs: ["Messages", "Events", "Visio", "SocialNetwork", "EspaceParent"],
  },
  {
    label: "Pilotage",
    hrefs: ["Pilotage", "Moyennes", "ProjectsScrum", "OrgChart"],
  },
  {
    label: "Administration",
    hrefs: ["Finance", "SchoolYearManager", "Import", "Affectation", "Tickets", "Administration"],
  },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || 'Dashboard';
  const { theme, setTheme, themes } = useTheme();

  useEffect(() => {
    const session = getSession();
    const role = session?.role || localStorage.getItem("edugest_role");
    setCurrentRole(role);
    // Charger la photo de profil
    if (session?.id) {
      fetch('/api/functions/appGetProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.id }),
      })
        .then(r => r.json())
        .then(data => { if (data?.photo) setProfilePhoto(data.photo); else setProfilePhoto(null); })
        .catch(() => {});
    }
  }, [currentPageName]);

  useEffect(() => {
    const session = getSession();
    const role = session?.role || localStorage.getItem("edugest_role");
    const exemptPages = ["AppLogin", "RoleSelect", "applogin", "roleselect"];
    if (!role && !exemptPages.includes(currentPageName)) {
      const url = createPageUrl("AppLogin");
      if (window.location.href !== url) window.location.replace(url);
    }
  }, [currentPageName]);

  const roleConfig = currentRole ? ROLES[currentRole] : null;

  const getEffectivePages = (role) => {
    const defaultPages = ROLES[role]?.pages || [];
    try {
      const saved = localStorage.getItem("edugest_role_permissions");
      if (saved) {
        const custom = JSON.parse(saved);
        if (custom[role]) {
          // Merge: custom permissions + any new default pages not yet in custom
          const merged = [...new Set([...custom[role], ...defaultPages])];
          return merged;
        }
      }
    } catch {}
    return defaultPages;
  };

  const effectivePages = currentRole ? getEffectivePages(currentRole) : [];
  const navMap = Object.fromEntries(ALL_NAVIGATION.map(item => [item.href, item]));
  const visibleHrefs = new Set(
    currentRole && roleConfig
      ? ALL_NAVIGATION.filter(item => effectivePages.includes(item.href)).map(i => i.href)
      : ALL_NAVIGATION.map(i => i.href)
  );
  const isAdmin = currentRole === "admin_systeme";

  // Catégorie ouverte par défaut = celle qui contient la page active
  const activeCatIdx = NAV_CATEGORIES.findIndex(cat => cat.hrefs.includes(currentPath));
  const [openCats, setOpenCats] = useState(() => new Set(activeCatIdx >= 0 ? [activeCatIdx] : []));

  const toggleCat = (idx) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  useEffect(() => {
    const exemptPages = ["RoleSelect", "AppLogin", "Grades", "StudentDetail", "MonProfil"];
    if (currentRole && roleConfig && currentPageName && !exemptPages.includes(currentPageName)) {
      const allowed = [...getEffectivePages(currentRole), "Grades", "StudentDetail"];
      if (!allowed.includes(currentPageName)) window.location.href = createPageUrl("Dashboard");
    }
  }, [currentPageName, currentRole]);

  const handleChangeRole = () => {
    clearSession();
    window.location.href = createPageUrl("AppLogin");
  };

  if (currentPageName === "RoleSelect" || currentPageName === "AppLogin") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen layout-root">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 layout-sidebar border-r transform transition-transform duration-300 ease-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b layout-border-light">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl layout-logo-accent flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold sidebar-text-hi text-lg">EduGest</h1>
                <p className="text-xs sidebar-text-lo">Gestion Scolaire</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 sidebar-text-muted" />
            </Button>
          </div>

          {/* Badge rôle */}
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
            <nav className="space-y-0.5">
              {NAV_CATEGORIES.map((category, catIdx) => {
                const items = category.hrefs
                  .map(href => navMap[href])
                  .filter(item => item && visibleHrefs.has(item.href));
                if (items.length === 0) return null;
                const isOpen = !category.label || openCats.has(catIdx);
                const hasActive = items.some(i => i.href === currentPath);
                return (
                  <div key={catIdx} className={catIdx > 0 ? "pt-2" : ""}>
                    {category.label && (
                      <button
                        onClick={() => toggleCat(catIdx)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 rounded-lg mb-0.5 transition-colors",
                          "hover:bg-white/10",
                          hasActive && !isOpen ? "bg-white/10" : ""
                        )}
                      >
                        <span className={cn(
                          "text-[11px] uppercase tracking-widest font-bold border-l-2 pl-2",
                          hasActive ? "sidebar-text-hi opacity-90 border-current" : "sidebar-text-muted opacity-70 border-transparent"
                        )}>
                          {category.label}
                        </span>
                        <ChevronDown className={cn(
                          "w-3.5 h-3.5 sidebar-text-muted transition-transform duration-200",
                          isOpen ? "rotate-0" : "-rotate-90"
                        )} />
                      </button>
                    )}
                    {isOpen && (
                      <div className="space-y-0.5">
                        {items.map((item) => {
                          const isActive = currentPath === item.href;
                          return (
                            <Link
                              key={item.href}
                              to={createPageUrl(item.href)}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                "sidebar-item layout-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium",
                                isActive ? "active" : ""
                              )}
                            >
                              <item.icon className="w-5 h-5" />
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Section utilisateur */}
          <div className="p-4 border-t layout-border-light">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="layout-user-btn flex items-center gap-3 w-full p-3 rounded-xl transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${roleConfig?.color || "from-blue-400 to-blue-600"} flex items-center justify-center text-xl flex-shrink-0 overflow-hidden`}>
                    {profilePhoto
                      ? <img src={profilePhoto} alt="avatar" className="w-full h-full object-cover" />
                      : (roleConfig?.icon || "👤")
                    }
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium sidebar-text-hi truncate">
                      {getSession()?.full_name || roleConfig?.label || "Utilisateur"}
                    </p>
                    <p className="text-xs sidebar-text-lo">{roleConfig?.label || ""}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 sidebar-text-muted flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { window.location.href = createPageUrl("MonProfil"); }}>
                  <UserCircle className="w-4 h-4 mr-2" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleChangeRole}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Changer de compte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { clearSession(); window.location.href = createPageUrl("AppLogin"); }}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 layout-header-glass border-b">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">

            {/* Gauche : burger + titre */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold main-text-hi">
                  {ALL_NAVIGATION.find(n => n.href === currentPath)?.name
                    || PAGE_LABELS[currentPageName]
                    || "Tableau de bord"}
                </h2>
              </div>
            </div>

            {/* Droite : badge rôle + cloche + sélecteur de thème */}
            <div className="flex items-center gap-3">
              {roleConfig && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-xs font-medium`}>
                  <span>{roleConfig.icon}</span>
                  <span>{roleConfig.label}</span>
                </div>
              )}

              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              {/* ── Sélecteur de thème ── */}
              <div
                className="flex items-center rounded-lg border overflow-hidden shadow-sm"
                style={{ borderColor: 'var(--theme-header-border, #e2e8f0)' }}
              >
                {themes.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.description}
                    aria-label={`Thème ${t.label}`}
                    aria-pressed={theme === t.id}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center text-base transition-all duration-200",
                      idx < themes.length - 1 && "border-r",
                      theme !== t.id && "hover:opacity-80"
                    )}
                    style={{
                      background: theme === t.id
                        ? `var(--theme-accent-from, #3b82f6)`
                        : `var(--theme-header-glass, rgba(255,255,255,0.9))`,
                      color: theme === t.id ? '#ffffff' : 'var(--theme-main-text-lo, #64748b)',
                      borderColor: 'var(--theme-header-border, #e2e8f0)',
                    }}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </header>

        <main className="p-4 lg:p-8 pb-24 lg:pb-8">
          {currentRole && currentPageName !== "RoleSelect" && (
            <WelcomeBanner currentRole={currentRole} profilePhoto={profilePhoto} />
          )}
          {children}
        </main>
      </div>

      {currentRole && (
        <MobileBottomNav currentRole={currentRole} onMoreClick={() => setSidebarOpen(true)} />
      )}

      {currentRole && <AIChatbot />}
    </div>
  );
}
