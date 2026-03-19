/**
 * useGradeStats — Hook React Query pour les statistiques de notes.
 *
 * Exploite le cache React Query : si les données sont déjà chargées
 * dans la page, aucune requête réseau supplémentaire n'est émise.
 *
 * Usage :
 *   const { getStudentStats, getClassStats, getClassRanking } = useGradeStats();
 *   const { overall, bySubject, byTrimester, monthly } = getStudentStats("student-uuid");
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  studentWeightedAvg,
  subjectAveragesForStudent,
  trimesterAverages,
  monthlyEvolution,
  rankStudents,
  classStats,
} from '@/utils/gradeUtils';

export function useGradeStats() {
  const { data: grades   = [] } = useQuery({ queryKey: ['grades'],   queryFn: () => base44.entities.Grade.list() });
  const { data: exams    = [] } = useQuery({ queryKey: ['exams'],    queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => base44.entities.Subject.list() });
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => base44.entities.Student.list() });

  return {
    // Données brutes (pour les composants qui en ont besoin directement)
    grades,
    exams,
    subjects,
    students,

    /**
     * Statistiques complètes d'un élève.
     * @param {string} studentId
     * @param {{ trimester?: string }} options
     * @returns {{ overall, bySubject, byTrimester, monthly }}
     */
    getStudentStats(studentId, options = {}) {
      if (!studentId) return { overall: null, bySubject: [], byTrimester: {}, monthly: [] };
      return {
        overall:     studentWeightedAvg(studentId, grades, exams, subjects, options),
        bySubject:   subjectAveragesForStudent(studentId, grades, exams, subjects, options),
        byTrimester: trimesterAverages(studentId, grades, exams, subjects),
        monthly:     monthlyEvolution(studentId, grades, exams),
      };
    },

    /**
     * Classement pondéré des élèves d'une classe.
     * @param {string} classId
     * @param {{ trimester?: string }} options
     * @returns {Array<{ id, avg }>}  trié par avg décroissant
     */
    getClassRanking(classId, options = {}) {
      const classStudents = students.filter(
        s => s.class_id === classId && s.status === 'active'
      );
      return rankStudents(classStudents, grades, exams, subjects, options);
    },

    /**
     * Statistiques globales d'une classe.
     * @param {string} classId
     * @param {{ trimester?: string }} options
     * @returns {{ avg, successRate, dispersion, count }}
     */
    getClassStats(classId, options = {}) {
      return classStats(classId, students, grades, exams, options);
    },

    /**
     * Classement de tous les élèves actifs de l'établissement.
     * @param {{ trimester?: string }} options
     * @returns {Array<{ id, avg }>}
     */
    getSchoolRanking(options = {}) {
      return rankStudents(
        students.filter(s => s.status === 'active'),
        grades, exams, subjects, options
      );
    },
  };
}
