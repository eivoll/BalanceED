import { AuthenticationError, ForbiddenError, UserInputError } from './errors.js';
import { db } from './db.js';
import {
  buildClassWorkload,
  buildWorkloadAnalysis,
  computeFreeSlots,
  freeSlotsFrom,
  matchOpportunities,
} from './ai/analysis.js';
import { gemmaEnabled } from './ai/gemma.js';
import { hashPassword, normaliseEmail, verifyOrPad, verifyPassword } from './auth.js';
import { DAYS } from '../shared/types.js';
import type { Day, StudentProfile, UserAccount, WeeklyScheduleItem } from '../shared/types.js';

export interface Ctx {
  user: UserAccount | null;
  /** Issues a fresh session token for this account and sends it as a cookie. */
  openSession(userId: string): void;
  /** Revokes the caller's session and expires the cookie. */
  closeSession(): void;
}

type Action = 'view' | 'edit' | 'approve' | 'teach';

const DENIAL: Record<Action, string> = {
  view: 'Энэ сурагчийн мэдээллийг харах эрх танд байхгүй.',
  edit: 'Энэ сурагчийн мэдээллийг өөрчлөх эрх танд байхгүй.',
  approve: 'Хуваарийг зөвхөн тухайн сурагчийн эцэг эх л зөвшөөрч болно.',
  teach: 'Энэ үйлдлийг зөвхөн багш хийх эрхтэй.',
};

function currentUser(ctx: Ctx): UserAccount {
  if (!ctx.user) throw new AuthenticationError('Энэ үйлдлийг хийхийн тулд эхлээд нэвтэрнэ үү.');
  return ctx.user;
}

function visibleStudents(user: UserAccount): StudentProfile[] {
  if (user.role === 'teacher') return db.students.byTeacher(user.id);
  if (user.role === 'parent') {
    return db.parentLinks
      .childrenOf(user.id)
      .map((id) => db.students.byId(id))
      .filter((s): s is StudentProfile => Boolean(s));
  }
  const own = user.studentId ? db.students.byId(user.studentId) : undefined;
  return own ? [own] : [];
}

function authorize(ctx: Ctx, studentId: string, action: Action): StudentProfile {
  const user = currentUser(ctx);
  const student = db.students.byId(studentId);
  if (!student) throw new UserInputError(`Сурагч олдсонгүй: ${studentId}`);
  const isTeacherOf = user.role === 'teacher' && student.teacherId === user.id;
  const isSelf = user.role === 'student' && user.studentId === studentId;
  const isParentOf = user.role === 'parent' && db.parentLinks.isLinked(user.id, studentId);
  const allowed =
    action === 'view'
      ? isTeacherOf || isSelf || isParentOf
      : action === 'edit'
        ? isTeacherOf || isSelf
        : action === 'approve'
          ? isParentOf
          : isTeacherOf;
  if (!allowed) throw new ForbiddenError(DENIAL[action]);
  return student;
}

/** Looks up a child row and authorises through its owner; returns undefined when the row is gone. */
function authorizeItem(ctx: Ctx, table: 'schedule' | 'assignments' | 'exams', id: string, action: Action): string | undefined {
  const item = db[table].byId(id);
  if (!item) return undefined;
  authorize(ctx, item.studentId, action);
  return id;
}

const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function validateSlot(timeSlot: string) {
  if (!SLOT_RE.test(timeSlot)) throw new UserInputError(`Цагийн завсар буруу байна: "${timeSlot}" — зөв хэлбэр нь HH:MM-HH:MM`);
  const [a, b] = timeSlot.split('-');
  if (a >= b) throw new UserInputError(`Цагийн завсар буруу байна: "${timeSlot}" — эхлэх цаг дуусах цагаас өмнө байх ёстой`);
}

function fullSchedule(studentId: string): WeeklyScheduleItem[] {
  const stored = db.schedule.byStudent(studentId).filter((i) => !i.isFreeSlot);
  const free = freeSlotsFrom(studentId, stored);
  const dayIdx = (d: Day) => DAYS.indexOf(d);
  return [...stored, ...free].sort(
    (a, b) => dayIdx(a.day) - dayIdx(b.day) || a.timeSlot.localeCompare(b.timeSlot),
  );
}

function parseEmail(raw: string): string {
  const email = normaliseEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserInputError('И-мэйл хаяг буруу байна.');
  return email;
}

