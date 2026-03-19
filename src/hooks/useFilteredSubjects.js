/**
 * useFilteredSubjects — Filtre contextuel des matières selon les règles métier.
 *
 * Règles appliquées :
 *  F1 — Par niveau de classe  : si classId est fourni, on ne propose que les matières
 *       dont le `level` correspond à celui de la classe (ou les matières "Tous niveaux").
 *  F2 — Par enseignant        : géré côté serveur via applyAccessFilter (rôle enseignant).
 *  RG-MAT-03 — Statut actif   : les matières inactives (archivées) sont exclues des
 *       listes de sélection (sauf si includeInactive = true).
 *
 * @param {object} options
 * @param {string|null}  options.classId        — ID de la classe ciblée (pour F1)
 * @param {string|null}  options.level          — Niveau direct (alternative à classId)
 * @param {boolean}      options.includeInactive — Inclure les matières archivées (défaut: false)
 * @param {object[]}     options.allSubjects     — Liste complète déjà chargée (évite un fetch)
 * @param {object[]}     options.allClasses      — Liste complète des classes déjà chargée
 *
 * @returns {{ subjects: object[], isLoading: boolean }}
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useFilteredSubjects({
  classId = null,
  level = null,
  includeInactive = false,
  allSubjects = null,
  allClasses = null,
} = {}) {
  // Charger les matières si non fournies
  const { data: fetchedSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
    enabled: allSubjects === null,
  });

  // Charger les classes si classId fourni et classes non fournies
  const { data: fetchedClasses = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => base44.entities.Class.list(),
    enabled: classId !== null && allClasses === null,
  });

  const subjects = allSubjects ?? fetchedSubjects;
  const classes  = allClasses  ?? fetchedClasses;

  const filtered = useMemo(() => {
    // Résoudre le niveau à partir du classId si level non fourni directement
    let targetLevel = level;
    if (!targetLevel && classId) {
      const cls = classes.find((c) => c.id === classId);
      targetLevel = cls?.level || null;
    }

    return subjects.filter((s) => {
      // RG-MAT-03 : exclure les inactives par défaut
      if (!includeInactive && s.status === 'inactive') return false;

      // F1 : filtre par niveau
      if (targetLevel && s.level && s.level !== 'Tous niveaux') {
        if (s.level !== targetLevel) return false;
      }

      return true;
    });
  }, [subjects, classes, classId, level, includeInactive]);

  return {
    subjects: filtered,
    isLoading: loadingSubjects || loadingClasses,
  };
}
