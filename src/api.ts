const ENDPOINT = '/graphql';

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Серверт холбогдсонгүй — ажиллаж байгаа эсэхийг шалгана уу.');
  }
  let json: { data?: T; errors?: { message: string }[] };
  try {
    json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  } catch {
    throw new Error('Серверийн хариуг уншиж чадсангүй.');
  }
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** Runs a mutation and returns null on success or the server's message on failure. */
export async function attempt(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Серверт холбогдсонгүй. Дахин оролдоно уу.';
  }
}

const STUDENT_FIELDS =
  'id name grade school aboutMe { interests skills careerGoals } parentVerification { isScheduleApproved approvedDate } hasParent hasTeacher joinCode';

const OPPORTUNITY_FIELDS =
  'id title organizer requiredSkills day timeSlot level description location deadline capacity enrolled signups placesLeft';

export interface SchoolHourInput {
  day: string;
  timeSlot: string;
}

export const A = {
  me: () => gql<{ me: AuthUserDTO | null }>(
    `{ me { id email displayName role students { ${STUDENT_FIELDS} } } }`,
  ).then((d) => d.me),
  login: (email: string, password: string) =>
    gql<{ login: AuthUserDTO }>(
      `mutation ($e: String!, $p: String!) { login(email: $e, password: $p) { id email displayName role students { ${STUDENT_FIELDS} } } }`,
      { e: email, p: password },
    ).then((d) => d.login),
  signup: (input: SignupInput) =>
    gql<{ signup: AuthUserDTO }>(
      `mutation ($i: StudentInput!) { signup(input: $i) { id email displayName role students { ${STUDENT_FIELDS} } } }`,
      { i: input },
    ).then((d) => d.signup),
  logout: () => gql(`mutation { logout }`),
  changePassword: (currentPassword: string, newPassword: string) =>
    gql(`mutation ($c: String!, $n: String!) { changePassword(currentPassword: $c, newPassword: $n) }`, {
      c: currentPassword,
      n: newPassword,
    }),
};

export const Q = {
  students: () => gql<{ students: StudentDTO[] }>(
    `{ students { ${STUDENT_FIELDS} } }`,
  ),
  schedule: (studentId: string) => gql<{ schedule: ScheduleItemDTO[] }>(
    `query ($id: ID!) { schedule(studentId: $id) { id studentId day timeSlot activity isFreeSlot isSchool } }`,
    { id: studentId },
  ),
  schoolHours: (studentId: string) => gql<{ schoolHours: SchoolHourDTO[] }>(
    `query ($id: ID!) { schoolHours(studentId: $id) { studentId day timeSlot } }`,
    { id: studentId },
  ),
  assignments: (studentId: string) => gql<{ assignments: AssignmentDTO[] }>(
    `query ($id: ID!) { assignments(studentId: $id) { id studentId title subject dueDate isCompleted } }`,
    { id: studentId },
  ),
  exams: (studentId: string) => gql<{ exams: ExamDTO[] }>(
    `query ($id: ID!) { exams(studentId: $id) { id studentId subject examDate time } }`,
    { id: studentId },
  ),
  opportunities: () => gql<{ opportunities: OpportunityDTO[] }>(
    `{ opportunities { ${OPPORTUNITY_FIELDS} signupNames } }`,
  ),
  matched: (studentId: string) => gql<{ matchedOpportunities: OpportunityDTO[] }>(
    `query ($id: ID!) { matchedOpportunities(studentId: $id) { ${OPPORTUNITY_FIELDS} matchScore matchReasonMongolian } }`,
    { id: studentId },
  ),
  analysis: (studentId: string) => gql<{ workloadAnalysis: AnalysisDTO }>(
    `query ($id: ID!) {
      workloadAnalysis(studentId: $id) {
        studentName
        workloadAnalysis {
          workloadScore status stressScore stressRisk aiSummaryMongolian
          stressDrivers { labelMongolian detailMongolian impact tone }
        }
        academicProgress { totalAssignments completedAssignments completionPercentage overdueAssignments upcomingExamsCount scheduleConflicts { examOrAssignment date conflictDescriptionMongolian } }
        matchedOpportunities { opportunityId title matchScore matchReasonMongolian }
        teacherRecommendations { deadlineAdjustments examPrepAdvice }
        parentReport { progressSummaryMongolian }
        weeklyScheduleSummary { totalActivityHours schoolHours freeHours scheduledItems }
      }
    }`,
    { id: studentId },
  ),
  classWorkload: () => gql<{ classWorkload: ClassRowDTO[] }>(
    `{ classWorkload { studentId studentName grade workloadScore status stressScore stressRisk topDriver } }`,
  ),
};

