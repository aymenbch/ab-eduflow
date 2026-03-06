import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";

/**
 * Hook: retourne le profil enseignant lié à l'email du compte connecté.
 * Retourne { teacherProfile, mySubjectIds, isTeacherRole, loading }
 */
export function useTeacherProfile() {
  const [userEmail, setUserEmail] = useState(null);
  const currentRole = localStorage.getItem("edugest_role");
  const isTeacherRole = currentRole === "enseignant";

  useEffect(() => {
    if (isTeacherRole) {
      base44.auth.me().then(u => setUserEmail(u?.email || null)).catch(() => {});
    }
  }, [isTeacherRole]);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
    enabled: isTeacherRole,
  });

  const teacherProfile = isTeacherRole && userEmail
    ? teachers.find(t => t.email?.toLowerCase() === userEmail.toLowerCase()) || null
    : null;

  const mySubjectIds = teacherProfile?.subject_ids || [];

  return { teacherProfile, mySubjectIds, isTeacherRole, loading: isLoading };
}