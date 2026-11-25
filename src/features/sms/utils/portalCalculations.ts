import {
  DailyClassAttendance,
  Exam,
  HomeworkItem,
  TimetableDay,
  TimetableEntry,
} from '../types';

export const TIMETABLE_DAY_ORDER: TimetableDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface StudentAttendanceRow {
  date: string;
  status: string;
  note?: string;
}

export interface StudentAttendanceSummary {
  monthTotal: number;
  monthPresent: number;
  monthAbsent: number;
  monthLeave: number;
  monthLate: number;
  monthPercentage: number;
  overallPercentage: number;
  overallTotal: number;
  recentRows: StudentAttendanceRow[];
}

function summarizeAttendanceRows(rows: StudentAttendanceRow[]) {
  let present = 0;
  let absent = 0;
  let leave = 0;
  let late = 0;
  rows.forEach((r) => {
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'leave') leave++;
    else if (r.status === 'late') late++;
  });
  const total = rows.length;
  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { total, present, absent, leave, late, pct };
}

/**
 * Computes monthly and overall read-only attendance metrics for a single student.
 */
export function computeStudentAttendanceStats(
  studentId: string | undefined,
  classId: string | undefined,
  attendanceRegisters: Record<string, DailyClassAttendance>,
  selectedAttendanceMonth: string
): StudentAttendanceSummary {
  if (!studentId || !classId) {
    return {
      monthTotal: 0,
      monthPresent: 0,
      monthAbsent: 0,
      monthLeave: 0,
      monthLate: 0,
      monthPercentage: 0,
      overallPercentage: 0,
      overallTotal: 0,
      recentRows: [],
    };
  }

  const allRows: StudentAttendanceRow[] = [];
  Object.values(attendanceRegisters).forEach((reg) => {
    if (reg.classId !== classId) return;
    const rec = reg.records?.[studentId];
    if (rec) {
      allRows.push({
        date: reg.date,
        status: rec.status,
        note: rec.note,
      });
    }
  });

  allRows.sort((a, b) => b.date.localeCompare(a.date));

  const monthRows = allRows.filter((r) => r.date.startsWith(selectedAttendanceMonth));
  const m = summarizeAttendanceRows(monthRows);
  const o = summarizeAttendanceRows(allRows);

  return {
    monthTotal: m.total,
    monthPresent: m.present,
    monthAbsent: m.absent,
    monthLeave: m.leave,
    monthLate: m.late,
    monthPercentage: m.pct,
    overallPercentage: o.pct,
    overallTotal: o.total,
    recentRows: monthRows.length > 0 ? monthRows : allRows.slice(0, 20),
  };
}

/**
 * Filters and sorts weekly timetable entries for a student's class in Monday..Saturday order.
 */
export function filterStudentTimetable(
  timetableEntries: TimetableEntry[],
  classId: string | undefined
): TimetableEntry[] {
  if (!classId) return [];
  return timetableEntries
    .filter((t) => t.classId === classId)
    .sort((a, b) => {
      const dayDiff =
        TIMETABLE_DAY_ORDER.indexOf(a.day) - TIMETABLE_DAY_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.periodNumber - b.periodNumber;
    });
}

/**
 * Filters homework diary entries for a student's class ordered by due date.
 */
export function filterStudentHomework(
  homeworkItems: HomeworkItem[],
  classId: string | undefined
): HomeworkItem[] {
  if (!classId) return [];
  return homeworkItems
    .filter((h) => h.classId === classId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Returns published exams applicable to a student's class.
 */
export function getPublishedExamsForClass(
  exams: Exam[],
  classId: string | undefined
): Exam[] {
  if (!classId) return [];
  return exams.filter(
    (ex) =>
      ex.status === 'published' &&
      (!ex.classIds || ex.classIds.length === 0 || ex.classIds.includes(classId))
  );
}
