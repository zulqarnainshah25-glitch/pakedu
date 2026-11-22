import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Users,
  DoorOpen,
  BookOpen,
  UserCheck,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  CheckCircle2,
  Sparkles,
  School as SchoolIcon,
  ShieldAlert,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { ClassSection } from '../types';

const GRADE_OPTIONS = [
  'KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

interface ClassesManagementProps {
  onNavigateToAttendance?: (classId: string) => void;
  onNavigateToStudents?: (classId: string) => void;
}

export const ClassesManagement: React.FC<ClassesManagementProps> = ({
  onNavigateToAttendance,
  onNavigateToStudents,
}) => {
  const {
    userRole,
    setUserRole,
    activeSchool,
    classes,
    teachers,
    addClass,
    updateClass,
    deleteClass,
    filteredClassesForUser,
    activeTeacher,
    stats,
    demoMode,
  } = useSms();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedium, setSelectedMedium] = useState<'All' | 'English' | 'Urdu' | 'Sindhi'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSection | null>(null);

  // Form State
  const [grade, setGrade] = useState('Class 9');
  const [section, setSection] = useState('A (Science)');
  const [medium, setMedium] = useState<'English' | 'Urdu' | 'Sindhi'>('English');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [classTeacherId, setClassTeacherId] = useState(teachers[0]?.id || '');
  const [roomNumber, setRoomNumber] = useState('Room 12');
  const [capacity, setCapacity] = useState<number>(50);
  const [totalStudents, setTotalStudents] = useState<number>(35);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const isAdmin = userRole === 'admin' || userRole === 'principal';

  // Filter classes
  const displayedClasses = useMemo(() => {
    return filteredClassesForUser.filter((item) => {
      const matchSearch =
        item.grade.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.classTeacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.roomNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchMedium = selectedMedium === 'All' || item.medium === selectedMedium;
      return matchSearch && matchMedium;
    });
  }, [filteredClassesForUser, searchQuery, selectedMedium]);

  const openAddModal = () => {
    setEditingClass(null);
    setGrade('Class 9');
    setSection('A');
    setMedium('English');
    setAcademicYear(activeSchool.activeAcademicYear || '2025-2026');
    setClassTeacherId(teachers[0]?.id || '');
    setRoomNumber('Room 10');
    setCapacity(50);
    setTotalStudents(0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cls: ClassSection) => {
    setEditingClass(cls);
    setGrade(cls.grade);
    setSection(cls.section);
    setMedium(cls.medium);
    setAcademicYear(cls.academicYear);
    setClassTeacherId(cls.classTeacherId);
    setRoomNumber(cls.roomNumber || '');
    setCapacity(cls.capacity || 50);
    setTotalStudents(cls.totalStudents || 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade.trim() || !section.trim()) {
      setFormError('Please provide both Grade level and Section name.');
      return;
    }

    const assignedTeacherObj = teachers.find((t) => t.id === classTeacherId);
    const teacherName = assignedTeacherObj ? assignedTeacherObj.name : 'Unassigned';

    if (editingClass) {
      updateClass(editingClass.id, {
        grade: grade.trim(),
        section: section.trim(),
        medium,
        academicYear,
        classTeacherId,
        classTeacherName: teacherName,
        roomNumber: roomNumber.trim(),
        capacity: Number(capacity) || 50,
        totalStudents: Number(totalStudents) || 0,
      });
      setSuccessNotice(`Class "${grade} - ${section}" successfully updated!`);
    } else {
      addClass({
        grade: grade.trim(),
        section: section.trim(),
        medium,
        academicYear,
        classTeacherId,
        classTeacherName: teacherName,
        roomNumber: roomNumber.trim(),
        capacity: Number(capacity) || 50,
        totalStudents: Number(totalStudents) || 0,
      });
      setSuccessNotice(`New Class "${grade} - ${section}" successfully registered!`);
    }

    setIsModalOpen(false);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleDeleteClass = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) {
      deleteClass(id);
      setSuccessNotice(`Class ${name} removed.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* School Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <SchoolIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {activeSchool.name}
                </h1>
                <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                  SEMIS: {activeSchool.semisCode}
                </span>
                <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                  {activeSchool.district} · {activeSchool.activeAcademicYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Classes &amp; Sections Management · Role-Based Section Allocations &amp; Academic Rosters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {isAdmin ? (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Class / Section</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4" />
                <span>Teacher Mode: View Assigned Only</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Alert Notice for Teacher */}
      {!isAdmin && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🧑‍🏫</span>
            <span>
              You are currently logged in with <strong>Teacher Access ({activeTeacher.name})</strong>. You can view your assigned classes and take attendance. Adding, editing, or deleting grade sections is restricted to School Administrators.
            </span>
          </div>
          {demoMode && (
            <button
              type="button"
              onClick={() => setUserRole('admin')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[11px] shrink-0 cursor-pointer transition"
            >
              Demo: Switch to 👑 Admin View
            </button>
          )}
        </div>
      )}

      {/* Success Notification */}
      {successNotice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Stats KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Sections</span>
            <GraduationCap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {stats.totalClasses}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active grade sections</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {stats.totalStudents}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            Avg {stats.averageClassSize} students / class
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Faculty Members</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {stats.totalTeachers}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Assigned class teachers</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Language Mediums</span>
            <BookOpen className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 flex flex-wrap gap-1.5">
            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] rounded font-mono">
              English
            </span>
            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded font-mono">
              Urdu
            </span>
            <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] rounded font-mono">
              Sindhi
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Class, Section, Teacher or Room..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'English', 'Urdu', 'Sindhi'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMedium(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedMedium === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {m === 'All' ? 'All Mediums' : `${m} Medium`}
            </button>
          ))}
        </div>
      </div>

      {/* Class Section Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedClasses.map((cls) => {
          const capPercent = Math.min(
            100,
            Math.round(((cls.totalStudents || 0) / (cls.capacity || 50)) * 100)
          );

          return (
            <div
              key={cls.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Card Top Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{cls.grade}</span>
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        § {cls.section}
                      </span>
                    </h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                        {cls.roomNumber || 'Room Unassigned'}
                      </span>
                      <span>·</span>
                      <span>{cls.academicYear}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      cls.medium === 'English'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : cls.medium === 'Urdu'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {cls.medium}
                  </span>
                </div>

                {/* Class Teacher Assignment */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 mb-4">
                  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Class Incharge / Teacher
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{cls.classTeacherName || 'Not Assigned'}</span>
                  </div>
                </div>

                {/* Enrollment Bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Enrollment</span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {cls.totalStudents} / {cls.capacity || 50} Students
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        capPercent >= 90
                          ? 'bg-rose-500'
                          : capPercent >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${capPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToStudents?.(cls.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Students</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToAttendance?.(cls.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Attendance</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(cls)}
                        title="Edit Class Information"
                        className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.id, `${cls.grade} - ${cls.section}`)}
                        title="Delete Class"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayedClasses.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No classes found matching your filter
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or clear medium filters.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Class</span>
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Class Modal (Admin Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingClass ? 'Edit Class / Section' : 'Add New Class / Section'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="p-5 space-y-4">
              {formError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grade Level
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. A, Rose, Science"
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Instruction Medium
                  </label>
                  <select
                    value={medium}
                    onChange={(e) => setMedium(e.target.value as 'English' | 'Urdu' | 'Sindhi')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="English">English Medium</option>
                    <option value="Urdu">Urdu Medium</option>
                    <option value="Sindhi">Sindhi Medium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Class Teacher / Incharge
                </label>
                <select
                  value={classTeacherId}
                  onChange={(e) => setClassTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Room No.
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Room 14"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Students
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={capacity}
                    value={totalStudents}
                    onChange={(e) => setTotalStudents(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-sm cursor-pointer transition"
                >
                  {editingClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
