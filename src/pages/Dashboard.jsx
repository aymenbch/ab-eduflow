import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/ui/StatCard";
import {
  Users,
  GraduationCap,
  School,
  BookOpen,
  Calendar,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  ClipboardList,
  FileText,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ROLES } from "@/components/roles/roles";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import FinanceWidget from "@/components/dashboard/FinanceWidget";

// Role-specific dashboard content
function AdminDashboard({ students, teachers, classes, subjects, events, sanctions, messages }) {
  const activeStudents = students.filter(s => s.status === "active").length;
  const activeTeachers = teachers.filter(t => t.status === "active").length;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Élèves inscrits" value={activeStudents} icon={Users} color="blue" subtitle={`${students.length} total`} />
        <StatCard title="Enseignants" value={activeTeachers} icon={GraduationCap} color="green" />
        <StatCard title="Classes" value={classes.length} icon={School} color="purple" />
        <StatCard title="Matières" value={subjects.length} icon={BookOpen} color="orange" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Messages non lus</p><p className="text-2xl font-bold">{messages.filter(m => !m.read).length}</p></div>
            <MessageSquare className="w-8 h-8 text-yellow-500" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Sanctions actives</p><p className="text-2xl font-bold">{sanctions.filter(s => !s.resolved).length}</p></div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Taux de présence</p><p className="text-2xl font-bold">95%</p></div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEvents events={events} />
        <FinanceWidget />
      </div>
    </>
  );
}

