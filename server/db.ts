import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DAYS } from '../shared/types.js';
import type {
  Assignment,
  Day,
  Exam,
  Opportunity,
  OpportunityLevel,
  OpportunitySignup,
  Role,
  SchoolHour,
  StudentProfile,
  UserAccount,
  WeeklyScheduleItem,
} from '../shared/types.js';
import { SESSION_TTL_MS, normaliseEmail } from './auth.js';
import { seedIfEmpty, type Tables } from './seed.js';

type SqlValue = string | number | bigint | Uint8Array | null;
type Row = Record<string, SqlValue>;
type Stmt = ReturnType<DatabaseSync['prepare']>;

const here = dirname(fileURLToPath(import.meta.url));

/** `here` is server/ under tsx but dist-server/server/ in the build, so walk up to the package root. */
function projectRoot(from: string): string {
  let dir = from;
  for (let depth = 0; depth < 6 && dir !== dirname(dir); depth++) {
    if (existsSync(resolve(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return from;
}

export const DB_PATH = process.env.DB_PATH?.trim() || resolve(projectRoot(here), 'data/balanceed.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL');
// NORMAL is the pairing WAL documents: a crash loses at most the last write, it cannot corrupt.
sqlite.exec('PRAGMA synchronous = NORMAL');
sqlite.exec('PRAGMA busy_timeout = 5000');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    school TEXT NOT NULL,
    about_me TEXT NOT NULL,
    is_schedule_approved INTEGER NOT NULL,
    approved_date TEXT,
    teacher_id TEXT
  );
  CREATE TABLE IF NOT EXISTS schedule_items (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    day TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    activity TEXT NOT NULL,
    is_free_slot INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_schedule_student ON schedule_items (student_id);
  /* The weekly school timetable: one row per weekday, keyed by the student. */
  CREATE TABLE IF NOT EXISTS school_hours (
    student_id TEXT NOT NULL,
    day TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    PRIMARY KEY (student_id, day)
  );
  CREATE TABLE IF NOT EXISTS opportunity_signups (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (opportunity_id, student_id)
  );
  CREATE INDEX IF NOT EXISTS ix_signups_opportunity ON opportunity_signups (opportunity_id);
  CREATE INDEX IF NOT EXISTS ix_signups_student ON opportunity_signups (student_id);
  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    due_date TEXT NOT NULL,
    is_completed INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_assignments_student ON assignments (student_id);
  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    time TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_exams_student ON exams (student_id);
  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    organizer TEXT NOT NULL,
    required_skills TEXT NOT NULL,
    day TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    level TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    student_id TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions (user_id);
  CREATE TABLE IF NOT EXISTS parent_links (
    parent_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (parent_id, student_id)
  );
  CREATE INDEX IF NOT EXISTS ix_parent_links_student ON parent_links (student_id);
  CREATE INDEX IF NOT EXISTS ix_students_teacher ON students (teacher_id);
  CREATE INDEX IF NOT EXISTS ix_users_student ON users (student_id);
  CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions (expires_at);
`);

// Databases created before accounts existed only need the new column added.
const hasColumn = (table: string, column: string): boolean =>
  (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Row[]).some((c) => c.name === column);

if (!hasColumn('students', 'teacher_id')) sqlite.exec('ALTER TABLE students ADD COLUMN teacher_id TEXT');
if (!hasColumn('users', 'student_id')) sqlite.exec('ALTER TABLE users ADD COLUMN student_id TEXT');
// Opportunities grew detail fields after the first demo databases were created.
if (!hasColumn('opportunities', 'description')) sqlite.exec("ALTER TABLE opportunities ADD COLUMN description TEXT NOT NULL DEFAULT ''");
if (!hasColumn('opportunities', 'location')) sqlite.exec("ALTER TABLE opportunities ADD COLUMN location TEXT NOT NULL DEFAULT ''");
if (!hasColumn('opportunities', 'deadline')) sqlite.exec("ALTER TABLE opportunities ADD COLUMN deadline TEXT NOT NULL DEFAULT ''");
if (!hasColumn('opportunities', 'capacity')) sqlite.exec('ALTER TABLE opportunities ADD COLUMN capacity INTEGER NOT NULL DEFAULT 0');

/**
 * SQLite-backed table with the same surface the resolvers and analytics use.
 * `columns[0]` must be `id`, and `toRow` must return values in `columns` order.
 */
class SqlCollection<T extends { id: string }> {
  private seq = 0;
  private readonly stmtAll: Stmt;
  private readonly stmtById: Stmt;
  private readonly stmtInsert: Stmt;
  private readonly stmtUpdate: Stmt;
  private readonly stmtDelete: Stmt;
  private readonly stmtCount: Stmt;

  constructor(
    table: string,
    private readonly columns: readonly string[],
    private readonly toRow: (entity: T) => SqlValue[],
    protected readonly fromRow: (row: Row) => T,
  ) {
    const cols = columns.map((c) => `"${c}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns.slice(1).map((c) => `"${c}" = ?`).join(', ');
    this.stmtAll = sqlite.prepare(`SELECT ${cols} FROM "${table}" ORDER BY rowid`);
    this.stmtById = sqlite.prepare(`SELECT ${cols} FROM "${table}" WHERE id = ?`);
    this.stmtInsert = sqlite.prepare(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`);
    this.stmtUpdate = sqlite.prepare(`UPDATE "${table}" SET ${updates} WHERE id = ?`);
    this.stmtDelete = sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`);
    this.stmtCount = sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`);
  }

  all(): T[] {
    return (this.stmtAll.all() as Row[]).map((row) => this.fromRow(row));
  }

  find(predicate: (row: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  byId(id: string): T | undefined {
    const row = this.stmtById.get(id) as Row | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  size(): number {
    const row = this.stmtCount.get() as Row;
    return Number(row.n);
  }

  insertSeed(entity: T): T {
    this.stmtInsert.run(...this.toRow(entity));
    return entity;
  }

  insert(row: Omit<T, 'id'>, prefix: string): T {
    const id = `${prefix}_${Date.now().toString(36)}_${(++this.seq).toString(36)}`;
    const created = { ...row, id } as T;
    this.stmtInsert.run(...this.toRow(created));
    return created;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const existing = this.byId(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch, id };
    const values = this.toRow(next);
    this.stmtUpdate.run(...values.slice(1), id);
    return next;
  }

  remove(id: string): boolean {
    return this.stmtDelete.run(id).changes > 0;
  }
}

/** A table whose rows belong to one student, so per-student reads stay indexed. */
class StudentScoped<T extends { id: string; studentId: string }> extends SqlCollection<T> {
  private readonly stmtByStudent: Stmt;
  private readonly stmtDropStudent: Stmt;

  constructor(
    table: string,
    columns: readonly string[],
    toRow: (entity: T) => SqlValue[],
    fromRow: (row: Row) => T,
  ) {
    super(table, columns, toRow, fromRow);
    const cols = columns.map((c) => `"${c}"`).join(', ');
    this.stmtByStudent = sqlite.prepare(`SELECT ${cols} FROM "${table}" WHERE student_id = ? ORDER BY rowid`);
    this.stmtDropStudent = sqlite.prepare(`DELETE FROM "${table}" WHERE student_id = ?`);
  }

  byStudent(studentId: string): T[] {
    return (this.stmtByStudent.all(studentId) as Row[]).map(this.fromRow);
  }

  /** One statement instead of a delete per row. Returns how many went. */
  removeForStudent(studentId: string): number {
    return Number(this.stmtDropStudent.run(studentId).changes);
  }
}

const json = (value: unknown): SqlValue => JSON.stringify(value);
const parse = <V>(value: SqlValue, fallback: V): V => {
  try {
    return JSON.parse(String(value)) as V;
  } catch {
    return fallback;
  }
};
const flag = (value: boolean): number => (value ? 1 : 0);
const text = (value: SqlValue): string => String(value ?? '');

const STUDENT_COLS = ['id', 'name', 'grade', 'school', 'about_me', 'is_schedule_approved', 'approved_date', 'teacher_id'] as const;
const studentFromRow = (r: Row): StudentProfile => ({
  id: text(r.id),
  name: text(r.name),
  grade: text(r.grade),
  school: text(r.school),
  aboutMe: parse(r.about_me, { interests: [], skills: [], careerGoals: [] }),
  parentVerification: {
    isScheduleApproved: Number(r.is_schedule_approved) === 1,
    ...(r.approved_date == null ? {} : { approvedDate: text(r.approved_date) }),
  },
  ...(r.teacher_id == null ? {} : { teacherId: text(r.teacher_id) }),
});

const stmtStudentsByTeacher = sqlite.prepare(
  `SELECT ${STUDENT_COLS.map((c) => `"${c}"`).join(', ')} FROM students WHERE teacher_id = ? ORDER BY rowid`,
);

const students = Object.assign(
  new SqlCollection<StudentProfile>(
    'students',
    STUDENT_COLS,
    (e) => [
      e.id,
      e.name,
      e.grade,
      e.school,
      json(e.aboutMe),
      flag(e.parentVerification.isScheduleApproved),
      e.parentVerification.approvedDate ?? null,
      e.teacherId ?? null,
    ],
    studentFromRow,
  ),
  {
    byTeacher(teacherId: string): StudentProfile[] {
      return (stmtStudentsByTeacher.all(teacherId) as Row[]).map(studentFromRow);
    },
  },
);

const schedule = new StudentScoped<WeeklyScheduleItem>(
  'schedule_items',
  ['id', 'student_id', 'day', 'time_slot', 'activity', 'is_free_slot'],
  (e) => [e.id, e.studentId, e.day, e.timeSlot, e.activity, flag(e.isFreeSlot)],
  (r) => ({
    id: text(r.id),
    studentId: text(r.student_id),
    day: text(r.day) as Day,
    timeSlot: text(r.time_slot),
    activity: text(r.activity),
    isFreeSlot: Number(r.is_free_slot) === 1,
    isSchool: false,
  }),
);

const assignments = new StudentScoped<Assignment>(
  'assignments',
  ['id', 'student_id', 'title', 'subject', 'due_date', 'is_completed'],
  (e) => [e.id, e.studentId, e.title, e.subject, e.dueDate, flag(e.isCompleted)],
  (r) => ({
    id: text(r.id),
    studentId: text(r.student_id),
    title: text(r.title),
    subject: text(r.subject),
    dueDate: text(r.due_date),
    isCompleted: Number(r.is_completed) === 1,
  }),
);

const exams = new StudentScoped<Exam>(
  'exams',
  ['id', 'student_id', 'subject', 'exam_date', 'time'],
  (e) => [e.id, e.studentId, e.subject, e.examDate, e.time],
  (r) => ({
    id: text(r.id),
    studentId: text(r.student_id),
    subject: text(r.subject),
    examDate: text(r.exam_date),
    time: text(r.time),
  }),
);

const opportunities = new SqlCollection<Opportunity>(
  'opportunities',
  ['id', 'title', 'organizer', 'required_skills', 'day', 'time_slot', 'level', 'description', 'location', 'deadline', 'capacity'],
  (e) => [
    e.id,
    e.title,
    e.organizer,
    json(e.requiredSkills),
    e.day,
    e.timeSlot,
    e.level,
    e.description,
    e.location,
    e.deadline,
    e.capacity,
  ],
  (r) => ({
    id: text(r.id),
    title: text(r.title),
    organizer: text(r.organizer),
    requiredSkills: parse<string[]>(r.required_skills, []),
    day: text(r.day) as Day,
    timeSlot: text(r.time_slot),
    level: text(r.level) as OpportunityLevel,
    description: text(r.description),
    location: text(r.location),
    deadline: text(r.deadline),
    capacity: Number(r.capacity),
  }),
);

/**
 * The school timetable is read and written as a whole week, so it does not need
 * the row-id lifecycle the other tables have.
 */
const stmtSchoolByStudent = sqlite.prepare('SELECT student_id, day, time_slot FROM school_hours WHERE student_id = ?');
const stmtSchoolDrop = sqlite.prepare('DELETE FROM school_hours WHERE student_id = ?');
const stmtSchoolUpsert = sqlite.prepare(
  'INSERT INTO school_hours (student_id, day, time_slot) VALUES (?, ?, ?) ON CONFLICT (student_id, day) DO UPDATE SET time_slot = excluded.time_slot',
);
const weekOrder = (d: string) => DAYS.indexOf(d as Day);

const schoolHours = {
  byStudent(studentId: string): SchoolHour[] {
    return (stmtSchoolByStudent.all(studentId) as Row[])
      .map((r) => ({ studentId: text(r.student_id), day: text(r.day) as Day, timeSlot: text(r.time_slot) }))
      .sort((a, b) => weekOrder(a.day) - weekOrder(b.day));
  },
  /** One transaction, so a timetable is never left half-saved. */
  replaceAll(studentId: string, entries: { day: Day; timeSlot: string }[]): SchoolHour[] {
    sqlite.exec('BEGIN');
    try {
      stmtSchoolDrop.run(studentId);
      for (const e of entries) stmtSchoolUpsert.run(studentId, e.day, e.timeSlot);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
    return schoolHours.byStudent(studentId);
  },
  dropForStudent(studentId: string): number {
    return Number(stmtSchoolDrop.run(studentId).changes);
  },
};

const stmtSignupAdd = sqlite.prepare(
  'INSERT INTO opportunity_signups (id, opportunity_id, student_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (opportunity_id, student_id) DO NOTHING',
);
const stmtSignupDrop = sqlite.prepare('DELETE FROM opportunity_signups WHERE opportunity_id = ? AND student_id = ?');
const stmtSignupCount = sqlite.prepare('SELECT COUNT(*) AS n FROM opportunity_signups WHERE opportunity_id = ?');
const stmtSignupIds = sqlite.prepare('SELECT opportunity_id FROM opportunity_signups WHERE student_id = ?');
const stmtSignupDropOpp = sqlite.prepare('DELETE FROM opportunity_signups WHERE opportunity_id = ?');
const stmtSignupDropStudent = sqlite.prepare('DELETE FROM opportunity_signups WHERE student_id = ?');
const stmtSignupCounts = sqlite.prepare('SELECT opportunity_id, COUNT(*) AS n FROM opportunity_signups GROUP BY opportunity_id');

const signups = {
  /** False when the student already held a place. */
  add(opportunityId: string, studentId: string): boolean {
    const id = `sup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return Number(stmtSignupAdd.run(id, opportunityId, studentId, new Date().toISOString()).changes) > 0;
  },
  remove(opportunityId: string, studentId: string): boolean {
    return Number(stmtSignupDrop.run(opportunityId, studentId).changes) > 0;
  },
  countFor(opportunityId: string): number {
    return Number((stmtSignupCount.get(opportunityId) as Row).n);
  },
  /** One GROUP BY for a whole list, so the hub never pays a query per card. */
  counts(): Map<string, number> {
    return new Map((stmtSignupCounts.all() as Row[]).map((r) => [text(r.opportunity_id), Number(r.n)]));
  },
  opportunityIdsFor(studentId: string): Set<string> {
    return new Set((stmtSignupIds.all(studentId) as Row[]).map((r) => text(r.opportunity_id)));
  },
  dropForOpportunity(opportunityId: string): number {
    return Number(stmtSignupDropOpp.run(opportunityId).changes);
  },
  dropForStudent(studentId: string): number {
    return Number(stmtSignupDropStudent.run(studentId).changes);
  },
};

const USER_COLS = ['id', 'email', 'display_name', 'role', 'password_hash', 'created_at', 'student_id'] as const;const userFromRow = (r: Row): UserAccount => ({
  id: text(r.id),
  email: text(r.email),
  displayName: text(r.display_name),
  role: text(r.role) as Role,
  passwordHash: text(r.password_hash),
  createdAt: text(r.created_at),
  ...(r.student_id == null ? {} : { studentId: text(r.student_id) }),
});

const usersTable = new SqlCollection<UserAccount>(
  'users',
  USER_COLS,
  (e) => [e.id, e.email, e.displayName, e.role, e.passwordHash, e.createdAt, e.studentId ?? null],
  userFromRow,
);
const userSelect = `SELECT ${USER_COLS.map((c) => `"${c}"`).join(', ')}`;
const stmtUserByEmail = sqlite.prepare(`${userSelect} FROM users WHERE email = ?`);
const stmtUserByStudent = sqlite.prepare(`${userSelect} FROM users WHERE student_id = ? LIMIT 1`);

const users = Object.assign(usersTable, {
  byEmail(email: string): UserAccount | undefined {
    const row = stmtUserByEmail.get(normaliseEmail(email)) as Row | undefined;
    return row ? userFromRow(row) : undefined;
  },
  byStudent(studentId: string): UserAccount | undefined {
    const row = stmtUserByStudent.get(studentId) as Row | undefined;
    return row ? userFromRow(row) : undefined;
  },
});

const stmtSessionAdd = sqlite.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
const stmtSessionGet = sqlite.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?');
const stmtSessionDrop = sqlite.prepare('DELETE FROM sessions WHERE token_hash = ?');
const stmtSessionDropUser = sqlite.prepare('DELETE FROM sessions WHERE user_id = ?');
const stmtSessionPrune = sqlite.prepare('DELETE FROM sessions WHERE expires_at < ?');

let lastPruneAt = 0;
const sessions = {
  create(tokenHash: string, userId: string, ttlMs = SESSION_TTL_MS): void {
    const now = Date.now();
    // Expired tokens are swept on login, but a burst of logins should not sweep once each.
    if (now - lastPruneAt > 60_000) {
      lastPruneAt = now;
      stmtSessionPrune.run(now);
    }
    stmtSessionAdd.run(tokenHash, userId, now + ttlMs);
  },
  userIdFor(tokenHash: string): string | null {
    const row = stmtSessionGet.get(tokenHash) as Row | undefined;
    if (!row) return null;
    if (Number(row.expires_at) <= Date.now()) {
      stmtSessionDrop.run(tokenHash);
      return null;
    }
    return text(row.user_id);
  },
  drop(tokenHash: string): void {
    stmtSessionDrop.run(tokenHash);
  },
  dropAllForUser(userId: string): void {
    stmtSessionDropUser.run(userId);
  },
};

const stmtLinkAdd = sqlite.prepare('INSERT OR IGNORE INTO parent_links (parent_id, student_id) VALUES (?, ?)');
const stmtLinkChildren = sqlite.prepare('SELECT student_id FROM parent_links WHERE parent_id = ? ORDER BY rowid');
const stmtLinkParents = sqlite.prepare('SELECT parent_id FROM parent_links WHERE student_id = ? ORDER BY rowid');
const stmtLinkCheck = sqlite.prepare('SELECT 1 AS hit FROM parent_links WHERE parent_id = ? AND student_id = ?');
const stmtLinkRemove = sqlite.prepare('DELETE FROM parent_links WHERE parent_id = ? AND student_id = ?');

const parentLinks = {
  add(parentId: string, studentId: string): void {
    stmtLinkAdd.run(parentId, studentId);
  },
  remove(parentId: string, studentId: string): void {
    stmtLinkRemove.run(parentId, studentId);
  },
  childrenOf(parentId: string): string[] {
    return (stmtLinkChildren.all(parentId) as Row[]).map((r) => text(r.student_id));
  },
  parentsOf(studentId: string): string[] {
    return (stmtLinkParents.all(studentId) as Row[]).map((r) => text(r.parent_id));
  },
  isLinked(parentId: string, studentId: string): boolean {
    return stmtLinkCheck.get(parentId, studentId) !== undefined;
  },
};

const tables: Tables = {
  students,
  schedule,
  assignments,
  exams,
  opportunities,
  users,
  linkParent: parentLinks.add,
  addSignup(opportunityId, studentId) {
    signups.add(opportunityId, studentId);
  },
  setSchoolHours(studentId, entries) {
    schoolHours.replaceAll(studentId, entries);
  },
  hasSchoolHours(studentId) {
    return schoolHours.byStudent(studentId).length > 0;
  },
  assignUnownedStudentsTo(teacherId: string) {
    let adopted = 0;
    for (const student of students.all()) {
      if (!student.teacherId) {
        students.update(student.id, { teacherId });
        adopted++;
      }
    }
    return adopted;
  },
};

/**
 * Called from startup instead of at import so the one-off scrypt hash for the
 * demo accounts can be awaited rather than blocking module evaluation.
 */
export async function ensureSeeded(): Promise<void> {
  await seedIfEmpty(tables);
}

export const db = { students, schedule, assignments, exams, opportunities, users, sessions, parentLinks, schoolHours, signups };