export const M = {
  updateAboutMe: (studentId: string, interests: string[], skills: string[], careerGoals: string[]) =>
    gql(`mutation ($id: ID!, $i: [String!]!, $s: [String!]!, $c: [String!]!) {
      updateAboutMe(studentId: $id, interests: $i, skills: $s, careerGoals: $c) { id aboutMe { interests skills careerGoals } }
    }`, { id: studentId, i: interests, s: skills, c: careerGoals }),
  addScheduleItem: (studentId: string, day: string, timeSlot: string, activity: string) =>
    gql(`mutation ($id: ID!, $day: Day!, $slot: String!, $act: String!) {
      addScheduleItem(studentId: $id, day: $day, timeSlot: $slot, activity: $act) { id }
    }`, { id: studentId, day, slot: timeSlot, act: activity }),
  removeScheduleItem: (id: string) =>
    gql(`mutation ($id: ID!) { removeScheduleItem(id: $id) }`, { id }),
  setSchoolHours: (studentId: string, entries: SchoolHourInput[]) =>
    gql(`mutation ($id: ID!, $e: [SchoolHourInput!]!) {
      setSchoolHours(studentId: $id, entries: $e) { studentId day timeSlot }
    }`, { id: studentId, e: entries }),
  approveSchedule: (studentId: string, approved: boolean) =>
    gql(`mutation ($id: ID!, $ok: Boolean!) {
      approveSchedule(studentId: $id, approved: $ok) { id parentVerification { isScheduleApproved approvedDate } }
    }`, { id: studentId, ok: approved }),
  joinTeacher: (code: string) =>
    gql(`mutation ($c: String!) { joinTeacher(code: $c) { id name } }`, { c: code }),
  linkParent: (code: string) =>
    gql(`mutation ($c: String!) { linkParent(code: $c) { id name } }`, { c: code }),
  toggleAssignment: (id: string, isCompleted: boolean) =>
    gql(`mutation ($id: ID!, $done: Boolean!) { toggleAssignment(id: $id, isCompleted: $done) { id } }`, { id, done: isCompleted }),
  createAssignment: (studentId: string, title: string, subject: string, dueDate: string) =>
    gql(`mutation ($id: ID!, $t: String!, $s: String!, $d: String!) {
      createAssignment(studentId: $id, title: $t, subject: $s, dueDate: $d) { id }
    }`, { id: studentId, t: title, s: subject, d: dueDate }),
  createExam: (studentId: string, subject: string, examDate: string, time: string) =>
    gql(`mutation ($id: ID!, $s: String!, $d: String!, $t: String!) {
      createExam(studentId: $id, subject: $s, examDate: $d, time: $t) { id }
    }`, { id: studentId, s: subject, d: examDate, t: time }),
  createOpportunity: (args: OpportunityInput) =>
    gql(`mutation ($i: OpportunityInput!) { createOpportunity(input: $i) { id } }`, { i: args }),
  deleteOpportunity: (id: string) => gql(`mutation ($id: ID!) { deleteOpportunity(id: $id) }`, { id }),
  createStudent: (args: StudentInput) =>
    gql(`mutation ($i: StudentInput!) { createStudent(input: $i) { id } }`, { i: args }),
  removeStudent: (id: string) => gql(`mutation ($id: ID!) { removeStudent(id: $id) }`, { id }),
  enrollOpportunity: (opportunityId: string) =>
    gql<{ enrollOpportunity: OpportunityDTO }>(
      `mutation ($id: ID!) { enrollOpportunity(opportunityId: $id) { ${OPPORTUNITY_FIELDS} } }`,
      { id: opportunityId },
    ).then((d) => d.enrollOpportunity),
  unenrollOpportunity: (opportunityId: string) =>
    gql<{ unenrollOpportunity: OpportunityDTO }>(
      `mutation ($id: ID!) { unenrollOpportunity(opportunityId: $id) { ${OPPORTUNITY_FIELDS} } }`,
      { id: opportunityId },
    ).then((d) => d.unenrollOpportunity),
};

