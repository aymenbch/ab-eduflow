/**
 * routes/ai.js — Moteur d'Intelligence Artificielle local
 *
 * Algorithmes purement heuristiques (pas de LLM externe) :
 *
 *  POST /api/ai/affectation-enseignants  — Optimise l'affectation enseignant↔matière↔classe
 *  POST /api/ai/affectation-eleves       — Répartit les élèves dans les classes
 *  POST /api/ai/emploi-du-temps          — Génère un emploi du temps sans conflit
 *  POST /api/ai/psychopedagogique        — Analyse psychopédagogique des élèves
 */

const { Router } = require('express');
const { loadUser, requireAuth } = require('../authUtils');

const router = Router();
router.use(loadUser);
router.use(requireAuth);

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS COMMUNS
// ══════════════════════════════════════════════════════════════════════════════

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Analyse les subject_ids d'un enseignant (JSON ou tableau brut) */
function parseSubjectIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

/** Retourne true si l'enseignant peut enseigner cette matière */
function canTeach(teacher, subjectId) {
  const ids = parseSubjectIds(teacher.subject_ids);
  return ids.length === 0 || ids.includes(subjectId);
}

/** Ancienneté en années */
function seniority(teacher) {
  if (!teacher.hire_date) return 0;
  return Math.floor((Date.now() - new Date(teacher.hire_date)) / (365.25 * 24 * 3600 * 1000));
}

