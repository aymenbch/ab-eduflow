import React, { useMemo, useState } from "react";
import SignaturePad from "./SignaturePad";
import { simpleAvg, weightedAvgFromRows, subjectClassAvg, getMention } from "@/utils/gradeUtils";

export default function BulletinPreview({
  student, period, cls, teachers, grades, exams, subjects, attendance, allClassStudents, allGrades
}) {
  const [signatures, setSignatures] = useState({ directeur: null, profPrincipal: null, parent: null });
  const mainTeacher = teachers.find(t => t.id === cls?.main_teacher_id);

  // period can be a real Period object (with .id) or a legacy object {id:"T1", name:"Trimestre 1"}
  const isLegacyPeriod = period && !period.school_year_id;

  const data = useMemo(() => {
    // ── Filtrer les examens selon la période ─────────────────────────────────
    const trimExams = exams.filter(e => {
      if (e.class_id !== cls?.id) return false;
      if (!period) return true;
      return isLegacyPeriod ? e.trimester === period.id : e.period_id === period.id;
    });

    // ── Lignes par matière ───────────────────────────────────────────────────
    const subjectRows = subjects.map(sub => {
      const subExams = trimExams.filter(e => e.subject_id === sub.id);
      if (!subExams.length) return null;

      const studentGrades = subExams.map(exam => ({
        exam,
        grade: grades.find(g => g.exam_id === exam.id && g.student_id === student.id),
      }));

      const scores = studentGrades
        .filter(sg => sg.grade && !sg.grade.absent && sg.grade.score != null)
        .map(sg => sg.grade.score);

      const avg      = simpleAvg(scores);
      const classAvg = subjectClassAvg(sub.id, allClassStudents, trimExams, allGrades);
      const comments = studentGrades
        .filter(sg => sg.grade?.comment)
        .map(sg => sg.grade.comment)
        .join(", ");

      return { subject: sub, avg, classAvg, comments, coef: sub.coefficient || 1, subExams: subExams.length };
    }).filter(Boolean);

    // ── Moyenne générale pondérée ────────────────────────────────────────────
    const overall = weightedAvgFromRows(subjectRows);

    // ── Classement dans la classe ────────────────────────────────────────────
    const classAverages = allClassStudents.map(s => {
      const sRows = subjectRows.map(r => {
        const sScores = trimExams
          .filter(e => e.subject_id === r.subject.id)
          .map(exam => {
            const g = allGrades.find(g => g.exam_id === exam.id && g.student_id === s.id);
            return g && !g.absent && g.score != null ? g.score : null;
          })
          .filter(v => v !== null);
        return { avg: simpleAvg(sScores), coef: r.coef };
      });
      return { id: s.id, avg: weightedAvgFromRows(sRows) ?? 0 };
    }).sort((a, b) => b.avg - a.avg);

    const rank           = classAverages.findIndex(c => c.id === student.id) + 1;
    const classOverallAvg = simpleAvg(classAverages.map(c => c.avg));

    // ── Assiduité ────────────────────────────────────────────────────────────
    const studentAtt = attendance.filter(a => a.student_id === student.id);
    const absences   = studentAtt.filter(a => a.status === "absent").length;
    const lates      = studentAtt.filter(a => a.status === "late").length;

    return { subjectRows, overall, rank, classSize: allClassStudents.length, classOverallAvg, absences, lates };
  }, [student, period, cls, grades, exams, subjects, attendance, allClassStudents, allGrades]);

  // Utilise getMention() importée de gradeUtils
  const { label: mentionLabel, color: mentionColor } = getMention(data.overall);
  const schoolYear = cls?.school_year || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

  return (
    <div className="bulletin-page bg-white border border-slate-200 rounded-xl p-8 mb-6 print:mb-0 print:rounded-none print:border-none print:shadow-none print:p-6" style={{ pageBreakAfter: "always" }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 border-b-2 border-blue-700 pb-4">
        <div>
          <div className="text-2xl font-bold text-blue-800">EduGest</div>
          <div className="text-sm text-slate-600">Établissement Scolaire</div>
          <div className="text-xs text-slate-500 mt-1">Année scolaire : {schoolYear}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-900 border-2 border-blue-700 rounded-lg px-6 py-2">
            BULLETIN SCOLAIRE
          </div>
          <div className="text-sm font-medium text-blue-700 mt-1">{period?.name || "—"}</div>
        </div>
        <div className="text-right text-sm text-slate-600">
          <div className="font-semibold">{cls?.name}</div>
          <div>{cls?.level}</div>
          {mainTeacher && <div className="text-xs mt-1">Prof. Principal : {mainTeacher.first_name} {mainTeacher.last_name}</div>}
        </div>
      </div>

      {/* Student info */}
      <div className="grid grid-cols-3 gap-4 mb-6 bg-slate-50 rounded-lg p-4">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Élève</div>
          <div className="font-bold text-slate-900 text-lg">{student.first_name} {student.last_name}</div>
          {student.student_code && <div className="text-xs text-slate-500">N° {student.student_code}</div>}
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Date de naissance</div>
          <div className="font-medium">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Absences / Retards</div>
          <div className="font-medium">{data.absences} abs. / {data.lates} ret.</div>
        </div>
      </div>

      {/* Grades table */}
      <table className="w-full mb-6 text-sm border-collapse">
        <thead>
          <tr className="bg-blue-700 text-white">
            <th className="text-left px-3 py-2 rounded-tl-lg">Matière</th>
            <th className="text-center px-3 py-2 w-16">Coef.</th>
            <th className="text-center px-3 py-2 w-24">Moyenne élève</th>
            <th className="text-center px-3 py-2 w-24">Moy. classe</th>
            <th className="text-center px-3 py-2 w-24 rounded-tr-lg">Appréciation</th>
          </tr>
        </thead>
        <tbody>
          {data.subjectRows.map((row, i) => {
            const { label: appLabel, color: appColor } = getMention(row.avg);
            return (
              <tr key={row.subject.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-3 py-2 font-medium border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    {row.subject.color && (
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.subject.color }}></div>
                    )}
                    {row.subject.name}
                  </div>
                  {row.comments && <div className="text-xs text-slate-400 mt-0.5 italic">{row.comments}</div>}
                </td>
                <td className="px-3 py-2 text-center border-b border-slate-100 text-slate-600">{row.coef}</td>
                <td className="px-3 py-2 text-center border-b border-slate-100">
                  <span className="font-bold text-base" style={{ color: row.avg !== null && row.avg < 10 ? "#dc2626" : "#1e293b" }}>
                    {row.avg !== null ? row.avg.toFixed(2) : "—"}
                  </span>
                  {row.avg !== null && <span className="text-xs text-slate-400">/20</span>}
                </td>
                <td className="px-3 py-2 text-center border-b border-slate-100 text-slate-500 text-xs">
                  {row.classAvg !== null ? row.classAvg.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2 text-center border-b border-slate-100">
                  <span className="text-xs font-medium" style={{ color: appColor }}>{appLabel}</span>
                </td>
              </tr>
            );
          })}
          {data.subjectRows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400 italic">Aucune note pour ce trimestre</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 border-t-2 border-blue-700 pt-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Moyenne Générale</div>
          <div className="text-3xl font-bold text-blue-800">{data.overall !== null ? data.overall.toFixed(2) : "—"}</div>
          <div className="text-xs text-blue-600">/20</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Rang dans la classe</div>
          <div className="text-3xl font-bold text-slate-800">{data.rank > 0 ? data.rank : "—"}<span className="text-lg text-slate-400">/{data.classSize}</span></div>
          <div className="text-xs text-slate-400">Moy. classe : {data.classOverallAvg !== null ? data.classOverallAvg.toFixed(2) : "—"}</div>
        </div>
        <div className="rounded-lg p-4 text-center border-2" style={{ borderColor: mentionColor }}>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mention</div>
          <div className="text-2xl font-bold" style={{ color: mentionColor }}>{mentionLabel}</div>
        </div>
      </div>

      {/* Signatures électroniques */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4 print:hidden">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Signatures électroniques</span>
          <span className="text-xs text-slate-400">— Cliquez sur un champ pour signer</span>
          {(signatures.directeur || signatures.profPrincipal || signatures.parent) && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              ✓ {[signatures.directeur, signatures.profPrincipal, signatures.parent].filter(Boolean).length}/3 signés
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <div className="text-xs text-slate-500 mb-2 text-center">Le Directeur</div>
            <SignaturePad
              label="Signature & Cachet"
              existingSignature={signatures.directeur}
              onSign={(sig) => setSignatures(prev => ({ ...prev, directeur: sig }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2 text-center">Prof. Principal</div>
            <SignaturePad
              label="Signature"
              existingSignature={signatures.profPrincipal}
              onSign={(sig) => setSignatures(prev => ({ ...prev, profPrincipal: sig }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2 text-center">Parent / Tuteur</div>
            <SignaturePad
              label="Signature"
              existingSignature={signatures.parent}
              onSign={(sig) => setSignatures(prev => ({ ...prev, parent: sig }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}