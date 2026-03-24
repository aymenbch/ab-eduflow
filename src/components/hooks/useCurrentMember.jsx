import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";

/**
 * Hook qui détecte l'utilisateur connecté via la session EduGest (AppUser)
 * et le lie à son entité métier (Student, Teacher, etc.)
 */
export function useCurrentMember() {
  const session = getSession();

  // Fallback to legacy role for non-session users (admin via Base44 auth)
  const currentRole = session?.role || localStorage.getItem("edugest_role");
  const memberId = session?.member_id || null;
  const memberType = session?.member_type || null;

  const isStudent = currentRole === "eleve";
  const isTeacher = currentRole === "enseignant";
  const isParent = currentRole === "parent";

  // Fetch the linked Student record
  const { data: studentRecord } = useQuery({
    queryKey: ["my_student_by_id", memberId],
    queryFn: () => base44.entities.Student.get(memberId),
    enabled: !!memberId && memberType === "Student",
  });

  // Fetch the linked Teacher record
  const { data: teacherRecord } = useQuery({
    queryKey: ["my_teacher_by_id", memberId],
    queryFn: () => base44.entities.Teacher.get(memberId),
    enabled: !!memberId && memberType === "Teacher",
  });

  // For parents: fetch children via StudentGuardian in a single query (links + student records)
  const { data: childrenByGuardian = [] } = useQuery({
    queryKey: ["my_children_by_guardian", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const links = await base44.entities.StudentGuardian.filter({ parent_id: memberId });
      if (!links?.length) return [];
      const results = await Promise.all(
        links.map(g =>
          base44.entities.Student.get(g.student_id)
            .catch(() => null)
        )
      );
      return results.filter(Boolean);
    },
    enabled: !!memberId && isParent,
  });

  // Also fetch by parent_email stored on Student (legacy — runs always to catch children not yet in StudentGuardian)
  const { data: childrenByEmail = [] } = useQuery({
    queryKey: ["my_children_by_email", session?.login],
    queryFn: () => base44.entities.Student.filter({ parent_email: session?.login }),
    enabled: isParent && !!session?.login,
  });

  // Merge both sources, deduplicate by id
  const myChildren = [...childrenByGuardian, ...childrenByEmail]
    .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

  return {
    session,
    currentRole,
    memberId,
    memberType,
    isStudent,
    isTeacher,
    isParent,
    // For students
    myStudent: studentRecord || null,
    myStudentId: studentRecord?.id || memberId || null,
    // For teachers
    myTeacher: teacherRecord || null,
    myTeacherId: teacherRecord?.id || memberId || null,
    myTeacherSubjectIds: teacherRecord?.subject_ids || [],
    // For parents
    myChildren,
    myChildrenIds: myChildren.map(c => c.id),
    // Is linked to a real entity?
    isLinked: isStudent ? !!studentRecord : isTeacher ? !!teacherRecord : isParent ? myChildren.length > 0 : true,
    // Legacy
    userEmail: session?.login || null,
  };
}