function parsePassword(raw: string): string {
  if (raw.length < 8) throw new UserInputError('Нууц үг дор хаяж 8 тэмдэгт байх ёстой.');
  return raw;
}

export const resolvers = {
  AuthUser: {
    students: (user: UserAccount) => visibleStudents(user),
  },

  Query: {
    me: (_: unknown, __: unknown, ctx: Ctx) => ctx.user,
    students: (_: unknown, __: unknown, ctx: Ctx) => visibleStudents(currentUser(ctx)),
    student: (_: unknown, { id }: { id: string }, ctx: Ctx) => authorize(ctx, id, 'view'),
    schedule: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) =>
      fullSchedule(authorize(ctx, studentId, 'view').id),
    freeSlots: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) =>
      computeFreeSlots(authorize(ctx, studentId, 'view').id),
    assignments: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) => {
      const owner = authorize(ctx, studentId, 'view');
      return db.assignments.byStudent(owner.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },
    exams: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) => {
      const owner = authorize(ctx, studentId, 'view');
      return db.exams.byStudent(owner.id).sort((a, b) => a.examDate.localeCompare(b.examDate));
    },
    opportunities: (_: unknown, __: unknown, ctx: Ctx) => {
      currentUser(ctx);
      return db.opportunities.all();
    },
    matchedOpportunities: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) => {
      const student = authorize(ctx, studentId, 'view');
      return matchOpportunities(student, computeFreeSlots(student.id));
    },
    workloadAnalysis: async (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) =>
      buildWorkloadAnalysis(authorize(ctx, studentId, 'view')),
    classWorkload: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = currentUser(ctx);
      if (user.role !== 'teacher') throw new ForbiddenError('Ангийн ачааллыг зөвхөн багш харах эрхтэй.');
      return buildClassWorkload(visibleStudents(user));
    },
    aiBackend: () =>
      gemmaEnabled ? `Gemma (${process.env.GEMMA_MODEL || 'gemma-3-27b-it'})` : 'built-in heuristic engine',
  },

  Mutation: {
    login: async (_: unknown, { email, password }: { email: string; password: string }, ctx: Ctx) => {
      const user = db.users.byEmail(normaliseEmail(email));
      // Same message and same scrypt cost whether or not the address exists.
      const ok = await verifyOrPad(password, user?.passwordHash);
      if (!ok || !user) throw new UserInputError('И-мэйл эсвэл нууц үг буруу байна.');
      ctx.openSession(user.id);
      return user;
    },

    logout: (_: unknown, __: unknown, ctx: Ctx) => {
      ctx.closeSession();
      return true;
    },

    changePassword: async (
      _: unknown,
      { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
      ctx: Ctx,
    ) => {
      const user = currentUser(ctx);
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new UserInputError('Одоогийн нууц үг буруу байна.');
      }
      const next = parsePassword(newPassword);
      db.users.update(user.id, { passwordHash: await hashPassword(next) });
      // Force every other device to sign in again with the new password.
      db.sessions.dropAllForUser(user.id);
      ctx.openSession(user.id);
      return true;
    },

    createStudent: async (
      _: unknown,
      args: {
        name: string;
        grade: string;
        school: string;
        email: string;
        password: string;
        parentEmail?: string;
        parentName?: string;
      },
      ctx: Ctx,
    ) => {
      const teacher = currentUser(ctx);
      if (teacher.role !== 'teacher') throw new ForbiddenError(DENIAL.teach);
      const name = args.name.trim();
      if (!name) throw new UserInputError('Сурагчийн нэр хоосон байж болохгүй.');
      const email = parseEmail(args.email);
      const password = parsePassword(args.password);
      if (db.users.byEmail(email)) throw new UserInputError(`${email} хаяг аль хэдийн бүртгэлтэй байна.`);

      const student = db.students.insert(
        {
          name,
          grade: args.grade.trim(),
          school: args.school.trim(),
          aboutMe: { interests: [], skills: [], careerGoals: [] },
          parentVerification: { isScheduleApproved: false },
          teacherId: teacher.id,
        },
        'stu',
      );
      db.users.insert(
        {
          email,
          displayName: name,
          role: 'student',
          passwordHash: await hashPassword(password),
          createdAt: new Date().toISOString(),
          studentId: student.id,
        },
        'usr',
      );

      if (args.parentEmail?.trim()) {
        const parentEmail = parseEmail(args.parentEmail);
        const existing = db.users.byEmail(parentEmail);
        const parentId =
          existing?.id ??
          db.users.insert(
            {
              email: parentEmail,
              displayName: args.parentName?.trim() || 'Эцэг эх',
              role: 'parent',
              passwordHash: await hashPassword(parsePassword(args.password)),
              createdAt: new Date().toISOString(),
            },
            'usr',
          ).id;
        db.parentLinks.add(parentId, student.id);
      }
      return student;
    },

    removeStudent: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      authorize(ctx, id, 'teach');
      const account = db.users.byStudent(id);
      if (account) db.sessions.dropAllForUser(account.id);
      const parentIds = db.parentLinks.parentsOf(id);
      for (const parentId of parentIds) db.parentLinks.remove(parentId, id);
      db.schedule.removeForStudent(id);
      db.assignments.removeForStudent(id);
      db.exams.removeForStudent(id);
      if (account) db.users.remove(account.id);
      // A parent account created for this student only is useless once the link is gone.
      for (const parentId of parentIds) {
        if (db.parentLinks.childrenOf(parentId).length > 0) continue;
        const parent = db.users.byId(parentId);
        if (parent?.role !== 'parent') continue;
        db.sessions.dropAllForUser(parentId);
        db.users.remove(parentId);
      }
      return db.students.remove(id);
    },

    updateAboutMe: (
      _: unknown,
      { studentId, interests, skills, careerGoals }: { studentId: string; interests: string[]; skills: string[]; careerGoals: string[] },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'edit');
      return db.students.update(studentId, { aboutMe: { interests, skills, careerGoals } })!;
    },

    addScheduleItem: (
      _: unknown,
      { studentId, day, timeSlot, activity }: { studentId: string; day: Day; timeSlot: string; activity: string },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'edit');
      validateSlot(timeSlot);
      // Any schedule change invalidates prior parent verification.
      db.students.update(studentId, { parentVerification: { isScheduleApproved: false } });
      return db.schedule.insert({ studentId, day, timeSlot, activity, isFreeSlot: false }, 'sch');
    },

    removeScheduleItem: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'schedule', id, 'edit')) return false;
      const item = db.schedule.byId(id)!;
      db.students.update(item.studentId, { parentVerification: { isScheduleApproved: false } });
      return db.schedule.remove(id);
    },

    approveSchedule: (_: unknown, { studentId, approved }: { studentId: string; approved: boolean }, ctx: Ctx) => {
      authorize(ctx, studentId, 'approve');
      return db.students.update(studentId, {
        parentVerification: {
          isScheduleApproved: approved,
          approvedDate: approved ? new Date().toISOString().slice(0, 10) : undefined,
        },
      })!;
    },

    toggleAssignment: (_: unknown, { id, isCompleted }: { id: string; isCompleted: boolean }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'assignments', id, 'edit')) return null;
      return db.assignments.update(id, { isCompleted }) ?? null;
    },

    createAssignment: (
      _: unknown,
      { studentId, title, subject, dueDate }: { studentId: string; title: string; subject: string; dueDate: string },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'teach');
      return db.assignments.insert({ studentId, title, subject, dueDate, isCompleted: false }, 'asg');
    },

    deleteAssignment: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'assignments', id, 'teach')) return false;
      return db.assignments.remove(id);
    },

    createExam: (
      _: unknown,
      { studentId, subject, examDate, time }: { studentId: string; subject: string; examDate: string; time: string },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'teach');
      return db.exams.insert({ studentId, subject, examDate, time }, 'exm');
    },

    deleteExam: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'exams', id, 'teach')) return false;
      return db.exams.remove(id);
    },

    createOpportunity: (
      _: unknown,
      args: { title: string; organizer: string; requiredSkills: string[]; day: Day; timeSlot: string; level: 'School' | 'National' | 'Global' },
      ctx: Ctx,
    ) => {
      const user = currentUser(ctx);
      if (user.role === 'student') throw new ForbiddenError('Сурагч боломж нийтлэх эрхгүй.');
      validateSlot(args.timeSlot);
      return db.opportunities.insert(args, 'opp');
    },

    deleteOpportunity: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      const user = currentUser(ctx);
      if (user.role === 'student') throw new ForbiddenError('Сурагч боломж устгах эрхгүй.');
      return db.opportunities.remove(id);
    },
  },
};
