export const typeDefs = /* GraphQL */ `
  enum Day {
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
    Sunday
  }

  enum OpportunityLevel {
    School
    National
    Global
  }

  enum Role {
    student
    parent
    teacher
  }

  type AuthUser {
    id: ID!
    email: String!
    displayName: String!
    role: Role!
    """Profiles this account is allowed to see: self, linked children, or the whole roster."""
    students: [StudentProfile!]!
  }

  type AboutMe {
    interests: [String!]!
    skills: [String!]!
    careerGoals: [String!]!
  }

  type ParentVerification {
    isScheduleApproved: Boolean!
    approvedDate: String
  }

  type StudentProfile {
    id: ID!
    name: String!
    grade: String!
    school: String!
    aboutMe: AboutMe!
    parentVerification: ParentVerification!
  }

  type WeeklyScheduleItem {
    id: ID!
    studentId: ID!
    day: Day!
    timeSlot: String!
    activity: String!
    isFreeSlot: Boolean!
  }

  type Assignment {
    id: ID!
    studentId: ID!
    title: String!
    subject: String!
    dueDate: String!
    isCompleted: Boolean!
  }

  type Exam {
    id: ID!
    studentId: ID!
    subject: String!
    examDate: String!
    time: String!
  }

  type Opportunity {
    id: ID!
    title: String!
    organizer: String!
    requiredSkills: [String!]!
    day: Day!
    timeSlot: String!
    level: OpportunityLevel!
    matchScore: String
    matchReasonMongolian: String
  }

  type ScheduleConflict {
    examOrAssignment: String!
    date: String!
    conflictDescriptionMongolian: String!
  }

  type WorkloadInfo {
    workloadScore: Float!
    status: String!
    stressRisk: String!
    aiSummaryMongolian: String!
  }

  type AcademicProgress {
    totalAssignments: Int!
    completedAssignments: Int!
    completionPercentage: Int!
    upcomingExamsCount: Int!
    scheduleConflicts: [ScheduleConflict!]!
  }

  type MatchedOpportunity {
    opportunityId: ID!
    title: String!
    matchScore: String!
    matchReasonMongolian: String!
  }

  type TeacherRecommendations {
    deadlineAdjustments: String!
    examPrepAdvice: String!
  }

  type ParentReport {
    progressSummaryMongolian: String!
  }

  type WeeklyScheduleSummary {
    totalActivityHours: Float!
    scheduledItems: Int!
  }

  type WorkloadAnalysis {
    studentName: String!
    workloadAnalysis: WorkloadInfo!
    academicProgress: AcademicProgress!
    matchedOpportunities: [MatchedOpportunity!]!
    teacherRecommendations: TeacherRecommendations!
    parentReport: ParentReport!
    weeklyScheduleSummary: WeeklyScheduleSummary!
  }

  type ClassWorkloadRow {
    studentId: ID!
    studentName: String!
    grade: String!
    workloadScore: Float!
    status: String!
    stressRisk: String!
  }

  type Query {
    me: AuthUser
    students: [StudentProfile!]!
    student(id: ID!): StudentProfile
    schedule(studentId: ID!): [WeeklyScheduleItem!]!
    freeSlots(studentId: ID!): [WeeklyScheduleItem!]!
    assignments(studentId: ID!): [Assignment!]!
    exams(studentId: ID!): [Exam!]!
    opportunities: [Opportunity!]!
    matchedOpportunities(studentId: ID!): [Opportunity!]!
    workloadAnalysis(studentId: ID!): WorkloadAnalysis
    classWorkload: [ClassWorkloadRow!]!
    aiBackend: String!
  }

  type Mutation {
    login(email: String!, password: String!): AuthUser!
    logout: Boolean!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    createStudent(
      name: String!
      grade: String!
      school: String!
      email: String!
      password: String!
      parentEmail: String
      parentName: String
    ): StudentProfile!
    removeStudent(id: ID!): Boolean!
    updateAboutMe(
      studentId: ID!
      interests: [String!]!
      skills: [String!]!
      careerGoals: [String!]!
    ): StudentProfile!
    addScheduleItem(studentId: ID!, day: Day!, timeSlot: String!, activity: String!): WeeklyScheduleItem!
    removeScheduleItem(id: ID!): Boolean!
    approveSchedule(studentId: ID!, approved: Boolean!): StudentProfile!
    toggleAssignment(id: ID!, isCompleted: Boolean!): Assignment
    createAssignment(studentId: ID!, title: String!, subject: String!, dueDate: String!): Assignment!
    deleteAssignment(id: ID!): Boolean!
    createExam(studentId: ID!, subject: String!, examDate: String!, time: String!): Exam!
    deleteExam(id: ID!): Boolean!
    createOpportunity(
      title: String!
      organizer: String!
      requiredSkills: [String!]!
      day: Day!
      timeSlot: String!
      level: OpportunityLevel!
    ): Opportunity!
    deleteOpportunity(id: ID!): Boolean!
  }
`;
