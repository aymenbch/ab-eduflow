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
    queryFn: () => base44.entities.Student.filter({ id: memberId }),
    enabled: !!memberId && memberType === "Student",
    select: (data) => data[0] || null,
  });

  // Fetch the linked Teacher record
  const { data: teacherRecord } = useQuery({
    queryKey: ["my_teacher_by_id", memberId],
    queryFn: () => base44.entities.Teacher.filter({ id: memberId }),
    enabled: !!memberId && memberType === "Teacher",
    select: (data) => data[0] || null,
  });

  // For parents: fetch their children (students linked by parent_email or by a parent AppUser member_id pointing to a Student)
  // Convention: parent's member_id = first child's id OR we match by parent_email stored on Student
  const { data: childrenByMember = [] } = useQuery({
    queryKey: ["my_children_by_member", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      // Try direct child link first
      const direct = await base44.entities.Student.filter({ id: memberId });
      if (direct.length > 0) return direct;
      // Otherwise fetch by parent having same id
      return [];
    },
    enabled: !!memberId && isParent && memberType === "Student",
  });

  // Fallback: if parent has no member_id, use email from session login
  const { data: childrenByEmail = [] } = useQuery({
    queryKey: ["my_children_by_email", session?.login],
    queryFn: () => base44.entities.Student.filter({ parent_email: session?.login }),
    enabled: isParent && !!session?.login && !memberId,
  });

  const myChildren = childrenByMember.length > 0 ? childrenByMember : childrenByEmail;

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