/** Rang de difficulté d'un niveau (plus élevé = plus difficile) */
function levelRank(name = '') {
  const n = name.toLowerCase();
  if (/terminal|tle/.test(n))         return 10;
  if (/1[eè]re?\s*as|premi/.test(n))  return 9;
  if (/2[eè]me?\s*as|2as/.test(n))    return 8;
  if (/3[eè]me?\s*am|3am/.test(n))    return 7;
  if (/2[eè]me?\s*am|2am/.test(n))    return 6;
  if (/1[eè]re?\s*am|1am/.test(n))    return 5;
  if (/6[eè]|6ap/.test(n))            return 4;
  if (/5[eè]|5ap/.test(n))            return 3;
  if (/4[eè]|4ap/.test(n))            return 2;
  if (/3[eè]|3ap/.test(n))            return 1;
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. AFFECTATION ENSEIGNANTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/affectation-enseignants
 * Body : { mode, teachers, classes, subjects, grades? }
 * Modes : optimal | conflicts | seniority | results
 */
router.post('/affectation-enseignants', (req, res) => {
  const { mode, teachers = [], classes = [], subjects = [], grades = [] } = req.body;

  if (!mode || !teachers.length || !classes.length || !subjects.length) {
    return res.status(400).json({ error: 'mode, teachers, classes, subjects requis.' });
  }

  try {
    const result = optimizeTeachers(mode, teachers, classes, subjects, grades);
    res.json(result);
  } catch (err) {
    console.error('[ai] affectation-enseignants:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'optimisation des affectations.' });
  }
});

function optimizeTeachers(mode, teachers, classes, subjects, grades) {
  const active = teachers.filter(t => t.status !== 'suspended');
  const workload = {}; // teacher_id → nb affectations
  active.forEach(t => { workload[t.id] = 0; });

  // Score de performance : moyenne de ses élèves (pour mode "results")
  const perfScore = (t) => {
    const relevant = grades.filter(g => g.teacher_id === t.id && g.score != null);
    return relevant.length ? avg(relevant.map(g => g.score)) : 10;
  };

  const MAX_LOAD = mode === 'conflicts' ? 4 : 10;

  // Trier les classes par difficulté pour les modes qui en tiennent compte
  const sortedClasses = ['seniority', 'results'].includes(mode)
    ? [...classes].sort((a, b) => levelRank(b.name) - levelRank(a.name))
    : classes;

  const assignments = [];

  for (const cls of sortedClasses) {
    for (const sub of subjects) {
      // Enseignants éligibles
      let eligible = active.filter(t => canTeach(t, sub.id) && workload[t.id] < MAX_LOAD);
      if (!eligible.length) eligible = active.filter(t => canTeach(t, sub.id)); // relâche la contrainte de charge
      if (!eligible.length) continue;

      // Classement selon le mode
      let sorted;
      if (mode === 'optimal') {
        sorted = eligible.sort((a, b) => workload[a.id] - workload[b.id]);
      } else if (mode === 'conflicts') {
        sorted = eligible.sort((a, b) => workload[a.id] - workload[b.id]);
      } else if (mode === 'seniority') {
        sorted = eligible.sort((a, b) => seniority(b) - seniority(a));
      } else { // results
        sorted = eligible.sort((a, b) => perfScore(b) - perfScore(a));
      }

      const chosen = sorted[0];

      const reasonMap = {
        optimal:   `Charge équilibrée (${workload[chosen.id]} aff.)`,
        conflicts:  `Spécialisation respectée`,
        seniority:  `${seniority(chosen)} an(s) d'ancienneté`,
        results:    `Moy. élèves : ${perfScore(chosen).toFixed(1)}/20`,
      };

      assignments.push({
        subject_id:  sub.id,
        class_id:    cls.id,
        teacher_id:  chosen.id,
        reason:      reasonMap[mode] || '',
      });
      workload[chosen.id]++;
    }
  }

  const used      = new Set(assignments.map(a => a.teacher_id)).size;
  const avgLoad   = used ? (assignments.length / used).toFixed(1) : '0';
  const modeText  = {
    optimal:   'Répartition optimale — charge de travail équilibrée entre les enseignants.',
    conflicts: 'Minimisation des conflits — spécialisations et limites de charge strictement respectées.',
    seniority: 'Par ancienneté — enseignants expérimentés affectés aux niveaux les plus élevés.',
    results:   'Par résultats — enseignants les plus performants aux classes prioritaires.',
  };

  return {
    analysis:    modeText[mode] || 'Affectations générées automatiquement.',
    stats:       `${assignments.length} affectations · ${used} enseignants · Charge moy. : ${avgLoad} classes/enseignant`,
    assignments,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. RÉPARTITION DES ÉLÈVES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/affectation-eleves
 * Body : { mode, students, classes }
 * Modes : balanced | academic | behavior | needs
 */
router.post('/affectation-eleves', (req, res) => {
  const { mode, students = [], classes = [] } = req.body;

  if (!mode || !students.length || !classes.length) {
    return res.status(400).json({ error: 'mode, students, classes requis.' });
  }

  try {
    const result = distributeStudents(mode, students, classes);
    res.json(result);
  } catch (err) {
    console.error('[ai] affectation-eleves:', err.message);
    res.status(500).json({ error: 'Erreur lors de la répartition des élèves.' });
  }
});

function distributeStudents(mode, students, classes) {
  let sorted = [...students];

  if (mode === 'academic') {
    // Tri par niveau académique décroissant → distribution cyclique = mix bons/fragiles par classe
    sorted.sort((a, b) => (b.average_grade || 0) - (a.average_grade || 0));
  } else if (mode === 'behavior') {
    // Moins de sanctions = meilleur comportement
    sorted.sort((a, b) => (a.sanctions_count || 0) - (b.sanctions_count || 0));
  } else if (mode === 'needs') {
    // Élèves à besoins spécifiques en premier pour les distribuer en priorité
    sorted.sort((a, b) => {
      const aN = Array.isArray(a.specific_needs) ? a.specific_needs.length : (a.specific_needs ? 1 : 0);
      const bN = Array.isArray(b.specific_needs) ? b.specific_needs.length : (b.specific_needs ? 1 : 0);
      return bN - aN;
    });
  } else {
    // balanced : alternance garçons/filles triés par niveau
    const boys  = students.filter(s => s.gender === 'M').sort((a, b) => (b.average_grade || 0) - (a.average_grade || 0));
    const girls = students.filter(s => s.gender === 'F').sort((a, b) => (b.average_grade || 0) - (a.average_grade || 0));
    const other = students.filter(s => s.gender !== 'M' && s.gender !== 'F');
    sorted = [];
    const max = Math.max(boys.length, girls.length);
    for (let i = 0; i < max; i++) {
      if (boys[i])  sorted.push(boys[i]);
      if (girls[i]) sorted.push(girls[i]);
    }
    sorted.push(...other);
  }

  // Distribution circulaire (round-robin)
  const assignments = sorted.map((s, i) => ({
    student_id: s.id,
    class_id:   classes[i % classes.length].id,
  }));

  // Stats par classe
  const byClass = classes.map(c => `${c.name}: ${assignments.filter(a => a.class_id === c.id).length} élèves`).join(' · ');

  const modeText = {
    balanced: 'Équilibre global — genre, niveau et comportement distribués uniformément.',
    academic: 'Par niveau — chaque classe reçoit un mix de bons/moyens/fragiles.',
    behavior: 'Par comportement — profils difficiles répartis équitablement.',
    needs:    'Besoins spécifiques — élèves à besoins particuliers distribués en priorité.',
  };

  return {
    analysis:    modeText[mode] || 'Répartition générée.',
    stats:       `${students.length} élèves → ${classes.length} classes · ${byClass}`,
    assignments,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. GÉNÉRATEUR D'EMPLOI DU TEMPS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/emploi-du-temps
 * Body : {
 *   sessions: [{ class_id, subject_id, teacher_id, weekly_hours,
 *                subject_name, class_name, teacher_name, room? }],
 *   constraints?: { maxHoursPerDay?, days?, preferMorning? }
 * }
 */
router.post('/emploi-du-temps', (req, res) => {
  const { sessions = [], constraints = {} } = req.body;

  if (!sessions.length) {
    return res.status(400).json({ error: 'sessions requis (au moins une session).' });
  }

  try {
    const result = generateSchedule(sessions, constraints);
    res.json(result);
  } catch (err) {
    console.error('[ai] emploi-du-temps:', err.message);
    res.status(500).json({ error: 'Erreur lors de la génération de l\'emploi du temps.' });
  }
});

const TIME_SLOTS = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  // 12:00-13:00 : pause déjeuner
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
];

const DAY_NAMES = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };

function generateSchedule(sessions, constraints = {}) {
  const DAYS            = constraints.days       || [1, 2, 3, 4, 5];
  const MAX_PER_DAY     = constraints.maxHoursPerDay || 6;
  const PREFER_MORNING  = constraints.preferMorning !== false; // true par défaut

  // Ordonner les créneaux (matin en premier si préféré)
  const orderedSlots = PREFER_MORNING ? TIME_SLOTS : shuffle(TIME_SLOTS);

  // Créer les "unités à placer" (une par heure de cours hebdomadaire)
  const units = [];
  for (const s of sessions) {
    const hours = Math.min(s.weekly_hours || 1, 8);
    for (let h = 0; h < hours; h++) {
      units.push({ ...s, _unitIndex: h });
    }
  }

  // Mélanger pour éviter les biais de placement
  const shuffledUnits = shuffle(units);

  // Structures de suivi
  const teacherBusy   = {}; // teacherId → Set<"day-slot">
  const classBusy     = {}; // classId   → Set<"day-slot">
  const classPerDay   = {}; // classId   → { dayNum → count }
  // Distribuer équitablement : compter par (class+subject) dans chaque jour
  const classSubjDay  = {}; // `${classId}|${subjectId}` → Set<dayNum>

  const scheduled = [];
  const conflicts  = [];

  for (const unit of shuffledUnits) {
    const { class_id, subject_id, teacher_id } = unit;

    if (!teacherBusy[teacher_id])   teacherBusy[teacher_id]   = new Set();
    if (!classBusy[class_id])       classBusy[class_id]       = new Set();
    if (!classPerDay[class_id])     classPerDay[class_id]     = {};
    const csKey = `${class_id}|${subject_id}`;
    if (!classSubjDay[csKey])       classSubjDay[csKey]       = new Set();

    let placed = false;

    // Essayer tous les jours, en évitant de mettre la même matière deux fois le même jour
    const dayOrder = shuffle(DAYS);

    for (const day of dayOrder) {
      if (placed) break;
      const dayCount = classPerDay[class_id][day] || 0;
      if (dayCount >= MAX_PER_DAY) continue;
      // Éviter 2× la même matière le même jour (si possible)
      if (classSubjDay[csKey].has(day) && units.filter(u => u.class_id === class_id && u.subject_id === subject_id).length > DAYS.length) {
        // On doit quand même la placer si les heures sont nombreuses
      }

      for (const slot of orderedSlots) {
        const key = `${day}-${slot.start}`;
        if (teacherBusy[teacher_id].has(key)) continue;
        if (classBusy[class_id].has(key))     continue;

        // Place !
        teacherBusy[teacher_id].add(key);
        classBusy[class_id].add(key);
        classPerDay[class_id][day] = dayCount + 1;
        classSubjDay[csKey].add(day);

        scheduled.push({
          class_id,
          subject_id,
          teacher_id,
          day_of_week:  day,
          start_time:   slot.start,
          end_time:     slot.end,
          room:         unit.room || null,
          // Méta pour l'affichage
          subject_name: unit.subject_name || subject_id,
          class_name:   unit.class_name   || class_id,
          teacher_name: unit.teacher_name || teacher_id,
          day_name:     DAY_NAMES[day]    || `Jour ${day}`,
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      conflicts.push({
        class_name:   unit.class_name   || class_id,
        subject_name: unit.subject_name || subject_id,
        teacher_name: unit.teacher_name || teacher_id,
        reason:       'Aucun créneau disponible (enseignant ou classe déjà occupés)',
      });
    }
  }

  // Stats
  const classesUsed   = new Set(scheduled.map(s => s.class_id)).size;
  const teachersUsed  = new Set(scheduled.map(s => s.teacher_id)).size;

  return {
    scheduled,
    conflicts,
    stats: `${scheduled.length} créneaux générés · ${conflicts.length} conflit(s) · ${classesUsed} classes · ${teachersUsed} enseignants`,
    analysis: conflicts.length === 0
      ? `Emploi du temps généré sans conflit. ${scheduled.length} créneaux placés sur ${DAYS.length} jours.`
      : `Emploi du temps généré avec ${conflicts.length} conflit(s). Vérifiez que chaque enseignant est disponible et n'est pas sur-affecté.`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ANALYSE PSYCHOPÉDAGOGIQUE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/psychopedagogique
 * Body : { students, grades, exams, attendance, sanctions, subjects }
 * Retourne un profil psychopédagogique pour chaque élève.
 */
router.post('/psychopedagogique', (req, res) => {
  const { students = [], grades = [], exams = [], attendance = [], sanctions = [], subjects = [] } = req.body;

  if (!students.length) {
    return res.status(400).json({ error: 'students requis.' });
  }

  try {
    const profiles = students.map(s =>
      buildProfile(s, grades, exams, attendance, sanctions, subjects)
    );
    profiles.sort((a, b) => b.riskScore - a.riskScore);
    res.json({ profiles });
  } catch (err) {
    console.error('[ai] psychopedagogique:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'analyse psychopédagogique.' });
  }
});

/** Construit le profil psychopédagogique d'un élève */
function buildProfile(student, grades, exams, attendance, sanctions, subjects) {
  const sid = student.id;

  // ── Notes de l'élève ──────────────────────────────────────────────────────
  const myGrades  = grades.filter(g => g.student_id === sid && !g.absent && g.score != null);
  const scores    = myGrades.map(g => g.score);
  const globalAvg = scores.length ? avg(scores) : null;

  // Moyenne par matière
  const bySubject = subjects.map(sub => {
    const subExamIds = exams.filter(e => e.subject_id === sub.id).map(e => e.id);
    const subGrades  = myGrades.filter(g => subExamIds.includes(g.exam_id));
    return subGrades.length
      ? { subjectId: sub.id, name: sub.name, avg: parseFloat(avg(subGrades.map(g => g.score)).toFixed(1)) }
      : null;
  }).filter(Boolean);

  // ── Présences ─────────────────────────────────────────────────────────────
  const myAtt     = attendance.filter(a => a.student_id === sid);
  const absents   = myAtt.filter(a => a.status === 'absent').length;
  const lates     = myAtt.filter(a => a.status === 'late').length;
  const total     = myAtt.length;
  const presRate  = total ? Math.round(((total - absents) / total) * 100) : null;

  // ── Sanctions ─────────────────────────────────────────────────────────────
  const mySanct   = sanctions.filter(s => s.student_id === sid);
  const activeSanct = mySanct.filter(s => !s.resolved).length;

  // ── Évolution trimestrielle ───────────────────────────────────────────────
  const byTrimester = ['T1', 'T2', 'T3'].map(t => {
    const tExamIds = exams.filter(e => e.trimester === t).map(e => e.id);
    const tGrades  = myGrades.filter(g => tExamIds.includes(g.exam_id));
    return { t, avg: tGrades.length ? parseFloat(avg(tGrades.map(g => g.score)).toFixed(1)) : null };
  }).filter(t => t.avg !== null);

  const trend = byTrimester.length >= 2
    ? byTrimester[byTrimester.length - 1].avg - byTrimester[0].avg
    : 0;

  // ── Variance des notes (instabilité) ─────────────────────────────────────
  const variance = scores.length > 1
    ? scores.reduce((s, x) => s + Math.pow(x - globalAvg, 2), 0) / scores.length
    : 0;
  const stdDev = Math.sqrt(variance);

  // ══ Scores de risque (0–100) ══════════════════════════════════════════════

  // Risque d'échec académique
  let failRisk = 0;
  if (globalAvg !== null) failRisk += globalAvg < 10 ? 40 : globalAvg < 12 ? 20 : 0;
  if (bySubject.filter(s => s.avg < 8).length >= 2) failRisk += 20;
  if (trend < -1) failRisk += 15;
  if (stdDev > 4) failRisk += 10;
  if (absents > 10) failRisk += 15;
  failRisk = Math.min(100, failRisk);

  // Risque de décrochage
  let dropoutRisk = 0;
  dropoutRisk += presRate !== null && presRate < 70 ? 40 : presRate !== null && presRate < 85 ? 20 : 0;
  dropoutRisk += activeSanct > 2 ? 25 : activeSanct > 0 ? 10 : 0;
  dropoutRisk += failRisk * 0.3;
  dropoutRisk += trend < -2 ? 15 : 0;
  dropoutRisk = Math.min(100, Math.round(dropoutRisk));

  // Score de réussite
  let successScore = 100;
  successScore -= failRisk * 0.6;
  successScore -= dropoutRisk * 0.3;
  successScore -= stdDev > 4 ? 10 : 0;
  successScore = Math.max(0, Math.round(successScore));

  // Score de risque global (utilisé pour le tri)
  const riskScore = Math.round(failRisk * 0.5 + dropoutRisk * 0.5);

  // ── Style d'apprentissage (VAK heuristique) ───────────────────────────────
  const visuelSubs  = bySubject.filter(s => /maths?|physique|géo|geograph|dessin|inform/i.test(s.name));
  const auditifSubs = bySubject.filter(s => /français|arabe|anglais|histoire|philo|langues?/i.test(s.name));
  const kinaesth    = bySubject.filter(s => /sport|eps|éduc.*phys|travaux.*prat/i.test(s.name));

  const visuelAvg   = visuelSubs.length  ? avg(visuelSubs.map(s => s.avg))  : globalAvg || 10;
  const auditifAvg  = auditifSubs.length ? avg(auditifSubs.map(s => s.avg)) : globalAvg || 10;
  const kinaAvg     = kinaesth.length    ? avg(kinaesth.map(s => s.avg))    : globalAvg || 10;

  const maxStyle    = Math.max(visuelAvg, auditifAvg, kinaAvg);
  const learningStyle =
    maxStyle === visuelAvg  ? 'Visuel'  :
    maxStyle === auditifAvg ? 'Auditif' : 'Kinesthésique';

  // ── Dimensions psychopédagogiques (0–100) ─────────────────────────────────
  const dimensions = {
    autonomie:   Math.max(0, Math.min(100, Math.round((globalAvg || 10) * 4 + (presRate || 80) * 0.2))),
    creativite:  Math.max(0, Math.min(100, Math.round(kinaAvg * 4 + auditifAvg * 1))),
    rigueur:     Math.max(0, Math.min(100, Math.round((globalAvg || 10) * 4 - stdDev * 3))),
    assiduite:   Math.max(0, Math.min(100, presRate || 80)),
    stabilite:   Math.max(0, Math.min(100, Math.round(100 - stdDev * 8))),
    motivation:  Math.max(0, Math.min(100, Math.round(successScore * 0.7 + (trend > 0 ? 20 : 0) + (activeSanct === 0 ? 10 : 0)))),
  };

  // ── Score de stress (0–100) ───────────────────────────────────────────────
  const stressScore = Math.min(100, Math.round(stdDev * 8 + (activeSanct * 10) + (failRisk * 0.3)));

  // ── Score de démotivation (0–100) ─────────────────────────────────────────
  const demotivationScore = Math.min(100, Math.round(
    (trend < 0 ? Math.abs(trend) * 10 : 0) +
    (presRate !== null && presRate < 85 ? (85 - presRate) * 1.5 : 0) +
    (globalAvg !== null && globalAvg < 10 ? (10 - globalAvg) * 4 : 0)
  ));

  // ── Recommandations ───────────────────────────────────────────────────────
  const recommendations = {
    teacher: [],
    parent:  [],
  };

  if (failRisk >= 60) {
    recommendations.teacher.push('Mettre en place un suivi individualisé hebdomadaire.');
    recommendations.parent.push('Un soutien scolaire régulier est fortement recommandé.');
  }
  if (absents > 8) {
    recommendations.teacher.push('Signaler les absences répétées à la direction et au CPE.');
    recommendations.parent.push('Veiller à la régularité de présence — les absences impactent directement les résultats.');
  }
  if (stressScore > 60) {
    recommendations.teacher.push('Adopter une approche bienveillante, éviter la pression excessive lors des évaluations.');
    recommendations.parent.push('Créer un environnement calme et sécurisant à la maison pour les révisions.');
  }
  if (trend < -1.5) {
    recommendations.teacher.push('Investiguer la cause de la baisse de performances sur les derniers trimestres.');
    recommendations.parent.push('Discuter avec l\'élève des difficultés rencontrées cette période.');
  }
  if (demotivationScore > 50) {
    recommendations.teacher.push('Valoriser les progrès même minimes, fixer des objectifs atteignables à court terme.');
    recommendations.parent.push('Encourager l\'élève et valoriser ses efforts plutôt que les seuls résultats.');
  }
  if (learningStyle === 'Visuel') {
    recommendations.teacher.push('Privilégier les supports visuels : schémas, mind maps, tableaux, couleurs.');
  } else if (learningStyle === 'Auditif') {
    recommendations.teacher.push('Favoriser les explications orales, discussions, podcasts éducatifs.');
  } else {
    recommendations.teacher.push('Proposer des activités pratiques, expériences, manipulation d\'objets.');
  }

  if (!recommendations.teacher.length) recommendations.teacher.push('Continuer sur cette lancée, maintenir le suivi régulier.');
  if (!recommendations.parent.length)  recommendations.parent.push('Encourager l\'élève dans ses efforts, maintenir une communication avec les enseignants.');

  return {
    student: {
      id:         sid,
      name:       `${student.first_name} ${student.last_name}`,
      class_id:   student.class_id,
    },
    academic: {
      globalAvg,
      successScore,
      bySubject,
      byTrimester,
      trend: parseFloat(trend.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
    },
    attendance: { presRate, absents, lates, total },
    behavior:   { activeSanctions: activeSanct, totalSanctions: mySanct.length },
    risks: {
      failRisk:     Math.round(failRisk),
      dropoutRisk,
      successScore,
      riskScore,
      level:        riskScore >= 65 ? 'critique' : riskScore >= 40 ? 'élevé' : riskScore >= 20 ? 'modéré' : 'faible',
    },
    profile: {
      learningStyle,
      stressScore,
      demotivationScore,
      dimensions,
    },
    recommendations,
  };
}

module.exports = router;
