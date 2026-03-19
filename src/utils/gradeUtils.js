/**
 * gradeUtils.js — Fonctions pures de calcul des moyennes scolaires
 *
 * Aucune dépendance React / API.
 * Toutes les fonctions sont déterministes : même entrée → même sortie.
 *
 * Convention :
 *  - "valid grade" = !g.absent && g.score != null
 *  - "trimester"   = 'T1' | 'T2' | 'T3' | 'all' (default 'all')
 *  - avg            = null si aucune donnée disponible
 */

// ─── Filtres de base ─────────────────────────────────────────────────────────

/**
 * Résout le "trimestre effectif" d'un examen.
 * Priorité : exam.trimester → order de la Period liée (1→T1, 2→T2, 3+→T3).
 * Retourne null si impossible à déterminer.
 *
 * @param {object}   exam
 * @param {object[]} periods — tableau de Period (optionnel)
 */
export function examEffectiveTrimester(exam, periods = []) {
  if (exam.trimester) return exam.trimester;
  if (exam.period_id && periods.length) {
    const p = periods.find(x => x.id === exam.period_id);
    if (p) {
      const order = p.order ?? 1;
      return order === 1 ? 'T1' : order === 2 ? 'T2' : 'T3';
    }
  }
  return null;
}

/**
 * Filtre les notes valides (non-absent, score non-null).
 * Options optionnelles :
 *   studentId  — restreint à un élève
 *   examIds    — restreint à une liste d'exams
 *   trimester  — restreint à un trimestre (via exam.trimester ou period.order)
 *   exams      — tableau d'examens (requis si trimester !== 'all')
 *   periods    — tableau de Period (pour résoudre period_id quand trimester manque)
 */
export function filterValidGrades(grades, { studentId, examIds, trimester, exams, periods } = {}) {
  return grades.filter(g => {
    if (g.absent || g.score == null) return false;
    if (studentId && g.student_id !== studentId) return false;
    if (examIds && !examIds.includes(g.exam_id)) return false;
    if (trimester && trimester !== 'all') {
      const exam = exams?.find(e => e.id === g.exam_id);
      if (!exam) return false;
      if (examEffectiveTrimester(exam, periods) !== trimester) return false;
    }
    return true;
  });
}

// ─── Calculs élémentaires ─────────────────────────────────────────────────────

/**
 * Moyenne arithmétique d'un tableau de scores.
 * Retourne null si le tableau est vide.
 */
export function simpleAvg(scores) {
  if (!scores || !scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Moyenne pondérée par les coefficients matière.
 * grades doivent être déjà filtrés (valid).
 * Retourne null si aucune donnée.
 */
export function weightedAvg(grades, exams, subjects) {
  if (!grades.length) return null;
  let weightedSum = 0;
  let totalCoef = 0;
  for (const g of grades) {
    const exam = exams.find(e => e.id === g.exam_id);
    const subj = subjects.find(s => s.id === exam?.subject_id);
    const coef = subj?.coefficient || 1;
    weightedSum += g.score * coef;
    totalCoef += coef;
  }
  return totalCoef > 0 ? weightedSum / totalCoef : null;
}

/**
 * Moyenne pondérée à partir de lignes pré-calculées {avg, coef}.
 * Utilisé pour le bulletin où les moyennes par matière sont déjà connues.
 */
export function weightedAvgFromRows(rows) {
  const valid = rows.filter(r => r.avg !== null && r.avg !== undefined);
  if (!valid.length) return null;
  const tw = valid.reduce((sum, r) => sum + r.avg * (r.coef || 1), 0);
  const tc = valid.reduce((sum, r) => sum + (r.coef || 1), 0);
  return tc > 0 ? tw / tc : null;
}

// ─── Statistiques par élève ───────────────────────────────────────────────────

/**
 * Moyenne générale pondérée d'un élève.
 * Retourne null si pas de notes.
 *
 * @param {string}   studentId
 * @param {object[]} grades     — toutes les notes
 * @param {object[]} exams      — tous les examens
 * @param {object[]} subjects   — toutes les matières
 * @param {{ trimester?: string }} options
 */
export function studentWeightedAvg(studentId, grades, exams, subjects, { trimester = 'all' } = {}) {
  const valid = filterValidGrades(grades, { studentId, trimester, exams });
  return weightedAvg(valid, exams, subjects);
}

/**
 * Moyennes par matière pour un élève.
 * Retourne un tableau de { subject, avg, coef, count, lastScore, trend }.
 *   trend = 'up' | 'down' | 'stable'
 *
 * @param {string}   studentId
 * @param {object[]} grades
 * @param {object[]} exams
 * @param {object[]} subjects
 * @param {{ trimester?: string }} options
 * @returns {Array}
 */
export function subjectAveragesForStudent(studentId, grades, exams, subjects, { trimester = 'all', periods = [] } = {}) {
  const studentValidGrades = filterValidGrades(grades, { studentId });

  return subjects.map(sub => {
    const subExams = exams.filter(e =>
      e.subject_id === sub.id &&
      (trimester === 'all' || examEffectiveTrimester(e, periods) === trimester)
    );
    if (!subExams.length) return null;

    const subGrades = studentValidGrades.filter(g => subExams.some(e => e.id === g.exam_id));
    if (!subGrades.length) return null;

    const scores = subGrades.map(g => g.score);
    const avg = simpleAvg(scores);

    // Calcul de la tendance (comparaison deux dernières notes par date d'examen)
    const sorted = [...subGrades].sort((a, b) => {
      const da = exams.find(e => e.id === a.exam_id)?.date ?? '';
      const db = exams.find(e => e.id === b.exam_id)?.date ?? '';
      return da.localeCompare(db);
    });
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const trend = prev
      ? (last.score > prev.score ? 'up' : last.score < prev.score ? 'down' : 'stable')
      : 'stable';

    return {
      subject:   sub,
      avg,
      coef:      sub.coefficient || 1,
      count:     subGrades.length,
      lastScore: last?.score ?? null,
      trend,
      passCount: scores.filter(s => s >= 10).length,
    };
  }).filter(Boolean);
}

/**
 * Moyennes par trimestre (pondérées) pour un élève.
 * Retourne { T1: number|null, T2: number|null, T3: number|null }.
 */
export function trimesterAverages(studentId, grades, exams, subjects) {
  return Object.fromEntries(
    ['T1', 'T2', 'T3'].map(t => [
      t,
      studentWeightedAvg(studentId, grades, exams, subjects, { trimester: t }),
    ])
  );
}

/**
 * Évolution mensuelle des notes d'un élève.
 * Retourne un tableau de { month: "MM/YY", avg } trié chronologiquement.
 */
export function monthlyEvolution(studentId, grades, exams) {
  const valid = filterValidGrades(grades, { studentId });
  const byMonth = {};
  valid.forEach(g => {
    const exam = exams.find(e => e.id === g.exam_id);
    if (!exam?.date) return;
    const key = exam.date.slice(0, 7); // "YYYY-MM"
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(g.score);
  });
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, scores]) => ({
      month: key.slice(5) + '/' + key.slice(2, 4), // "MM/YY"
      avg:   simpleAvg(scores),
    }));
}

