import React from "react";
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
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 5),
  });

  const { data: sanctions = [] } = useQuery({
    queryKey: ["sanctions"],
    queryFn: () => base44.entities.Sanction.filter({ resolved: false }),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => base44.entities.Message.filter({ read: false }),
  });

  const activeStudents = students.filter(s => s.status === "active").length;
  const activeTeachers = teachers.filter(t => t.status === "active").length;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Bienvenue sur EduGest</h1>
        <p className="text-blue-100">
          Gérez votre établissement scolaire efficacement
        </p>
        <p className="text-sm text-blue-200 mt-2">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Élèves inscrits"
          value={activeStudents}
          icon={Users}
          color="blue"
          subtitle={`${students.length} total`}
        />
        <StatCard
          title="Enseignants"
          value={activeTeachers}
          icon={GraduationCap}
          color="green"
          subtitle={`${teachers.length} total`}
        />
        <StatCard
          title="Classes"
          value={classes.length}
          icon={School}
          color="purple"
        />
        <StatCard
          title="Matières"
          value={subjects.length}
          icon={BookOpen}
          color="orange"
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Messages non lus</p>
                <p className="text-2xl font-bold">{messages.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sanctions en cours</p>
                <p className="text-2xl font-bold">{sanctions.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Taux de présence</p>
                <p className="text-2xl font-bold">95%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Événements à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Aucun événement prévu</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600">
                        {new Date(event.date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(event.date), "EEEE d MMMM", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="secondary">{event.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="w-5 h-5" />
              Classes par niveau
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Aucune classe créée</p>
            ) : (
              <div className="space-y-3">
                {["6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"].map((level) => {
                  const count = classes.filter(c => c.level === level).length;
                  if (count === 0) return null;
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <span className="font-medium">{level}</span>
                      <span className="text-slate-600">{count} classe{count > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}