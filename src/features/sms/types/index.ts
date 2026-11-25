export type UserRole = 'admin' | 'principal' | 'teacher' | 'parent' | 'student' | 'super-admin';
export type MembershipStatus = 'none' | 'pending' | 'active' | 'rejected';
export type SchoolStatus = 'active' | 'suspended' | 'pending_approval';
export type PrimaryAdminType = 'principal' | 'teacher_admin' | 'delegated';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  fatherName?: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  semisCode?: string;
  status: MembershipStatus;
  designation?: string;
  cnic?: string;
  phone?: string;
  assignedClassIds: string[];
  createdAt?: string;
  joiningDate?: string;
  isSuperAdmin?: boolean;
  isAdmissionIncharge?: boolean;
  primaryAdminType?: PrimaryAdminType;
  // Parent Portal Linkage Fields
  childStudentId?: string;
  childGrNumber?: string;
  childName?: string;
  parentLinkId?: string;
  linkedInviteCode?: string;
  // Student Portal Linkage Fields
  studentId?: string;
  studentGrNumber?: string;
  studentLinkId?: string;
}

export interface StudentPortalLink {
  id: string;                 // Deterministic: "${schoolId}__${sanitizedGrNumber}"
  schoolId: string;
  schoolName: string;
  semisCode?: string;
  studentId: string;
  studentName: string;
  classId: string;
  grade: string;
  section?: string;
  grNumber: string;
  studentEmail?: string;      // Lowercased login email set by Admin
  inviteCode: string;         // Admin-generated invite code (e.g., "STU-GR1042-7X4K")
  claimedByUid?: string;
  claimedAt?: string;
  status: 'available' | 'linked';
  updatedAt?: any;
}

export interface ParentStudentLink {
  id: string;                 // Deterministic: "${schoolId}__${sanitizedGrNumber}"
  schoolId: string;
  schoolName: string;
  semisCode?: string;
  studentId: string;
  studentName: string;
  classId: string;
  grade: string;
  section?: string;
  grNumber: string;
  parentEmail?: string;       // Lowercased email registered by Admin
  guardianPhone?: string;     // Guardian phone from student profile
  inviteCode: string;         // Admin-generated invite code (e.g., "PAR-GR1042-7X4K")
  claimedByUid?: string;
  claimedAt?: string;
  status: 'available' | 'linked';
  updatedAt?: any;
}