// ─── Classement ───────────────────────────────────────────────────────────────

/**
 * Classe un tableau d'élèves par moyenne pondérée décroissante.
 * Retourne [{ id, avg }, ...] — avg = 0 si pas de notes.
 *
 * @param {object[]} students  — élèves à classer
 * @param {object[]} grades
 * @param {object[]} exams
 * @param {object[]} subjects
 * @param {{ trimester?: string }} options
 */
export function rankStudents(students, grades, exams, subjects, { trimester = 'all' } = {}) {
  return students
    .map(s => ({
      id:  s.id,
      avg: studentWeightedAvg(s.id, grades, exams, subjects, { trimester }) ?? 0,
    }))
    .sort((a, b) => b.avg - a.avg);
}

// ─── Statistiques classe ──────────────────────────────────────────────────────

/**
 * Statistiques globales d'une classe.
 * Retourne { avg, successRate, dispersion, count }.
 *
 * @param {string}   classId
 * @param {object[]} students
 * @param {object[]} grades
 * @param {object[]} exams
 * @param {{ trimester?: string }} options
 */
export function classStats(classId, students, grades, exams, { trimester = 'all' } = {}) {
  const classStudentIds = students.filter(s => s.class_id === classId).map(s => s.id);
  const classExamIds    = exams.filter(e => e.class_id === classId).map(e => e.id);

  const filtered = grades.filter(g =>
    classStudentIds.includes(g.student_id) &&
    classExamIds.includes(g.exam_id) &&
    !g.absent &&
    g.score != null &&
    (trimester === 'all' || exams.find(e => e.id === g.exam_id)?.trimester === trimester)
  );

  if (!filtered.length) return { avg: null, successRate: null, dispersion: null, count: 0 };

  const scores = filtered.map(g => g.score);
  const avg    = simpleAvg(scores);

  const successRate = (scores.filter(s => s >= 10).length / scores.length) * 100;

  let dispersion = null;
  if (scores.length > 1 && avg !== null) {
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / scores.length;
    dispersion = Math.sqrt(variance);
  }

  return { avg, successRate, dispersion, count: filtered.length };
}

/**
 * Moyenne de classe pour une matière donnée (pour le bulletin).
 * subjectId : matière
 * classStudents : élèves de la classe
 * trimExams : examens déjà filtrés sur la période/classe
 * allGrades : toutes les notes
 */
export function subjectClassAvg(subjectId, classStudents, trimExams, allGrades) {
  const subExams = trimExams.filter(e => e.subject_id === subjectId);
  if (!subExams.length) return null;
  const scores = subExams.flatMap(exam =>
    classStudents.map(s => {
      const g = allGrades.find(g => g.exam_id === exam.id && g.student_id === s.id);
      return g && !g.absent && g.score != null ? g.score : null;
    })
  ).filter(s => s !== null);
  return simpleAvg(scores);
}

// ─── Utilitaires d'affichage ──────────────────────────────────────────────────

/**
 * Mention scolaire française à partir d'une moyenne.
 * Retourne { label: string, color: string (hex) }.
 */
export function getMention(avg) {
  if (avg === null || avg === undefined) return { label: '—', color: '#6b7280' };
  if (avg >= 16) return { label: 'Très Bien',   color: '#16a34a' };
  if (avg >= 14) return { label: 'Bien',         color: '#2563eb' };
  if (avg >= 12) return { label: 'Assez Bien',   color: '#7c3aed' };
  if (avg >= 10) return { label: 'Passable',     color: '#d97706' };
  return              { label: 'Insuffisant',    color: '#dc2626' };
}

/**
 * Couleur CSS en fonction d'une moyenne /20.
 * Retourne une classe Tailwind (text-*).
 */
export function avgColorClass(avg) {
  if (avg === null || avg === undefined) return 'text-slate-400';
  if (avg >= 14) return 'text-green-600';
  if (avg >= 10) return 'text-blue-600';
  return 'text-red-600';
}
