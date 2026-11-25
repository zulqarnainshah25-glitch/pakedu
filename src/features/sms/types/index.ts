export type UserRole = 'admin' | 'principal' | 'teacher' | 'super-admin';
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
  createdAt?: string;
  suspendedReason?: string;
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