export interface SchoolRegistrationRequest {
  id: string;
  schoolId: string;
  schoolName: string;
  semisCode: string;
  board: 'Sindh STBB' | 'Punjab PTB' | 'Federal';
  district: string;
  taluka: string;
  activeAcademicYear: string;
  phone?: string;
  email?: string;
  primaryAdminType: PrimaryAdminType;
  adminUid: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  adminDesignation?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface TeacherJoinRequest {
  id: string;
  uid: string;
  fullName: string;
  fatherName?: string;
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

export interface SchoolAnalyticsSummary {
  totalStudents: number;
  totalClasses: number;
  totalTeachers: number;
  totalRevenue: number;
  todayAttendancePct: number;
  updatedAt?: string;
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
  logoUrl?: string;
  analytics?: SchoolAnalyticsSummary;
  createdAt?: string;
  suspendedReason?: string;
}

export type NoticePriority = 'high' | 'medium' | 'low';
export type NoticeAudience = 'all' | 'specific';

export interface GlobalNotice {
  id: string;
  title: string;
  message: string;
  priority: NoticePriority;
  date: string;                 // YYYY-MM-DD
  targetType: NoticeAudience;
  targetSchoolIds: string[];
  targetSchoolNames?: string[];
  createdByUid: string;
  createdByName: string;
  readBySchools: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: any;
}

export interface TeacherInfo {
  id: string;
  name: string;
  fatherName?: string;
  designation: string; // e.g., 'HST (Science)', 'JEST', 'PST', 'Lecturer'
  email: string;
  phone?: string;
  cnic?: string;
  joiningDate?: string;
  isAdmissionIncharge?: boolean;
  status?: 'active' | 'on_leave' | 'resigned';
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

export type ConcessionDiscountType = 'percentage' | 'fixed';

export interface FeeConcessionRule {
  id: string;
  schoolId: string;
  title: string;              // e.g. "Orphan Discount", "Staff Child", "Merit Scholarship"
  discountType: ConcessionDiscountType;
  value: number;              // e.g. 50 for 50%, 100 for 100%, or PKR fixed amount
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: any;
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
  // Permanent Fee Concession & Advance Balance Tracking
  concessionId?: string;
  concessionTitle?: string;
  concessionType?: ConcessionDiscountType;
  concessionValue?: number;
  advanceBalance?: number;
  // Student Photo & Parent/Student Portal Access Linkage
  photoUrl?: string;
  parentEmail?: string;
  parentUid?: string;
  parentInviteCode?: string;
  parentLinkedAt?: string;
  studentEmail?: string;
  studentUid?: string;
  studentInviteCode?: string;
  studentLinkedAt?: string;
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

// =============================================================================
// Fee Management (Financials)
// =============================================================================
export interface CustomFeeCharge {
  id: string;
  title: string;
  amount: number;
}

export interface ClassFeeStructure {
  id: string;                 // typically matching classId
  schoolId: string;
  classId: string;
  grade: string;              // e.g. "Class 9"
  monthlyTuitionFee: number;
  admissionFee: number;
  examFee: number;
  customCharges: CustomFeeCharge[];
  academicYear: string;
  updatedAt?: any;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'EasyPaisa' | 'JazzCash' | 'Cheque';

export interface FeeInstallmentEntry {
  amount: number;
  date: string;
  method: PaymentMethod;
  receiptNumber: string;
  recordedByName?: string;
  note?: string;
}

export interface FeePayment {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  grNumber: string;
  classId: string;
  grade: string;
  section?: string;
  month: string;              // e.g. "2026-11" (YYYY-MM format for sorting & uniqueness)
  monthLabel: string;         // e.g. "November 2026"
  academicYear: string;
  baseAmount: number;
  customChargesAmount: number;
  discount: number;           // Concession / Scholarship amount in PKR
  concessionId?: string;
  concessionTitle?: string;
  concessionPercent?: number;
  netAmount: number;
  paidAmount: number;
  pendingBalance?: number;    // Remaining due when status === 'partial'
  advanceUsed?: number;       // Advance credit applied toward this month
  advanceGenerated?: number;  // Overpayment allocated forward as advance
  allocatedNextMonth?: string;// e.g. "2026-12"
  installments?: FeeInstallmentEntry[];
  status: PaymentStatus;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;     // e.g. "RCPT-2026-001"
  notes?: string;
  recordedByUid?: string;
  recordedByName?: string;
  createdAt?: string;
  updatedAt?: any;
}

// =============================================================================
// Phase B: Exams & Results
// =============================================================================
export type ExamTermType = 'First Term' | 'Mid Term' | 'Annual' | 'Monthly Test' | 'Pre-Board';
export type ExamStatus = 'draft' | 'published' | 'archived';

export interface ExamSubject {
  id: string;
  name: string;
  totalMarks: number;
  passingMarks: number;
}

export interface Exam {
  id: string;
  schoolId: string;
  title: string;                // e.g. "First Term 2026"
  termType: ExamTermType;
  academicYear: string;         // e.g. "2025-2026"
  startDate?: string;
  endDate?: string;
  classIds: string[];           // Selected ClassSection IDs
  subjects: ExamSubject[];      // Configured subjects with max & passing marks
  status: ExamStatus;
  createdByUid?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: any;
}

export interface StudentExamMarks {
  id: string;                   // Composite: "${examId}_${studentId}"
  schoolId: string;
  examId: string;
  classId: string;
  studentId: string;
  studentName: string;
  grNumber: string;
  grade: string;
  section?: string;
  subjectMarks: Record<string, number | null>; // key: ExamSubject.id -> obtained marks (null = not entered / absent)
  absentSubjects?: string[];                   // ExamSubject.id list marked Absent
  remarks?: string;                            // Teacher's remarks
  totalObtained: number;
  totalMax: number;
  percentage: number;
  overallGrade: string;
  resultStatus: 'Pass' | 'Fail' | 'Pending';
  enteredByUid?: string;
  enteredByName?: string;
  enteredAt?: string;
  updatedAt?: any;
}

// =============================================================================
// Phase D: Timetable, Homework & Official Certificates
// =============================================================================
export type TimetableDay =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export interface TimetableEntry {
  id: string;
  schoolId: string;
  classId: string;
  grade: string;
  section?: string;
  day: TimetableDay;
  periodNumber: number;       // 1..10
  timeSlot?: string;          // e.g. "08:00 AM - 08:45 AM"
  subject: string;
  teacherId: string;
  teacherName: string;
  roomNumber?: string;
  createdAt?: string;
  updatedAt?: any;
}

export interface HomeworkItem {
  id: string;
  schoolId: string;
  classId: string;
  grade: string;
  section?: string;
  subject: string;
  title?: string;
  description: string;
  assignedDate: string;       // YYYY-MM-DD
  dueDate: string;            // YYYY-MM-DD
  teacherId: string;
  teacherName: string;
  status?: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: any;
}

export type CertificateType = 'transfer' | 'character';

export interface StudentCertificate {
  id: string;
  certificateNumber: string;  // e.g. "TC-2026-001" or "CC-2026-001"
  type: CertificateType;
  schoolId: string;
  studentId: string;
  studentName: string;
  fatherName: string;
  grNumber: string;
  classId: string;
  grade: string;
  section?: string;
  dob?: string;
  admissionDate?: string;
  leavingDate?: string;
  conduct: string;            // "Excellent" | "Very Good" | "Good"
  reasonForLeaving?: string;
  duesCleared: boolean;
  remarks?: string;
  issuedByUid?: string;
  issuedByName?: string;
  issueDate: string;          // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: any;
}

