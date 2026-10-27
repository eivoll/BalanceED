import { AuthenticationError, ForbiddenError, UserInputError } from './errors.js';
import { db, normaliseJoinCode, uniqueJoinCode } from './db.js';
import {
  buildClassWorkload,
  buildWorkloadAnalysis,
  computeFreeSlots,
  freeSlotsFrom,
  matchOpportunities,
  overlaps,
  parseSlot,
  schoolItems,
} from './ai/analysis.js';
import { hashPassword, normaliseEmail, verifyOrPad, verifyPassword } from './auth.js';
import { DAYS } from '../shared/types.js';
import type {
  Day,
  Opportunity,
  OpportunityView,
  SchoolHour,
  StudentProfile,
  UserAccount,
  WeeklyScheduleItem,
} from '../shared/types.js';

export interface Ctx {
  user: UserAccount | null;
  /**
   * Mutable view of the caller's session. Field resolvers receive a snapshot of this
   * context object, so login/signup publish the session they just opened through this
   * shared box instead of a top-level property the snapshot would freeze.
   */
  session: { userId: string | null };
  /** Issues a fresh session token for this account and sends it as a cookie. */
  openSession(userId: string): void;
  /** Revokes the caller's session and expires the cookie. */
  closeSession(): void;
}

type Action = 'view' | 'edit' | 'approve' | 'teach' | 'remove';

const DENIAL: Record<Action, string> = {
  view: 'Энэ сурагчийн мэдээллийг харах эрх танд байхгүй.',
  edit: 'Энэ сурагчийн мэдээллийг өөрчлөх эрх танд байхгүй.',
  approve: 'Хуваарийг зөвхөн тухайн сурагчийн эцэг эх л зөвшөөрч болно.',
  teach: 'Энэ үйлдлийг зөвхөн багш хийх эрхтэй.',
  remove: 'Бүртгэлийг зөвхөн сурагч өөрөө эсвэл түүний багш устгаж болно.',
};

