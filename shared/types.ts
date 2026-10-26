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
}

export interface ScheduleConflict {
  examOrAssignment: string;
  date: string;
  conflictDescriptionMongolian: string;
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
    stressRisk: 'Low' | 'Medium' | 'High';
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
}

export interface OpportunityWithMatch extends Opportunity {
  matchScore: string;
  matchReasonMongolian: string;
}