export interface ScheduleItemDTO {
  id: string; studentId: string; day: string; timeSlot: string; activity: string;
  isFreeSlot: boolean; isSchool: boolean;
}
export interface SchoolHourDTO { studentId: string; day: string; timeSlot: string }
export interface AssignmentDTO {
  id: string; studentId: string; title: string; subject: string; dueDate: string; isCompleted: boolean;
}
export interface ExamDTO { id: string; studentId: string; subject: string; examDate: string; time: string }
export interface OpportunityDTO {
  id: string; title: string; organizer: string; requiredSkills: string[];
  day: string; timeSlot: string; level: string;
  description: string; location: string; deadline: string; capacity: number;
  enrolled: boolean; signups: number; placesLeft: number | null;
  /** Only the teacher's own query asks for this, so it is absent everywhere else. */
  signupNames?: string[] | null;
  matchScore?: string | null; matchReasonMongolian?: string | null;
}
export interface StressDriverDTO {
  labelMongolian: string; detailMongolian: string; impact: number; tone: 'ok' | 'warn' | 'danger';
}
export interface AnalysisDTO {
  studentName: string;
  workloadAnalysis: {
    workloadScore: number; status: string; stressScore: number; stressRisk: string;
    stressDrivers: StressDriverDTO[]; aiSummaryMongolian: string;
  };
  academicProgress: {
    totalAssignments: number; completedAssignments: number; completionPercentage: number;
    overdueAssignments: number; upcomingExamsCount: number;
    scheduleConflicts: { examOrAssignment: string; date: string; conflictDescriptionMongolian: string }[];
  };
  matchedOpportunities: { opportunityId: string; title: string; matchScore: string; matchReasonMongolian: string }[];
  teacherRecommendations: { deadlineAdjustments: string; examPrepAdvice: string };
  parentReport: { progressSummaryMongolian: string };
  weeklyScheduleSummary: { totalActivityHours: number; schoolHours: number; freeHours: number; scheduledItems: number };
}
export interface ClassRowDTO {
  studentId: string; studentName: string; grade: string;
  workloadScore: number; status: string; stressScore: number; stressRisk: string;
  topDriver: string | null;
}
export interface StudentDTO {
  id: string; name: string; grade: string; school: string;
  aboutMe: { interests: string[]; skills: string[]; careerGoals: string[] };
  parentVerification: { isScheduleApproved: boolean; approvedDate?: string };
  hasParent: boolean;
  hasTeacher: boolean;
  joinCode: string | null;
}

export type RoleDTO = 'student' | 'parent' | 'teacher';

export interface AuthUserDTO {
  id: string;
  email: string;
  displayName: string;
  role: RoleDTO;
  /** Profiles this account may see — the server already filtered them. */
  students: StudentDTO[];
}

export interface SignupInput {
  name: string;
  grade: string;
  school: string;
  email: string;
  password: string;
  parentName?: string;
  parentEmail?: string;
  parentPassword?: string;
  interests?: string[];
  skills?: string[];
  careerGoals?: string[];
  schoolHours: SchoolHourInput[];
}

export interface StudentInput {
  name: string;
  grade: string;
  school: string;
  email: string;
  password: string;
  parentEmail?: string;
  parentName?: string;
  parentPassword?: string;
  schoolHours?: SchoolHourInput[];
}

export interface OpportunityInput {
  title: string;
  organizer: string;
  requiredSkills: string[];
  day: string;
  timeSlot: string;
  level: string;
  description?: string;
  location?: string;
  deadline?: string;
  capacity?: number;
}
