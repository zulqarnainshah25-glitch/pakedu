import { Exam, ExamSubject, Student, StudentExamMarks } from '../types';

export interface SubjectResultRow {
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passingMarks: number;
  obtainedMarks: number | null;
  isAbsent: boolean;
  isEntered: boolean;
  percentage: number;
  status: 'Pass' | 'Fail' | 'Absent' | 'Pending';
}

export interface ComputedStudentExamResult {
  subjectRows: SubjectResultRow[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  overallGrade: string;
  gradeLabel: string;
  resultStatus: 'Pass' | 'Fail' | 'Pending';
  hasEnteredAnyMarks: boolean;
  suggestedRemark: string;
}

export interface StudentClassStanding {
  studentId: string;
  position?: number;
  positionLabel: string;
  totalRanked: number;
  result: ComputedStudentExamResult;
  marksRecord?: StudentExamMarks;
}

export const DEFAULT_SELD_SUBJECT_PRESETS: Array<Omit<ExamSubject, 'id'>> = [
  { name: 'English', totalMarks: 100, passingMarks: 33 },
  { name: 'Urdu', totalMarks: 100, passingMarks: 33 },
  { name: 'Sindhi', totalMarks: 100, passingMarks: 33 },
  { name: 'Mathematics', totalMarks: 100, passingMarks: 33 },
  { name: 'General Science', totalMarks: 100, passingMarks: 33 },
  { name: 'Islamiyat', totalMarks: 50, passingMarks: 17 },
  { name: 'Pakistan Studies / Social Studies', totalMarks: 50, passingMarks: 17 },
];

/**
 * Standard Sindh SELD / BISE grading rubric.
 */
export function computeAcademicGrade(percentage: number): {
  grade: string;
  label: string;
  suggestedRemark: string;
} {
  const safePct = Number.isFinite(percentage) ? percentage : 0;
  if (safePct >= 80) {
    return {
      grade: 'A+',
      label: 'Exceptional / Distinction',
      suggestedRemark: 'Outstanding academic performance. Keep up the excellent work!',
    };
  }
  if (safePct >= 70) {
    return {
      grade: 'A',
      label: 'Excellent',
      suggestedRemark: 'Very good progress across subjects. Maintain this consistency.',
    };
  }
  if (safePct >= 60) {
    return {
      grade: 'B',
      label: 'Good',
      suggestedRemark: 'Good overall effort. With a little more practice, can reach A grade.',
    };
  }
  if (safePct >= 50) {
    return {
      grade: 'C',
      label: 'Satisfactory',
      suggestedRemark: 'Satisfactory performance. Needs more regular revision in key subjects.',
    };
  }
  if (safePct >= 40) {
    return {
      grade: 'D',
      label: 'Pass (Average)',
      suggestedRemark: 'Passed, but requires consistent daily study and teacher guidance.',
    };
  }
  if (safePct >= 33) {
    return {
      grade: 'E',
      label: 'Marginally Passed',
      suggestedRemark: 'Needs significant improvement and extra attention in weak areas.',
    };
  }
  return {
    grade: 'F',
    label: 'Needs Improvement',
    suggestedRemark: 'Requires remedial coaching and regular attendance to improve results.',
  };
}

/**
 * Computes subject-wise and aggregate totals, percentage, grade, and pass/fail status
 * for a single student in a given Exam.
 */
export function computeStudentExamResult(
  exam: Exam,
  subjectMarks: Record<string, number | null | undefined>,
  absentSubjects: string[] = []
): ComputedStudentExamResult {
  const absentSet = new Set(absentSubjects || []);
  let totalObtained = 0;
  let totalMax = 0;
  let enteredCount = 0;
  let hasFailedSubject = false;

  const subjectRows: SubjectResultRow[] = (exam.subjects || []).map((subj) => {
    const maxMarks = Math.max(1, Number(subj.totalMarks) || 0);
    const passMarks = Math.max(0, Number(subj.passingMarks) || 0);
    const isAbsent = absentSet.has(subj.id);
    const rawMark = subjectMarks?.[subj.id];
    const hasNumericMark =
      !isAbsent &&
      rawMark !== null &&
      rawMark !== undefined &&
      Number.isFinite(Number(rawMark));

    const obtainedMarks = isAbsent
      ? 0
      : hasNumericMark
      ? Math.max(0, Math.min(maxMarks, Number(rawMark)))
      : null;

    totalMax += maxMarks;

    let status: SubjectResultRow['status'] = 'Pending';
    if (isAbsent) {
      status = 'Absent';
      enteredCount += 1;
      hasFailedSubject = true;
    } else if (obtainedMarks !== null) {
      enteredCount += 1;
      totalObtained += obtainedMarks;
      if (obtainedMarks < passMarks) {
        status = 'Fail';
        hasFailedSubject = true;
      } else {
        status = 'Pass';
      }
    }

    const subjPct =
      obtainedMarks !== null && maxMarks > 0
        ? Math.round((obtainedMarks / maxMarks) * 1000) / 10
        : 0;

    return {
      subjectId: subj.id,
      subjectName: subj.name,
      totalMarks: maxMarks,
      passingMarks: passMarks,
      obtainedMarks,
      isAbsent,
      isEntered: isAbsent || obtainedMarks !== null,
      percentage: subjPct,
      status,
    };
  });

  const hasEnteredAnyMarks = enteredCount > 0;
  const percentage =
    hasEnteredAnyMarks && totalMax > 0
      ? Math.round((totalObtained / totalMax) * 10000) / 100
      : 0;

  const gradeInfo = computeAcademicGrade(percentage);

  let resultStatus: ComputedStudentExamResult['resultStatus'] = 'Pending';
  if (hasEnteredAnyMarks) {
    if (hasFailedSubject || percentage < 33) {
      resultStatus = 'Fail';
    } else if (enteredCount >= (exam.subjects?.length || 0)) {
      resultStatus = 'Pass';
    } else {
      // Partial entry with passing scores so far
      resultStatus = 'Pending';
    }
  }

  return {
    subjectRows,
    totalObtained: Math.round(totalObtained * 100) / 100,
    totalMax,
    percentage,
    overallGrade: hasEnteredAnyMarks ? gradeInfo.grade : '—',
    gradeLabel: hasEnteredAnyMarks ? gradeInfo.label : 'Awaiting Marks',
    resultStatus,
    hasEnteredAnyMarks,
    suggestedRemark: hasEnteredAnyMarks ? gradeInfo.suggestedRemark : '',
  };
}

export function formatOrdinalPosition(rank: number): string {
  if (!Number.isFinite(rank) || rank <= 0) return '—';
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * Computes class standings & competition-ranked positions (1st, 2nd, 2nd, 4th...)
 * for all students in a class for the selected exam.
 */
export function computeClassPositions(
  exam: Exam,
  classStudents: Student[],
  marksList: StudentExamMarks[]
): Map<string, StudentClassStanding> {
  const marksByStudent = new Map<string, StudentExamMarks>();
  for (const m of marksList) {
    if (m.examId === exam.id) {
      marksByStudent.set(m.studentId, m);
    }
  }

  const computedEntries = classStudents.map((stu) => {
    const rec = marksByStudent.get(stu.id);
    const result = computeStudentExamResult(
      exam,
      rec?.subjectMarks || {},
      rec?.absentSubjects || []
    );
    return {
      studentId: stu.id,
      marksRecord: rec,
      result,
    };
  });

  // Only rank students who have at least one mark entered
  const rankedCandidates = computedEntries
    .filter((entry) => entry.result.hasEnteredAnyMarks)
    .sort((a, b) => {
      // Passing students rank ahead of failing students when comparing positions, then by totalObtained desc
      if (a.result.resultStatus === 'Pass' && b.result.resultStatus !== 'Pass') return -1;
      if (b.result.resultStatus === 'Pass' && a.result.resultStatus !== 'Pass') return 1;
      if (b.result.totalObtained !== a.result.totalObtained) {
        return b.result.totalObtained - a.result.totalObtained;
      }
      return b.result.percentage - a.result.percentage;
    });

  const positionByStudent = new Map<string, number>();
  let lastScoreKey = '';
  let currentRank = 0;

  rankedCandidates.forEach((candidate, idx) => {
    const scoreKey = `${candidate.result.resultStatus}:${candidate.result.totalObtained}`;
    if (scoreKey !== lastScoreKey) {
      currentRank = idx + 1;
      lastScoreKey = scoreKey;
    }
    positionByStudent.set(candidate.studentId, currentRank);
  });

  const standingsMap = new Map<string, StudentClassStanding>();
  const totalRanked = rankedCandidates.length;

  for (const entry of computedEntries) {
    const pos = positionByStudent.get(entry.studentId);
    standingsMap.set(entry.studentId, {
      studentId: entry.studentId,
      position: pos,
      positionLabel: pos ? `${formatOrdinalPosition(pos)} / ${totalRanked}` : '—',
      totalRanked,
      result: entry.result,
      marksRecord: entry.marksRecord,
    });
  }

  return standingsMap;
}
