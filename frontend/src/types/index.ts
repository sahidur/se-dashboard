// ============================================
// Type definitions for Social Enterprise Platform
// ============================================

// ── School Monitoring ────────────────────────────────
export type MonitoringResult = 'yes' | 'no' | 'na' | '';

export interface MonitoringAnswer {
  code: string;
  section: string;
  result: MonitoringResult;
  comment?: string;
  /** Evidence files uploaded for this specific question. */
  attachments?: MonitoringAttachment[];
}

export interface MonitoringAttachment {
  url: string;
  key: string;
  name: string;
  type?: string;
}

export interface MonitoringSubmission {
  id: string;
  schoolId: string;
  school?: DcSchool;
  formType: 'combined' | 'quality' | 'operations';
  observerName?: string | null;
  observationDate?: string | null;
  className?: string | null;
  teacherName?: string | null;
  answers: MonitoringAnswer[];
  attachments: MonitoringAttachment[];
  generalRemarks?: string | null;
  submittedById?: string;
  submittedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMonitoring {
  items: MonitoringSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** One historical answer for a specific indicator (per-question timeline). */
export interface MonitoringQuestionFeedback {
  code: string;
  section: string;
  result: MonitoringResult;
  comment?: string | null;
  submissionId: string;
  observerName?: string | null;
  submittedById?: string | null;
  submittedByName?: string | null;
  submittedAt: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  isActive: boolean;
  lastLoginAt?: string;
  roles: Role[];
  pin?: number | null;
  designation?: string | null;
  base?: string | null;
  geoLocationId?: string | null;
  geoLocation?: GeoLocation | null;
  schools?: School[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  entityId?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  user?: Pick<
    User,
    'id' | 'firstName' | 'lastName' | 'email' | 'profilePicture'
  > | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogStats {
  total: number;
  byAction: Record<string, number>;
}

export interface Passkey {
  id: string;
  name: string | null;
  deviceType: 'singleDevice' | 'multiDevice' | null;
  backedUp: boolean;
  transports: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface UserDesignation {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  hierarchy: number;
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  module: string;
  /**
   * Optional sub-resource within the module (e.g. a data-collection form key).
   * Null/undefined acts as a wildcard covering all resources in the module.
   */
  resource?: string | null;
  action: 'create' | 'read' | 'update' | 'delete';
}

export type LinkedEntityType = 'none' | 'school_record';

export interface Survey {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: 'draft' | 'published' | 'closed' | 'archived';
  wasPublished: boolean;
  startDate?: string;
  endDate?: string;
  linkedEntityType: LinkedEntityType;
  createsSchoolRecord: boolean;
  createdBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
  createdById: string;
  fields: SurveyField[];
  sections?: SurveySection[];
  assignments?: SurveyAssignment[];
  statusLogs?: SurveyStatusLog[];
  createdAt: string;
  updatedAt: string;
}

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'number'
  | 'single_select_searchable'
  | 'multi_select_searchable'
  | 'true_false'
  | 'location'
  | 'file_upload'
  | 'date'
  | 'email'
  | 'phone'
  | 'address';

export interface SurveyField {
  id: string;
  label: string;
  fieldName?: string; // Unique slug for analytics/dashboards
  fieldType: FieldType;
  isRequired: boolean;
  options?: string[];
  validationRules?: Record<string, any>;
  placeholder?: string;
  helpText?: string;
  order: number;
  allowedFileTypes?: string;
  maxFileSize?: number;
  sectionId?: string;
}

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: SurveyField[];
}

export interface SurveyAssignment {
  id: string;
  surveyId: string;
  userId?: string;
  roleId?: string;
  schoolId?: string;
  excludeUserIds?: string[];
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  role?: Pick<Role, 'id' | 'name'>;
  school?: Pick<School, 'id' | 'name'>;
}

// Hierarchy order (top -> bottom): Area > Division > District > Thana/Upazilla.
export type GeoLocationType = 'area' | 'division' | 'district' | 'thana';

export interface GeoLocation {
  id: string;
  name: string;
  type: GeoLocationType;
  parentId?: string;
  parent?: GeoLocation;
  children?: GeoLocation[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentId: string;
  respondent: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  schoolRecordId?: string;
  schoolRecord?: SchoolRecord;
  isComplete: boolean;
  metadata?: Record<string, any>;
  answers: SurveyAnswer[];
  submittedAt?: string;
  createdAt: string;
}

export interface SurveyStatusLog {
  id: string;
  surveyId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
  changedById: string;
  reason?: string;
  changedAt: string;
}

export interface SchoolRecord {
  id: string;
  name: string;
  schoolId?: string;
  school?: Pick<School, 'id' | 'name'>;
  createdBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
  createdById: string;
  sourceSurveyId?: string;
  sourceResponseId?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyAnswer {
  id: string;
  fieldId: string;
  field: Pick<SurveyField, 'id' | 'label' | 'fieldType'>;
  textValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  jsonValue?: any;
  fileUrl?: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  district?: string;
  division?: string;
  upazila?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  infrastructure?: Record<string, any>;
  students?: Student[];
  teachers?: Teacher[];
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  grade?: string;
  section?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  isActive: boolean;
  enrollmentDate?: string;
  schoolId: string;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  subject?: string;
  qualification?: string;
  phone?: string;
  email?: string;
  joiningDate?: string;
  isActive: boolean;
  schoolId: string;
}

export interface SurveyCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ===================== Data Collection Types =====================

export interface DcSchool {
  id: string;
  name: string;
  code: string;
  address?: string;
  district?: string;
  division?: string;
  upazila?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  establishedYear?: number;
  schoolType?: string;
  schoolCategory?: string;
  governmentApproval?: boolean;
  totalTeachers?: number;
  totalStudents?: number;
  gradeCoverage?: string;
  isActive?: boolean;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface DcBasicInfo {
  id: string;
  schoolId: string;
  academicYear: number;
  schoolCategory?: string;
  mediumOfInstruction?: string;
  shiftSystem?: string;
  hasPlayground: boolean;
  hasLibrary: boolean;
  hasComputerLab: boolean;
  hasScienceLab: boolean;
  hasElectricity: boolean;
  hasInternet: boolean;
  hasDrinkingWater: boolean;
  hasSanitaryFacilities: boolean;
  totalClassrooms: number;
  operationalClassrooms: number;
  additionalNotes?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcInfrastructure {
  id: string;
  schoolId: string;
  academicYear: number;
  // Infrastructure Status
  campusStatus?: string;
  buildingStatus?: string; // JSON-encoded string[]
  roomHeadTeachers: number;
  roomTeachers: number;
  roomClassroom: number;
  roomPlayroom: number;
  roomLibrary: number;
  roomLab: number;
  roomStoreroom: number;
  roomKitchen: number;
  roomSickbay: number;
  roomOthers: number;
  roomTotal: number;
  washroomMale: number;
  washroomFemale: number;
  hasHandWashPoint: boolean;
  hasPlayground: boolean;
  hasSchoolGarden: boolean;
  infraRenovationRequired: boolean;
  // Classroom Status
  digitallyEquippedClassrooms: number;
  floorSittingClassrooms: number;
  classroomsWithWhiteboard: number;
  classroomsWithBlackboard: number;
  classroomNewFurniture: boolean;
  classroomRenovationRequired: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcStudentsInfo {
  id: string;
  schoolId: string;
  academicYear: number;
  month: string;
  grade: string;
  boys: number;
  girls: number;
  total: number;
  personsWithDisability: number;
  ethnic: number;
  attendanceRate: number;
  dropoutRate: number;
  replacedStudentsRate: number;
  retentionRate: number;
  remedialSupport: number;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface DcTeacherIndividual {
  id: string;
  schoolId: string;
  academicYear: number;
  name: string;
  designation: string;
  gender: string;
  educationalQualification: string;
  experienceYears: number;
  subjectExpertise?: string;
  trainingReceived?: string;
  assessmentScore?: number;
  joiningDate?: string | null;
  phone?: string | null;
  lastWorkingDay?: string | null;
  separationType?: string | null;
  separationReason?: string | null;
  separationNote?: string | null;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export type HeadTeacherLeadership = 'strong' | 'moderate' | 'weak';

export interface DcTeachersDevelopment {
  id: string;
  schoolId: string;
  academicYear: number;
  month: string;
  onlineRefresher: number;
  offlineRefresher: number;
  developmentForum: number;
  basicTraining: number;
  subjectBasedTraining: number;
  leadershipTraining: number;
  others: number;
  othersTrainingName?: string | null;
  teacherDropoutRate?: number | null;
  headTeacherDropoutRate?: number | null;
  /** @deprecated Superseded by `headTeacherLeadership`. */
  headTeacherLeadershipGood?: boolean | null;
  headTeacherLeadership?: HeadTeacherLeadership | null;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface DcTeachersInfo {
  id: string;
  schoolId: string;
  totalTeachersMale: number;
  totalTeachersFemale: number;
  permanentTeachers: number;
  contractTeachers: number;
  trainedTeachers: number;
  untrainedTeachers: number;
  avgExperienceYears: number;
  teacherStudentRatio?: string;
  vacantPositions: number;
  teachersWithBEd: number;
  teachersWithMEd: number;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcRevenue {
  id: string;
  schoolId: string;
  academicYear: number;
  monthlyTuitionFee: number;
  admissionFee: number;
  examFee: number;
  totalAnnualRevenue: number;
  governmentGrant: number;
  donationsReceived: number;
  otherIncome: number;
  totalExpenditure: number;
  salaryExpenditure: number;
  maintenanceExpenditure: number;
  pendingFeeAmount: number;
  feeCollectionRate: number;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcPerformance {
  id: string;
  schoolId: string;
  academicYear: number;
  avgPassRate: number;
  avgGpa: number;
  boardExamPassRate: number;
  boardExamAvgGpa: number;
  extracurricularActivities?: string;
  sportsAchievements?: string;
  culturalActivities?: string;
  scienceFairParticipation: number;
  debateCompetitions: number;
  totalAwards: number;
  teachingMethodology?: string;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcAlumni {
  id: string;
  schoolId: string;
  academicYear: number;
  alumniName: string;
  graduationYear?: number;
  presentAddress?: string;
  currentOccupation?: string;
  higherEducation?: string;
  institution?: string;
  contactPhone?: string;
  contactEmail?: string;
  achievements?: string;
  isActive: boolean;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcDashboard {
  school: DcSchool;
  forms: {
    basicInformation: { submitted: boolean; data?: DcBasicInfo };
    infrastructure: { submitted: boolean; data?: DcInfrastructure };
    classroomStatus: { submitted: boolean };
    studentsInfo: { submitted: boolean; count?: number };
    teachersInfo: { submitted: boolean; count?: number };
    teachersDev: { submitted: boolean; count?: number };
    revenue: { submitted: boolean; data?: DcRevenue };
    feeStructure: { submitted: boolean; count?: number };
    revenueBudgetTotal: { submitted: boolean };
    revenueBudgetMonthly: { submitted: boolean; count?: number };
    revenueActualTotal: { submitted: boolean };
    revenueActualMonthly: { submitted: boolean; count?: number };
    performance: { submitted: boolean; data?: DcPerformance };
    alumni: { submitted: boolean; count?: number; data?: DcAlumni[] };
    pedagogicalAchievements: { submitted: boolean; count?: number };
    cocurricular: { submitted: boolean; count?: number };
    studentsPerformance: { submitted: boolean; count?: number };
    studentPerformance: { submitted: boolean; count?: number };
    activityParticipation: { submitted: boolean; count?: number };
    eventParticipation: { submitted: boolean; count?: number };
  };
}

export interface DcStudentsPerformance {
  id: string;
  schoolId: string;
  academicYear: number;
  grade: string;
  numberOfStudents: number;
  examName: string;
  studentsAppearedPercent?: number;
  gradeAPlus: number;
  gradeA: number;
  gradeAMinus: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeF: number;
  academyExcellent: number;
  academyGood: number;
  academySatisfactory: number;
  academyImprovementNeeded: number;
  progressGood?: number;
  progressSatisfactory?: number;
  progressNeedImprove?: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcStudentPerformanceRow {
  code: string;
  label: string;
  domain?: string;
  /** Scale label -> number of students, e.g. { Excellent: 10, Good: 15 }. */
  values: Record<string, number>;
}

export interface DcStudentPerformance {
  id: string;
  schoolId: string;
  academicYear: number;
  /** ba-1 | ba-2 | ba-3a | ba-3b | bps-1 | bps-2 | bss-1 */
  formKey: string;
  grade: string;
  evaluationPeriod: string;
  numberOfStudents: number;
  appearedPercent?: number | null;
  rows: DcStudentPerformanceRow[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcActivityParticipation {
  id: string;
  schoolId: string;
  item: string;
  year: number;
  month: string;
  grade: string;
  activityName?: string;
  photoUrl?: string;
  photoKey?: string;
  conductedCount: number;
  participationRate?: number | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcEventParticipation {
  id: string;
  schoolId: string;
  academicYear: number;
  eventName: string;
  awardLevel: string;
  maleAwarded: number;
  femaleAwarded: number;
  othersAwarded: number;
  totalAwarded: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcFeeStructure {
  id: string;
  schoolId: string;
  academicYear: number;
  month: string;
  grade: string;
  admissionFee: number;
  tuitionFee: number;
  sessionFee: number;
  assessmentFee: number;
  sportsFee: number;
  syllabusFee: number;
  admissionForm: number;
  testimonialFee: number;
  othersFee: number;
  transportFee: number;
  exerciseBookFee: number;
  labLibraryFee: number;
  projectClubFee: number;
  sscRegistrationFee: number;
  boatFee: number;
  terminalAssessment1Fee: number;
  terminalAssessment2Fee: number;
  formativeAssessmentFee: number;
  classroomLibraryFee: number;
  eventFee: number;
  playActivityFee: number;
  createdById: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcFeeStructureLog {
  id: string;
  schoolId: string;
  month: string;
  grade: string;
  previousData: Record<string, unknown>;
  newData: Record<string, unknown>;
  editedById: string;
  editedBy?: { id: string; firstName: string; lastName: string };
  editedAt: string;
}

export interface DcRevenueTotalRecord {
  id: string;
  schoolId: string;
  academicYear: number;
  totalStudentsTarget: number;
  admissionFeeTarget: number;       admissionFeeAchievement: number;
  sessionFeeTarget: number;         sessionFeeAchievement: number;
  assessmentFeeTarget: number;      assessmentFeeAchievement: number;
  sportsFeeTarget: number;          sportsFeeAchievement: number;
  syllabusFeeTarget: number;        syllabusFeeAchievement: number;
  testimonialFeeTarget: number;     testimonialFeeAchievement: number;
  othersFeeTarget: number;          othersFeeAchievement: number;
  transportFeeTarget: number;       transportFeeAchievement: number;
  createdById: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DcRevenueMonthlyRecord {
  id: string;
  schoolId: string;
  academicYear: number;
  month: string;
  tuitionFeeTarget: number;
  tuitionFeeAchievement: number;
  admissionFeeTarget?: number;          admissionFeeAchievement?: number;
  sessionFeeTarget?: number;            sessionFeeAchievement?: number;
  assessmentFeeTarget?: number;         assessmentFeeAchievement?: number;
  sportsFeeTarget?: number;             sportsFeeAchievement?: number;
  syllabusFeeTarget?: number;           syllabusFeeAchievement?: number;
  admissionFormTarget?: number;         admissionFormAchievement?: number;
  testimonialFeeTarget?: number;        testimonialFeeAchievement?: number;
  othersFeeTarget?: number;             othersFeeAchievement?: number;
  transportFeeTarget?: number;          transportFeeAchievement?: number;
  exerciseBookFeeTarget?: number;       exerciseBookFeeAchievement?: number;
  labLibraryFeeTarget?: number;         labLibraryFeeAchievement?: number;
  projectClubFeeTarget?: number;        projectClubFeeAchievement?: number;
  sscRegistrationFeeTarget?: number;    sscRegistrationFeeAchievement?: number;
  boatFeeTarget?: number;               boatFeeAchievement?: number;
  terminalAssessment1FeeTarget?: number; terminalAssessment1FeeAchievement?: number;
  terminalAssessment2FeeTarget?: number; terminalAssessment2FeeAchievement?: number;
  formativeAssessmentFeeTarget?: number; formativeAssessmentFeeAchievement?: number;
  classroomLibraryFeeTarget?: number;   classroomLibraryFeeAchievement?: number;
  eventFeeTarget?: number;              eventFeeAchievement?: number;
  playActivityFeeTarget?: number;       playActivityFeeAchievement?: number;
  collectionPct: number;
  createdById: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
