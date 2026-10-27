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

  input SchoolHourInput {
    day: Day!
    timeSlot: String!
  }

  """Everything one form collects to bring a student and their login into being."""
  input StudentInput {
    name: String!
    grade: String!
    school: String!
    email: String!
    password: String!
    parentName: String
    parentEmail: String
    parentPassword: String
    interests: [String!]
    skills: [String!]
    careerGoals: [String!]
    schoolHours: [SchoolHourInput!]
  }

  input OpportunityInput {
    title: String!
    organizer: String!
    requiredSkills: [String!]!
    day: Day!
    timeSlot: String!
    level: OpportunityLevel!
    description: String
    location: String
    deadline: String
    capacity: Int
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
    """False when the student registered without a parent, so nothing is being waited on."""
    hasParent: Boolean!
  }

  type WeeklyScheduleItem {
    id: ID!
    studentId: ID!
    day: Day!
    timeSlot: String!
    activity: String!
    isFreeSlot: Boolean!
    """The weekly school timetable: shown in the grid, edited a whole week at a time."""
    isSchool: Boolean!
  }

  type SchoolHour {
    studentId: ID!
    day: Day!
    timeSlot: String!
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
    description: String!
    location: String!
    """Last day to apply; empty when the opportunity stays open."""
    deadline: String!
    """0 means the place count is unlimited."""
    capacity: Int!
    matchScore: String
    matchReasonMongolian: String
    """Whether the student viewing this list already holds a place."""
    enrolled: Boolean!
    signups: Int!
    """null when there is no capacity limit."""
    placesLeft: Int
    """Names of the students holding a place, oldest signup first; null unless a teacher asks."""
    signupNames: [String!]
  }

  type ScheduleConflict {
    examOrAssignment: String!
    date: String!
    conflictDescriptionMongolian: String!
  }

  type StressDriver {
    labelMongolian: String!
    detailMongolian: String!
    """Points this driver added to the stress score."""
    impact: Float!
    tone: String!
  }

  type WorkloadInfo {
    workloadScore: Float!
    status: String!
    """0-100, measured from deadlines, recovery time and timetable pressure."""
    stressScore: Int!
    stressRisk: String!
    stressDrivers: [StressDriver!]!
    aiSummaryMongolian: String!
  }

  type AcademicProgress {
    totalAssignments: Int!
    completedAssignments: Int!
    completionPercentage: Int!
    overdueAssignments: Int!
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
    schoolHours: Float!
    freeHours: Float!
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
    stressScore: Int!
    stressRisk: String!
    """The single biggest contributor to that student's stress, in Mongolian."""
    topDriver: String
  }

  type Query {
    me: AuthUser
    students: [StudentProfile!]!
    student(id: ID!): StudentProfile
    schedule(studentId: ID!): [WeeklyScheduleItem!]!
    schoolHours(studentId: ID!): [SchoolHour!]!
    freeSlots(studentId: ID!): [WeeklyScheduleItem!]!
    assignments(studentId: ID!): [Assignment!]!
    exams(studentId: ID!): [Exam!]!
    opportunities: [Opportunity!]!
    matchedOpportunities(studentId: ID!): [Opportunity!]!
    workloadAnalysis(studentId: ID!): WorkloadAnalysis
    classWorkload: [ClassWorkloadRow!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthUser!
    """Public registration: creates the student, their login, the timetable and, optionally, the parent link."""
    signup(input: StudentInput!): AuthUser!
    logout: Boolean!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    createStudent(input: StudentInput!): StudentProfile!
    removeStudent(id: ID!): Boolean!
    updateAboutMe(
      studentId: ID!
      interests: [String!]!
      skills: [String!]!
      careerGoals: [String!]!
    ): StudentProfile!
    addScheduleItem(studentId: ID!, day: Day!, timeSlot: String!, activity: String!): WeeklyScheduleItem!
    removeScheduleItem(id: ID!): Boolean!
    """Replaces the whole week; an empty list clears the timetable."""
    setSchoolHours(studentId: ID!, entries: [SchoolHourInput!]!): [SchoolHour!]!
    approveSchedule(studentId: ID!, approved: Boolean!): StudentProfile!
    toggleAssignment(id: ID!, isCompleted: Boolean!): Assignment
    createAssignment(studentId: ID!, title: String!, subject: String!, dueDate: String!): Assignment!
    deleteAssignment(id: ID!): Boolean!
    createExam(studentId: ID!, subject: String!, examDate: String!, time: String!): Exam!
    deleteExam(id: ID!): Boolean!
    createOpportunity(input: OpportunityInput!): Opportunity!
    deleteOpportunity(id: ID!): Boolean!
    enrollOpportunity(opportunityId: ID!): Opportunity!
    unenrollOpportunity(opportunityId: ID!): Opportunity!
  }
`;
