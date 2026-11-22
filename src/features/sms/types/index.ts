export type UserRole = 'admin' | 'principal' | 'teacher' | 'super-admin';
export type MembershipStatus = 'none' | 'pending' | 'active' | 'rejected';
export type SchoolStatus = 'active' | 'suspended';
export type PrimaryAdminType = 'principal' | 'teacher_admin' | 'delegated';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  status: MembershipStatus;
  designation?: string;
  cnic?: string;
  phone?: string;
  assignedClassIds: string[];
  createdAt?: string;
  isSuperAdmin?: boolean;
}

export interface TeacherJoinRequest {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  cnic?: string;
  designation: string; // e.g., 'PST', 'JEST', 'EST', 'HST', 'Subject Specialist'
  schoolId: string;
  schoolName: string;
  semisCode: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  assignedClassIds?: string[];
}

export interface School {
  id: string;
  name: string;
  semisCode: string;
  board: 'Sindh STBB' | 'Punjab PTB' | 'Federal';
  district: string;
  taluka: string;
  adminUids: string[];
  activeAcademicYear: string;
  phone?: string;
  email?: string;
  address?: string;
  status: SchoolStatus;
  primaryAdminType: PrimaryAdminType;
  primaryAdminName: string;
  primaryAdminEmail: string;
  createdAt?: string;
  suspendedReason?: string;
}

export interface TeacherInfo {
  id: string;
  name: string;
  designation: string; // e.g., 'HST (Science)', 'JEST', 'PST', 'Lecturer'
  email: string;
  phone?: string;
  assignedClasses: string[];
}

export interface ClassSection {
  id: string;
  grade: string;              // e.g., "Class 9", "Class 10", "Class 5"
  section: string;            // e.g., "A", "B", "Rose", "Jinnah"
  medium: 'English' | 'Urdu' | 'Sindhi';
  academicYear: string;       // e.g., "2025-2026"
  classTeacherId: string;     // Teacher ID or UID
  classTeacherName: string;
  roomNumber?: string;
  totalStudents: number;
  capacity?: number;
  createdAt: string;
}

export interface Student {
  id: string;
  grNumber: string;           // General Register / Admission Number
  fullName: string;
  fatherName: string;
  bFormNumber?: string;       // NADRA B-Form
  dob: string;
  gender: 'Male' | 'Female';
  classId: string;
  grade: string;
  section: string;
  admissionDate: string;
  status: 'active' | 'struck_off' | 'transferred' | 'graduated';
  guardianPhone: string;
  address?: string;
}

export interface AttendanceRecord {
  status: 'present' | 'absent' | 'leave' | 'late';
  note?: string;
}

export interface DailyClassAttendance {
  id: string;                 // Composite: "YYYY-MM-DD_{classId}"
  date: string;               // YYYY-MM-DD
  classId: string;
  grade: string;
  section: string;
  markedByUid: string;
  markedByName: string;
  markedAt: string;
  records: Record<string, AttendanceRecord>;
  summary: {
    total: number;
    present: number;
    absent: number;
    leave: number;
    late: number;
    percentage: number;
  };
}