const DAY_MN: Record<Day, string> = {
  Monday: 'Даваа',
  Tuesday: 'Мягмар',
  Wednesday: 'Лхагва',
  Thursday: 'Пүрэв',
  Friday: 'Баасан',
  Saturday: 'Бямба',
  Sunday: 'Ням',
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

/** The student a list should be read through: self, or the parent's first child. */
function viewerStudentId(user: UserAccount): string | null {
  if (user.role === 'student') return user.studentId ?? null;
  if (user.role === 'parent') return db.parentLinks.childrenOf(user.id)[0] ?? null;
  return null;
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
          : action === 'remove'
            ? isTeacherOf || isSelf
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
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GRADE_RE = /^([1-9]|1[0-2])(-[А-ЯЁа-яёA-Za-z]{1,2})?$/;

function validateSlot(timeSlot: string) {
  if (!SLOT_RE.test(timeSlot)) throw new UserInputError(`Цагийн завсар буруу байна: "${timeSlot}" — зөв хэлбэр нь HH:MM-HH:MM`);
  const [a, b] = timeSlot.split('-');
  if (a >= b) throw new UserInputError(`Цагийн завсар буруу байна: "${timeSlot}" — эхлэх цаг дуусах цагаас өмнө байх ёстой`);
}

function validateDate(value: string, label: string): string {
  const iso = value.trim();
  if (!DATE_RE.test(iso) || Number.isNaN(new Date(`${iso}T12:00:00`).getTime())) {
    throw new UserInputError(`${label}: огноо 2026-10-31 хэлбэрээр байх ёстой.`);
  }
  return iso;
}

function validateTime(value: string, label: string): string {
  const iso = value.trim();
  if (!TIME_RE.test(iso)) throw new UserInputError(`${label}: цаг HH:MM хэлбэрээр байх ёстой.`);
  return iso;
}

function parseGrade(raw: string): string {
  const grade = raw.trim();
  if (!GRADE_RE.test(grade)) throw new UserInputError('Анги буруу байна — 10 эсвэл 11-Б гэж бичнэ үү.');
  return grade;
}

/** Tags arrive from free-typing: blanks, case-duplicate and over-long entries never reach the database. */
function cleanTags(list: string[] | undefined, limit = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const value = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function timetableEntries(entries: { day: Day; timeSlot: string }[] | undefined): { day: Day; timeSlot: string }[] {
  const list = entries ?? [];
  if (list.length > DAYS.length) throw new UserInputError('Долоо хоногт 7-оос олон хичээлийн цаг оруулж болохгүй.');
  const byDay = new Map<Day, string>();
  for (const entry of list) {
    if (!DAYS.includes(entry.day)) throw new UserInputError('Өдөр буруу байна — долоо хоногийн өдрүүдийн нэгийг сонгоно уу.');
    validateSlot(entry.timeSlot);
    const [start, end] = parseSlot(entry.timeSlot);
    if (end - start > 10) {
      throw new UserInputError(`${DAY_MN[entry.day]} гарагийн хичээл 10 цагаас дээш үргэлжлэх ёсгүй.`);
    }
    if (byDay.has(entry.day)) throw new UserInputError(`${DAY_MN[entry.day]} гараг давхардсан — нэг өдөрт нэг хичээлийн цаг оруулна уу.`);
    byDay.set(entry.day, entry.timeSlot);
  }
  return DAYS.filter((d) => byDay.has(d)).map((day) => ({ day, timeSlot: byDay.get(day)! }));
}

function fullSchedule(studentId: string): WeeklyScheduleItem[] {
  const stored = db.schedule.byStudent(studentId).filter((i) => !i.isFreeSlot);
  const school = db.schoolHours.byStudent(studentId);
  const free = freeSlotsFrom(studentId, stored, school);
  const dayIdx = (d: Day) => DAYS.indexOf(d);
  return [...stored, ...schoolItems(studentId, school), ...free].sort(
    (a, b) => dayIdx(a.day) - dayIdx(b.day) || a.timeSlot.localeCompare(b.timeSlot),
  );
}

/** Adds the enrollment state the requesting student cares about to a plain opportunity row. */
/** Signup facts a viewer is entitled to, read once so a list costs three queries, not three per row. */
interface SignupFacts {
  viewerId: string | null;
  counts: Map<string, number>;
  enrolled: Set<string>;
  roster: Map<string, string[]> | null;
}

function signupFacts(user: UserAccount): SignupFacts {
  const viewerId = viewerStudentId(user);
  return {
    viewerId,
    counts: db.signups.counts(),
    enrolled: viewerId ? db.signups.opportunityIdsFor(viewerId) : new Set(),
    roster: user.role === 'teacher' ? db.signups.rosterByOpportunity() : null,
  };
}

function asView(opp: Opportunity, facts: SignupFacts): OpportunityView {
  const signups = facts.counts.get(opp.id) ?? 0;
  return {
    ...opp,
    matchScore: null,
    matchReasonMongolian: null,
    enrolled: facts.enrolled.has(opp.id),
    signups,
    placesLeft: opp.capacity > 0 ? Math.max(0, opp.capacity - signups) : null,
    ...(facts.roster ? { signupNames: facts.roster.get(opp.id) ?? [] } : {}),
  };
}

function parseEmail(raw: string): string {
  const email = normaliseEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserInputError('И-мэйл хаяг буруу байна.');
  return email;
}

function parsePassword(raw: string, who = 'Нууц үг'): string {
  if (raw.length < 8) throw new UserInputError(`${who} дор хаяж 8 тэмдэгт байх ёстой.`);
  return raw;
}

/** Teacher-created and self-created accounts share one code path so both get the same checks. */
interface StudentInput {
  name: string;
  grade: string;
  school: string;
  email: string;
  password: string;
  parentEmail?: string | null;
  parentName?: string | null;
  parentPassword?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  careerGoals?: string[] | null;
  schoolHours?: { day: Day; timeSlot: string }[] | null;
}

interface CreatedStudent {
  student: StudentProfile;
  /** The student's own login, so self-signup can open the session straight away. */
  accountId: string;
}

interface OpportunityInput {
  title: string;
  organizer: string;
  requiredSkills: string[];
  day: Day;
  timeSlot: string;
  level: 'School' | 'National' | 'Global';
  description?: string | null;
  location?: string | null;
  deadline?: string | null;
  capacity?: number | null;
}

async function buildStudent(args: StudentInput, teacherId: string | null): Promise<CreatedStudent> {
  const name = args.name.trim();
  if (!name) throw new UserInputError('Нэр хоосон байж болохгүй.');
  const school = args.school.trim();
  if (!school) throw new UserInputError('Сургуулийн нэр хоосон байж болохгүй.');
  const email = parseEmail(args.email);
  const password = parsePassword(args.password);
  if (db.users.byEmail(email)) throw new UserInputError(`${email} хаяг аль хэдийн бүртгэлтэй байна.`);

  const parentEmail = args.parentEmail?.trim() ? parseEmail(args.parentEmail) : '';
  if (parentEmail === email) throw new UserInputError('Эцэг эх, сурагчийн и-мэйл хаяг ижил байж болохгүй.');
  // The parent must never inherit the student's password; they set their own.
  const parentPassword = parentEmail ? parsePassword((args.parentPassword ?? '').trim(), 'Эцэг эхийн нууц үг') : '';
  if (parentEmail) {
    const already = db.users.byEmail(parentEmail);
    if (already && already.role !== 'parent') {
      throw new UserInputError(`${parentEmail} хаягаар сурагч эсвэл багшийн бүртгэл аль хэдийн байна. Өөр хаяг оруулна уу.`);
    }
  }

  const grade = parseGrade(args.grade);
  // Everything is checked before the first row lands, so a rejected form never leaves half a student.
  const hours = timetableEntries(args.schoolHours ?? undefined);
  if (!hours.length) throw new UserInputError('Дор хаяж нэг өдрийн хичээлийн цагаа заана уу.');

  const student = db.students.insert(
    {
      name,
      grade,
      school,
      aboutMe: {
        interests: cleanTags(args.interests ?? undefined),
        skills: cleanTags(args.skills ?? undefined),
        careerGoals: cleanTags(args.careerGoals ?? undefined),
      },
      parentVerification: { isScheduleApproved: false },
      teacherId: teacherId ?? undefined,
      joinCode: uniqueJoinCode(),
    },
    'stu',
  );

  db.schoolHours.replaceAll(student.id, hours);

  const studentAccount = db.users.insert(
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

  if (parentEmail) {
    const existing = db.users.byEmail(parentEmail);
    const parentId =
      existing?.id ??
      db.users.insert(
        {
          email: parentEmail,
          displayName: args.parentName?.trim() || 'Эцэг эх',
          role: 'parent',
          passwordHash: await hashPassword(parentPassword),
          createdAt: new Date().toISOString(),
        },
        'usr',
      ).id;
    db.parentLinks.add(parentId, student.id);
  }

  return { student, accountId: studentAccount.id };
}

export const resolvers = {
  AuthUser: {
    students: (user: UserAccount) => visibleStudents(user),
  },

  StudentProfile: {
    hasParent: (student: StudentProfile) => db.parentLinks.parentsOf(student.id).length > 0,
    hasTeacher: (student: StudentProfile) => Boolean(student.teacherId),
    // The code lets whoever holds it attach to this student, so only the student may read it.
    joinCode: (student: StudentProfile, _: unknown, ctx: Ctx) =>
      ctx.session.userId && db.users.byStudent(student.id)?.id === ctx.session.userId ? student.joinCode : null,
  },

  Query: {
    me: (_: unknown, __: unknown, ctx: Ctx) => ctx.user,
    students: (_: unknown, __: unknown, ctx: Ctx) => visibleStudents(currentUser(ctx)),
    student: (_: unknown, { id }: { id: string }, ctx: Ctx) => authorize(ctx, id, 'view'),
    schedule: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) =>
      fullSchedule(authorize(ctx, studentId, 'view').id),
    schoolHours: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx): SchoolHour[] =>
      db.schoolHours.byStudent(authorize(ctx, studentId, 'view').id),
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
    opportunities: (_: unknown, __: unknown, ctx: Ctx): OpportunityView[] => {
      const facts = signupFacts(currentUser(ctx));
      return db.opportunities.all().map((o) => asView(o, facts));
    },
    matchedOpportunities: (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) => {
      const student = authorize(ctx, studentId, 'view');
      return matchOpportunities(student, computeFreeSlots(student.id));
    },
    workloadAnalysis: async (_: unknown, { studentId }: { studentId: string }, ctx: Ctx) =>
      buildWorkloadAnalysis(authorize(ctx, studentId, 'view')),
    classWorkload: (_: unknown, __: unknown, ctx: Ctx) => {
      const user = currentUser(ctx);
      if (user.role !== 'teacher') throw new ForbiddenError('Ангийн ачааллыг зөвхөн багш харах эрхтэй.');
      return buildClassWorkload(visibleStudents(user));
    },
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

    signup: async (_: unknown, { input }: { input: StudentInput }, ctx: Ctx) => {
      const created = await buildStudent(input, null);
      ctx.openSession(created.accountId);
      return db.users.byId(created.accountId)!;
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
      // Re-hashing the same secret would still drop every session, which reads as a
      // successful change that locked the user out of their other devices for nothing.
      if (next === currentPassword) {
        throw new UserInputError('Шинэ нууц үг одоогийнхоосөө ялгаатай байх ёстой.');
      }
      db.users.update(user.id, { passwordHash: await hashPassword(next) });
      // Force every other device to sign in again with the new password.
      db.sessions.dropAllForUser(user.id);
      ctx.openSession(user.id);
      return true;
    },

    createStudent: async (_: unknown, { input }: { input: StudentInput }, ctx: Ctx) => {
      const teacher = currentUser(ctx);
      if (teacher.role !== 'teacher') throw new ForbiddenError(DENIAL.teach);
      return (await buildStudent(input, teacher.id)).student;
    },

    removeStudent: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      // A teacher drops a roster entry; a student who signed up alone must never be stuck with the account.
      authorize(ctx, id, 'remove');
      const account = db.users.byStudent(id);
      if (account) db.sessions.dropAllForUser(account.id);
      const parentIds = db.parentLinks.parentsOf(id);
      for (const parentId of parentIds) db.parentLinks.remove(parentId, id);
      db.schedule.removeForStudent(id);
      db.assignments.removeForStudent(id);
      db.exams.removeForStudent(id);
      db.schoolHours.dropForStudent(id);
      db.signups.dropForStudent(id);
      if (account) db.users.remove(account.id);
      // Parent accounts stay: the family keeps its login and can re-link later,
      // either through a join code or by signing up a new child with the same e-mail.
      return db.students.remove(id);
    },

    updateAboutMe: (
      _: unknown,
      { studentId, interests, skills, careerGoals }: { studentId: string; interests: string[]; skills: string[]; careerGoals: string[] },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'edit');
      return db.students.update(studentId, {
        aboutMe: {
          interests: cleanTags(interests),
          skills: cleanTags(skills),
          careerGoals: cleanTags(careerGoals),
        },
      })!;
    },

    addScheduleItem: (
      _: unknown,
      { studentId, day, timeSlot, activity }: { studentId: string; day: Day; timeSlot: string; activity: string },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'edit');
      const name = activity.trim();
      if (!name) throw new UserInputError('Үйл ажиллагааны нэр хоосон байж болохгүй.');
      validateSlot(timeSlot);
      const [start, end] = parseSlot(timeSlot);
      if (end - start < 0.25) throw new UserInputError('Үйл ажиллагаа дор хаяж 15 минут үргэлжлэх ёстой.');

      const atSchool = db.schoolHours.byStudent(studentId).find((s) => s.day === day);
      if (atSchool && overlaps(parseSlot(atSchool.timeSlot), [start, end])) {
        throw new UserInputError(
          `${DAY_MN[day]} гарагийн сургуулийн хичээл (${atSchool.timeSlot}) давхцаж байна — хичээлийн дараах цагийг сонгоно уу.`,
        );
      }
      const clash = db.schedule
        .byStudent(studentId)
        .filter((i) => !i.isFreeSlot && i.day === day)
        .find((i) => overlaps(parseSlot(i.timeSlot), [start, end]));
      if (clash) {
        throw new UserInputError(`«${clash.activity}» (${clash.timeSlot}) үйл ажиллагаатай давхцаж байна.`);
      }

      // Any schedule change invalidates prior parent verification.
      db.students.update(studentId, { parentVerification: { isScheduleApproved: false } });
      return db.schedule.insert({ studentId, day, timeSlot, activity: name, isFreeSlot: false, isSchool: false }, 'sch');
    },

    removeScheduleItem: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'schedule', id, 'edit')) return false;
      const item = db.schedule.byId(id)!;
      db.students.update(item.studentId, { parentVerification: { isScheduleApproved: false } });
      return db.schedule.remove(id);
    },

    setSchoolHours: (
      _: unknown,
      { studentId, entries }: { studentId: string; entries: { day: Day; timeSlot: string }[] },
      ctx: Ctx,
    ) => {
      authorize(ctx, studentId, 'edit');
      const clean = timetableEntries(entries);
      if (!clean.length) throw new UserInputError('Дор хаяж нэг өдрийн хичээлийн цагаа заана уу.');

      // The timetable may not sit on top of an activity that is already booked.
      const booked = db.schedule.byStudent(studentId).filter((i) => !i.isFreeSlot);
      for (const entry of clean) {
        const slot = parseSlot(entry.timeSlot);
        const clash = booked.find((i) => i.day === entry.day && overlaps(parseSlot(i.timeSlot), slot));
        if (clash) {
          throw new UserInputError(
            `${DAY_MN[entry.day]} гарагийн ${entry.timeSlot} хичээл «${clash.activity}» (${clash.timeSlot}) үйл ажиллагаатай давхцаж байна.`,
          );
        }
      }

      db.schoolHours.replaceAll(studentId, clean);
      db.students.update(studentId, { parentVerification: { isScheduleApproved: false } });
      return db.schoolHours.byStudent(studentId);
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

    joinTeacher: (_: unknown, { code }: { code: string }, ctx: Ctx) => {
      const teacher = currentUser(ctx);
      if (teacher.role !== 'teacher') throw new ForbiddenError(DENIAL.teach);
      const student = db.students.byJoinCode(normaliseJoinCode(code));
      if (!student) throw new UserInputError('Ийм холбох кодтой сурагч олдсонгүй.');
      if (student.teacherId && student.teacherId !== teacher.id) {
        throw new UserInputError('Энэ сурагч аль хэдийн өөр багшийн жагсаалтад байна.');
      }
      if (!student.teacherId) db.students.update(student.id, { teacherId: teacher.id });
      return db.students.byId(student.id)!;
    },

    linkParent: (_: unknown, { code }: { code: string }, ctx: Ctx) => {
      const parent = currentUser(ctx);
      if (parent.role !== 'parent') throw new ForbiddenError('Зөвхөн эцэг эх хүүхэдтэйгээ холбогдох боломжтой.');
      if (db.parentLinks.childrenOf(parent.id).length > 0) {
        throw new UserInputError('Танд аль хэдийн хүүхэд холбогдсон байна.');
      }
      const student = db.students.byJoinCode(normaliseJoinCode(code));
      if (!student) throw new UserInputError('Ийм холбох кодтой сурагч олдсонгүй.');
      if (db.parentLinks.parentsOf(student.id).length > 0) {
        throw new UserInputError('Энэ сурагчид эцэг эх аль хэдийн холбогдсон байна.');
      }
      db.parentLinks.add(parent.id, student.id);
      return student;
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
      const cleanTitle = title.trim();
      const cleanSubject = subject.trim();
      if (!cleanTitle) throw new UserInputError('Даалгаврын гарчиг хоосон байж болохгүй.');
      if (!cleanSubject) throw new UserInputError('Хичээлийн нэр хоосон байж болохгүй.');
      return db.assignments.insert(
        { studentId, title: cleanTitle, subject: cleanSubject, dueDate: validateDate(dueDate, 'Хугацаа'), isCompleted: false },
        'asg',
      );
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
      const cleanSubject = subject.trim();
      if (!cleanSubject) throw new UserInputError('Хичээлийн нэр хоосон байж болохгүй.');
      return db.exams.insert(
        {
          studentId,
          subject: cleanSubject,
          examDate: validateDate(examDate, 'Шалгалтын огноо'),
          time: validateTime(time, 'Шалгалтын цаг'),
        },
        'exm',
      );
    },

    deleteExam: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      if (!authorizeItem(ctx, 'exams', id, 'teach')) return false;
      return db.exams.remove(id);
    },

    createOpportunity: (
      _: unknown,
      { input }: { input: OpportunityInput },
      ctx: Ctx,
    ): OpportunityView => {
      const user = currentUser(ctx);
      if (user.role === 'student') throw new ForbiddenError('Сурагч боломж нийтлэх эрхгүй.');
      const title = input.title.trim();
      const organizer = input.organizer.trim();
      if (!title) throw new UserInputError('Боломжийн гарчиг хоосон байж болохгүй.');
      if (!organizer) throw new UserInputError('Зохион байгуулагчийн нэр хоосон байж болохгүй.');
      validateSlot(input.timeSlot);
      if (!DAYS.includes(input.day)) throw new UserInputError('Өдөр буруу байна.');

      const deadline = input.deadline?.trim() ? validateDate(input.deadline, 'Сүүлийн огноо') : '';
      if (deadline && new Date(`${deadline}T12:00:00`).getTime() < Date.now() - 86_400_000) {
        throw new UserInputError('Сүүлийн огноо өнгөрсөн байна — ирээдүйн огноо сонгоно уу.');
      }
      const capacity = Math.round(input.capacity ?? 0);
      if (capacity < 0) throw new UserInputError('Сул оронгийн тоо сөрөг байж болохгүй.');

      const opp = db.opportunities.insert(
        {
          title,
          organizer,
          requiredSkills: cleanTags(input.requiredSkills),
          day: input.day,
          timeSlot: input.timeSlot,
          level: input.level,
          description: (input.description ?? '').trim().slice(0, 600),
          location: (input.location ?? '').trim().slice(0, 120),
          deadline,
          capacity,
        },
        'opp',
      );
      return asView(opp, signupFacts(user));
    },

    deleteOpportunity: (_: unknown, { id }: { id: string }, ctx: Ctx) => {
      const user = currentUser(ctx);
      if (user.role === 'student') throw new ForbiddenError('Сурагч боломж устгах эрхгүй.');
      db.signups.dropForOpportunity(id);
      return db.opportunities.remove(id);
    },

    enrollOpportunity: (_: unknown, { opportunityId }: { opportunityId: string }, ctx: Ctx): OpportunityView => {
      const user = currentUser(ctx);
      if (user.role !== 'student' || !user.studentId) {
        throw new ForbiddenError('Боломжид зөвхөн сурагч өөрөө бүртгүүлнэ.');
      }
      const opp = db.opportunities.byId(opportunityId);
      if (!opp) throw new UserInputError('Боломж олдсонгүй.');
      if (db.signups.opportunityIdsFor(user.studentId).has(opportunityId)) {
        throw new UserInputError('Энэ боломжид аль хэдийн бүртгэлтэй байна.');
      }
      if (opp.deadline && new Date(`${opp.deadline}T23:59:59`).getTime() < Date.now()) {
        throw new UserInputError('Бүртгэл хаагдсан — сүүлийн огноо өнгөрсөн байна.');
      }
      db.signups.add(opportunityId, user.studentId);
      return asView(opp, signupFacts(user));
    },

    unenrollOpportunity: (_: unknown, { opportunityId }: { opportunityId: string }, ctx: Ctx): OpportunityView => {
      const user = currentUser(ctx);
      if (user.role !== 'student' || !user.studentId) {
        throw new ForbiddenError('Бүртгэлээ зөвхөн сурагч өөрөө цуцална.');
      }
      const opp = db.opportunities.byId(opportunityId);
      if (!opp) throw new UserInputError('Боломж олдсонгүй.');
      db.signups.remove(opportunityId, user.studentId);
      return asView(opp, signupFacts(user));
    },
  },
};
