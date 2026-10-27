export type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const DAYS: Day[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface AboutMe {
  interests: string[];
  skills: string[];
  careerGoals: string[];
}

export interface ParentVerification {
  isScheduleApproved: boolean;
  approvedDate?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  school: string;
  aboutMe: AboutMe;
  parentVerification: ParentVerification;
  teacherId?: string;
  joinCode: string;
}

export type Role = 'student' | 'parent' | 'teacher';

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  /** Set only for role 'student': the profile this login may edit. */
  studentId?: string;
}

export interface WeeklyScheduleItem {
  id: string;
  studentId: string;
  day: Day;
  timeSlot: string; // e.g. "15:00-17:00"
  activity: string;
  isFreeSlot: boolean;
  /** Derived from the school_hours table: the weekly timetable, not a removable row. */
  isSchool: boolean;
}

/** One weekday entry of the student's school timetable. */
export interface SchoolHour {
  studentId: string;
  day: Day;
  timeSlot: string; // e.g. "08:00-15:00"
}

export interface Assignment {
  id: string;
  studentId: string;
  title: string;
  subject: string;
  dueDate: string; // ISO date
  isCompleted: boolean;
}

export interface Exam {
  id: string;
  studentId: string;
  subject: string;
  examDate: string; // ISO date
  time: string; // e.g. "10:00"
}

export type OpportunityLevel = 'School' | 'National' | 'Global';

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  requiredSkills: string[];
  day: Day;
  timeSlot: string;
  level: OpportunityLevel;
  description: string;
  location: string;
  /** Last day to apply, ISO date. Empty when the opportunity has no deadline. */
  deadline: string;
  /** 0 means unlimited places. */
  capacity: number;
}

/** A student's place in an opportunity — the record behind the "Бүртгүүлэх" button. */
export interface OpportunitySignup {
  id: string;
  opportunityId: string;
  studentId: string;
  createdAt: string;
}

export interface ScheduleConflict {
  examOrAssignment: string;
  date: string;
  conflictDescriptionMongolian: string;
}

/** One measured reason behind the stress number, so the rating is explainable. */
export interface StressDriver {
  labelMongolian: string;
  detailMongolian: string;
  /** Points this driver added to the stress score. */
  impact: number;
  tone: 'ok' | 'warn' | 'danger';
}

export interface MatchedOpportunity {
  opportunityId: string;
  title: string;
  matchScore: string; // e.g. "95%"
  matchReasonMongolian: string;
}

export interface WorkloadAnalysis {
  studentName: string;
  workloadAnalysis: {
    workloadScore: number; // 1-10
    status: string;
    stressScore: number; // 0-100, measured independently of the load score
    stressRisk: 'Low' | 'Medium' | 'High';
    stressDrivers: StressDriver[];
    aiSummaryMongolian: string;
  };
  academicProgress: {
    totalAssignments: number;
    completedAssignments: number;
    completionPercentage: number;
    upcomingExamsCount: number;
    scheduleConflicts: ScheduleConflict[];
  };
  matchedOpportunities: MatchedOpportunity[];
  teacherRecommendations: {
    deadlineAdjustments: string;
    examPrepAdvice: string;
  };
  parentReport: {
    progressSummaryMongolian: string;
  };
  weeklyScheduleSummary: {
    totalActivityHours: number;
    schoolHours: number;
    freeHours: number;
    scheduledItems: number;
  };
}

/** An opportunity as a list carries it: match fields exist only when matching ran. */
export interface OpportunityView extends Opportunity {
  matchScore: string | null;
  matchReasonMongolian: string | null;
  /** Whether the requesting student already holds a place. */
  enrolled: boolean;
  /** Students already enrolled. */
  signups: number;
  /** null when the opportunity has no capacity limit. */
  placesLeft: number | null;
  /** Enrolled student names, oldest signup first — only a teacher's view fills this in. */
  signupNames?: string[];
}

export interface OpportunityWithMatch extends OpportunityView {
  matchScore: string;
  matchReasonMongolian: string;
}
