import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook qui détecte l'utilisateur connecté et le lie à son entité métier :
 * - rôle "eleve"      → cherche un Student dont parent_email ou student_code correspond
 * - rôle "enseignant" → cherche un Teacher dont email correspond
 * - rôle "parent"     → cherche des Students dont parent_email correspond
 */
export function useCurrentMember() {
  const [userEmail, setUserEmail] = useState(null);
  const currentRole = localStorage.getItem("edugest_role");

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setUserEmail(u.email);
    }).catch(() => {});
  }, []);

  const isStudent = currentRole === "eleve";
  const isTeacher = currentRole === "enseignant";
  const isParent = currentRole === "parent";

  // Fetch the linked teacher record
  const { data: teacherRecord } = useQuery({
    queryKey: ["my_teacher", userEmail],
    queryFn: async () => {
      const res = await base44.entities.Teacher.filter({ email: userEmail });
      return res[0] || null;
    },
    enabled: !!userEmail && isTeacher,
  });

  // Fetch the linked student record (by parent_email for student role, matching own email pattern)
  const { data: studentRecord } = useQuery({
    queryKey: ["my_student", userEmail],
    queryFn: async () => {
      // Try to match via parent_email field used as student email link
      // Convention : student has parent_email === userEmail OR we match by student email stored in parent_email
      const byParentEmail = await base44.entities.Student.filter({ parent_email: userEmail });
      if (byParentEmail.length > 0) return byParentEmail[0];
      return null;
    },
    enabled: !!userEmail && isStudent,
  });

  // Fetch children for parent role
  const { data: childrenRecords = [] } = useQuery({
    queryKey: ["my_children", userEmail],
    queryFn: () => base44.entities.Student.filter({ parent_email: userEmail }),
    enabled: !!userEmail && isParent,
  });

  return {
    userEmail,
    currentRole,
    isStudent,
    isTeacher,
    isParent,
    // For students: their own Student record
    myStudent: studentRecord || null,
    myStudentId: studentRecord?.id || null,
    // For teachers: their Teacher record
    myTeacher: teacherRecord || null,
    myTeacherId: teacherRecord?.id || null,
    myTeacherSubjectIds: teacherRecord?.subject_ids || [],
    // For parents: their children
    myChildren: childrenRecords,
    myChildrenIds: childrenRecords.map(c => c.id),
    // Resolved: is the member linked to a real entity?
    isLinked: isStudent ? !!studentRecord : isTeacher ? !!teacherRecord : isParent ? childrenRecords.length > 0 : true,
  };
}