function TeacherDashboard({ classes, homework, messages }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Mes classes" value={classes.length} icon={School} color="green" />
        <StatCard title="Devoirs assignés" value={homework.length} icon={FileText} color="blue" />
        <StatCard title="Messages non lus" value={messages.filter(m => !m.read).length} icon={MessageSquare} color="orange" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Derniers devoirs</CardTitle></CardHeader>
          <CardContent>
            {homework.slice(0, 5).map(hw => (
              <div key={hw.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium text-sm">{hw.title}</span>
                <Badge variant="outline">{hw.due_date}</Badge>
              </div>
            ))}
            {homework.length === 0 && <p className="text-slate-500 text-center py-4">Aucun devoir</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Messages récents</CardTitle></CardHeader>
          <CardContent>
            {messages.slice(0, 5).map(m => (
              <div key={m.id} className={`flex items-center justify-between py-2 border-b last:border-0 ${!m.read ? 'font-semibold' : ''}`}>
                <span className="text-sm truncate">{m.subject}</span>
                <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{m.sender_name}</span>
              </div>
            ))}
            {messages.length === 0 && <p className="text-slate-500 text-center py-4">Aucun message</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CPEDashboard({ students, sanctions, messages }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Élèves" value={students.filter(s => s.status === "active").length} icon={Users} color="blue" />
        <StatCard title="Sanctions actives" value={sanctions.filter(s => !s.resolved).length} icon={AlertTriangle} color="orange" />
        <StatCard title="Messages non lus" value={messages.filter(m => !m.read).length} icon={MessageSquare} color="purple" />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Sanctions récentes</CardTitle></CardHeader>
        <CardContent>
          {sanctions.filter(s => !s.resolved).slice(0, 8).map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{s.reason}</p>
                <p className="text-xs text-slate-500">{s.type} • {s.date}</p>
              </div>
              <Badge className="bg-orange-100 text-orange-800">En cours</Badge>
            </div>
          ))}
          {sanctions.filter(s => !s.resolved).length === 0 && <p className="text-slate-500 text-center py-4">Aucune sanction active</p>}
        </CardContent>
      </Card>
    </>
  );
}

function EleveDashboard({ homework, messages, events }) {
  const upcoming = homework.filter(hw => hw.due_date && new Date(hw.due_date) >= new Date()).slice(0, 5);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Devoirs à rendre" value={upcoming.length} icon={FileText} color="pink" />
        <StatCard title="Messages" value={messages.filter(m => !m.read).length} icon={MessageSquare} color="blue" />
        <StatCard title="Événements à venir" value={events.filter(e => e.date && new Date(e.date) >= new Date()).length} icon={Calendar} color="green" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-pink-500" />Devoirs à faire</CardTitle></CardHeader>
          <CardContent>
            {upcoming.map(hw => (
              <div key={hw.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium text-sm">{hw.title}</span>
                <Badge variant="outline">{hw.due_date ? format(new Date(hw.due_date), "d MMM", { locale: fr }) : ""}</Badge>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-slate-500 text-center py-4">Aucun devoir à rendre 🎉</p>}
          </CardContent>
        </Card>
        <UpcomingEvents events={events} />
      </div>
    </>
  );
}

function ParentDashboard({ sanctions, messages, homework, events }) {
  const activeSanctions = sanctions.filter(s => !s.resolved);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Messages" value={messages.filter(m => !m.read).length} icon={MessageSquare} color="amber" />
        <StatCard title="Devoirs en cours" value={homework.filter(hw => hw.due_date && new Date(hw.due_date) >= new Date()).length} icon={FileText} color="blue" />
        <StatCard title="Sanctions actives" value={activeSanctions.length} icon={AlertTriangle} color={activeSanctions.length > 0 ? "orange" : "green"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Derniers messages</CardTitle></CardHeader>
          <CardContent>
            {messages.slice(0, 5).map(m => (
              <div key={m.id} className={`py-2 border-b last:border-0 ${!m.read ? 'font-semibold' : ''}`}>
                <p className="text-sm">{m.subject}</p>
                <p className="text-xs text-slate-400">De: {m.sender_name}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-slate-500 text-center py-4">Aucun message</p>}
          </CardContent>
        </Card>
        <UpcomingEvents events={events} />
      </div>
    </>
  );
}

function ComptableDashboard({ staff, teachers }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard title="Personnel administratif" value={staff.filter(s => s.status === "active").length} icon={Users} color="teal" />
        <StatCard title="Enseignants" value={teachers.filter(t => t.status === "active").length} icon={GraduationCap} color="green" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Répartition des contrats - Personnel</CardTitle></CardHeader>
          <CardContent>
            {["permanent", "contract", "part_time"].map(type => {
              const count = staff.filter(s => s.contract_type === type).length;
              const labels = { permanent: "CDI", contract: "CDD", part_time: "Temps partiel" };
              return (
                <div key={type} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{labels[type]}</span>
                  <Badge>{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Répartition des contrats - Enseignants</CardTitle></CardHeader>
          <CardContent>
            {["permanent", "contract", "part_time"].map(type => {
              const count = teachers.filter(t => t.contract_type === type).length;
              const labels = { permanent: "CDI", contract: "CDD", part_time: "Temps partiel" };
              return (
                <div key={type} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{labels[type]}</span>
                  <Badge>{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UpcomingEvents({ events }) {
  const upcoming = (events || []).filter(e => e.date && new Date(e.date) >= new Date()).slice(0, 5);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Événements à venir</CardTitle></CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-center py-4">Aucun événement prévu</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(event => (
              <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600">{new Date(event.date).getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-slate-500">{format(new Date(event.date), "EEEE d MMMM", { locale: fr })}</p>
                </div>
                <Badge variant="secondary">{event.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [currentRole, setCurrentRole] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem("edugest_role");
    setCurrentRole(role);
  }, []);

  const roleConfig = currentRole ? ROLES[currentRole] : null;

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 10) });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });
  const { data: messages = [] } = useQuery({ queryKey: ["messages"], queryFn: () => base44.entities.Message.list() });
  const { data: homework = [] } = useQuery({ queryKey: ["homework"], queryFn: () => base44.entities.Homework.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });

  const renderDashboard = () => {
    if (!currentRole) return null;

    const isDirecteur = ["directeur_general", "directeur_primaire", "directeur_college", "directeur_lycee"].includes(currentRole);
    const isSecretaire = currentRole === "secretaire";

    if (isDirecteur || isSecretaire) {
      return <AdminDashboard students={students} teachers={teachers} classes={classes} subjects={subjects} events={events} sanctions={sanctions} messages={messages} />;
    }
    if (currentRole === "enseignant") {
      return <TeacherDashboard classes={classes} homework={homework} messages={messages} />;
    }
    if (currentRole === "cpe") {
      return <CPEDashboard students={students} sanctions={sanctions} messages={messages} />;
    }
    if (currentRole === "eleve") {
      return <EleveDashboard homework={homework} messages={messages} events={events} />;
    }
    if (currentRole === "parent") {
      return <ParentDashboard sanctions={sanctions} messages={messages} homework={homework} events={events} />;
    }
    if (currentRole === "comptable") {
      return <ComptableDashboard staff={staff} teachers={teachers} />;
    }

    return <AdminDashboard students={students} teachers={teachers} classes={classes} subjects={subjects} events={events} sanctions={sanctions} messages={messages} />;
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`bg-gradient-to-r ${roleConfig?.color || "from-blue-500 to-blue-600"} rounded-2xl p-8 text-white`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">{roleConfig?.icon || "🏫"}</div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Bienvenue, {roleConfig?.label || "Utilisateur"}</h1>
            <p className="text-white/80">{roleConfig?.description}</p>
            <p className="text-sm text-white/60 mt-1">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
      </div>

      {renderDashboard()}
    </div>
  );
}