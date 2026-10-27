import { db } from '../db.js';
import type {
  Assignment,
  Day,
  Exam,
  MatchedOpportunity,
  OpportunityWithMatch,
  SchoolHour,
  StressDriver,
  StudentProfile,
  WeeklyScheduleItem,
} from '../../shared/types.js';
import { DAYS } from '../../shared/types.js';
import { gemmaComplete, gemmaEnabled } from './gemma.js';

/** Where free time is looked for on a day with no timetable entry. */
const WEEKDAY_WINDOW: [number, number] = [8, 20];
const WEEKEND_WINDOW: [number, number] = [9, 20];
/** Later than this is sleep time, so it never counts as "available to study". */
const NIGHT_START = 21;
/** One day is never credited with more study time than this. */
const DAILY_CAPACITY_CAP = 4;
/** School is fixed load nobody can resign from, so it weighs less than clubs and jobs. */
const SCHOOL_WEIGHT = 0.25;
/** School is fixed load nobody can resign from, so it counts a little discounted toward stress too. */
const STRESS_SCHOOL_WEIGHT = 0.85;

const normalize = (s: string) => s.replace(/^#/, '').toLowerCase();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function parseSlot(timeSlot: string): [number, number] {
  const [a, b] = timeSlot.split('-').map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h + (m || 0) / 60;
  });
  return [a, b];
}

export function fmtSlot(start: number, end: number): string {
  const f = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
  return `${f(start)}-${f(end)}`;
}

/** True when two slots share real minutes; touching edges (15:00 then 15:00) do not overlap. */
export function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Noon parsing keeps the calendar date stable whatever UTC offset the server runs in. */
function noonMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from today to that date; negative means it already passed. */
export function daysUntil(iso: string): number {
  return Math.round((noonMs(iso) - noonMs(todayIso())) / 86_400_000);
}

/** Monday-first weekday that a date falls on. */
export function dayOfDate(iso: string): Day {
  const jsDay = new Date(`${iso.slice(0, 10)}T12:00:00`).getDay();
  return DAYS[jsDay === 0 ? 6 : jsDay - 1];
}

const isWeekend = (day: Day) => day === 'Saturday' || day === 'Sunday';
const defaultWindow = (day: Day): [number, number] => (isWeekend(day) ? WEEKEND_WINDOW : WEEKDAY_WINDOW);

/** Stored rows only — derived free slots and timetable blocks are never persisted. */
export function storedSchedule(studentId: string): WeeklyScheduleItem[] {
  return db.schedule.byStudent(studentId).filter((i) => !i.isFreeSlot);
}

export function computeFreeSlots(studentId: string): WeeklyScheduleItem[] {
  return freeSlotsFrom(studentId, storedSchedule(studentId), db.schoolHours.byStudent(studentId));
}

let freeSeq = 0;
function freeItem(studentId: string, day: Day, start: number, end: number): WeeklyScheduleItem {
  return {
    id: `free_${studentId}_${day}_${++freeSeq}`,
    studentId,
    day,
    timeSlot: fmtSlot(start, end),
    activity: 'Чөлөөт цаг',
    isFreeSlot: true,
    isSchool: false,
  };
}

/** Timetable rows reach the grid as blocks managed a week at a time, not row by row. */
export function schoolItems(studentId: string, school: SchoolHour[]): WeeklyScheduleItem[] {
  return school.map((s) => ({
    id: `school_${studentId}_${s.day}`,
    studentId,
    day: s.day,
    timeSlot: s.timeSlot,
    activity: 'Сургууль',
    isFreeSlot: false,
    isSchool: true,
  }));
}

/**
 * Gaps of at least an hour. The window grows to cover the timetable, so a student
 * at school until 17:00 is never offered 15:00 as free time.
 */
export function freeSlotsFrom(
  studentId: string,
  stored: WeeklyScheduleItem[],
  school: SchoolHour[],
): WeeklyScheduleItem[] {
  const schoolSlotOfDay = new Map(school.map((s) => [s.day, s.timeSlot]));
  const out: WeeklyScheduleItem[] = [];
  for (const day of DAYS) {
    const [start, end] = defaultWindow(day);
    const schoolSlot = schoolSlotOfDay.get(day);
    let winStart = start;
    let winEnd = end;
    if (schoolSlot) {
      const [s, e] = parseSlot(schoolSlot);
      winStart = Math.min(winStart, s);
      winEnd = Math.max(winEnd, Math.min(e + 1, 22));
    }
    const busy = stored
      .filter((i) => i.day === day)
      .map((i) => parseSlot(i.timeSlot))
      .concat(schoolSlot ? [parseSlot(schoolSlot)] : [])
      .sort((a, b) => a[0] - b[0]);
    let cursor = winStart;
    for (const [s, e] of busy) {
      if (s - cursor >= 1) out.push(freeItem(studentId, day, cursor, Math.min(s, winEnd)));
      cursor = Math.max(cursor, e);
    }
    if (winEnd - cursor >= 1) out.push(freeItem(studentId, day, cursor, winEnd));
  }
  return out;
}

function hoursOf(slots: [number, number][]): number {
  return slots.reduce((sum, [s, e]) => sum + Math.max(0, e - s), 0);
}

interface Calendar {
  activity: Map<Day, [number, number][]>;
  school: Map<Day, [number, number]>;
}

function groupByDay(stored: WeeklyScheduleItem[], school: SchoolHour[]): Calendar {
  const activity = new Map<Day, [number, number][]>();
  for (const item of stored) {
    const list = activity.get(item.day) ?? [];
    list.push(parseSlot(item.timeSlot));
    activity.set(item.day, list);
  }
  return { activity, school: new Map(school.map((s) => [s.day, parseSlot(s.timeSlot)])) };
}

function schoolHoursOf(cal: Calendar, day: Day): number {
  const slot = cal.school.get(day);
  return slot ? round1(slot[1] - slot[0]) : 0;
}

/** Everything booked on that day, school included. */
function committedOn(cal: Calendar, day: Day): number {
  return round1(schoolHoursOf(cal, day) + hoursOf(cal.activity.get(day) ?? []));
}

/** Unbooked, pre-nightfall hours — the room genuinely left for study. */
function slackOn(cal: Calendar, day: Day): number {
  const schoolSlot = cal.school.get(day);
  const busy = [...(cal.activity.get(day) ?? []), ...(schoolSlot ? [schoolSlot] : [])].sort((a, b) => a[0] - b[0]);
  const [start, end] = defaultWindow(day);
  let cursor = start;
  let free = 0;
  for (const [s, e] of busy) {
    if (s > cursor) free += Math.max(0, Math.min(s, NIGHT_START) - cursor);
    cursor = Math.max(cursor, e);
  }
  if (end > cursor) free += Math.max(0, Math.min(end, NIGHT_START) - cursor);
  return round1(clamp(free, 0, 24));
}

/** Study time really left this week: usable free hours, capped per day. */
function weeklyCapacity(free: WeeklyScheduleItem[]): number {
  const byDay = new Map<Day, number>();
  for (const f of free) {
    const [s, e] = parseSlot(f.timeSlot);
    const usable = Math.max(0, Math.min(e, NIGHT_START) - Math.max(s, 7));
    byDay.set(f.day, (byDay.get(f.day) ?? 0) + usable);
  }
  return round1([...byDay.values()].reduce((sum, h) => sum + Math.min(h, DAILY_CAPACITY_CAP), 0));
}

/** Rough but stable: each open task is worth the hours a student would really spend on it. */
function weeklyDemand(assignments: Assignment[], exams: Exam[]): number {
  let hours = 0;
  for (const a of assignments) {
    if (a.isCompleted) continue;
    const away = daysUntil(a.dueDate);
    if (away < 0) hours += 1.5;
    else if (away <= 7) hours += 0.75;
  }
  for (const e of exams) {
    const away = daysUntil(e.examDate);
    if (away >= -1 && away <= 14) hours += 2;
  }
  return round1(hours);
}

/** Bands chosen so a genuinely worrying week is not reported as calm. */
const riskFromScore = (score: number): 'Low' | 'Medium' | 'High' =>
  score < 25 ? 'Low' : score < 55 ? 'Medium' : 'High';

function statusFromScore(score: number): string {
  if (score <= 3.5) return 'Balanced';
  if (score <= 5.5) return 'Manageable';
  if (score <= 7) return 'Busy';
  return 'Overworked';
}

const STATUS_MN: Record<string, string> = {
  Balanced: 'тэнцвэртэй',
  Manageable: 'хэвийн',
  Busy: 'ачаалалтай',
  Overworked: 'хэт ачаалалтай',
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

/** Sentences here are read verbatim by parents, so dates cannot stay in ISO form. */
function mnDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : `${d.getMonth() + 1} сарын ${d.getDate()}`;
}

export interface Conflict {
  examOrAssignment: string;
  date: string;
  conflictDescriptionMongolian: string;
}

export interface WorkloadFacts {
  score: number;
  status: string;
  stressScore: number;
  stressRisk: 'Low' | 'Medium' | 'High';
  stressDrivers: StressDriver[];
  activityHours: number;
  schoolHours: number;
  freeHours: number;
  capacityHours: number;
  demandHours: number;
  scheduledItems: number;
  total: number;
  completed: number;
  completionPercentage: number;
  pendingSoon: number;
  overdue: number;
  upcomingExams: Exam[];
  conflicts: Conflict[];
}

/**
 * The two axes are deliberately separate. Load answers "how full is the week";
 * stress answers "can this student keep up and still sleep". A heavy week with
 * slack is load without stress, and a light week behind on deadlines is the reverse.
 */
export function measure(
  student: StudentProfile,
  stored: WeeklyScheduleItem[],
  school: SchoolHour[],
  assignments: Assignment[],
  exams: Exam[],
): WorkloadFacts {
  const cal = groupByDay(stored, school);
  const free = freeSlotsFrom(student.id, stored, school);
  const activityHours = round1(hoursOf([...cal.activity.values()].flat()));
  const schoolHours = round1(hoursOf([...cal.school.values()]));
  const freeHours = round1(hoursOf(free.map((f) => parseSlot(f.timeSlot))));
  const capacityHours = weeklyCapacity(free);
  const demandHours = weeklyDemand(assignments, exams);

  const pending = assignments.filter((a) => !a.isCompleted);
  const overdue = pending.filter((a) => daysUntil(a.dueDate) < 0).length;
  const pendingSoon = pending.filter((a) => {
    const away = daysUntil(a.dueDate);
    return away >= 0 && away <= 7;
  }).length;
  const upcomingExams = exams.filter((e) => {
    const away = daysUntil(e.examDate);
    return away >= -1 && away <= 14;
  });
  const total = assignments.length;
  const completed = total - pending.length;
  const completionPercentage = total ? Math.round((completed / total) * 100) : 0;

  // ---- load ----
  const lateFinishes = DAYS.filter(
    (day) => !isWeekend(day) && (cal.activity.get(day) ?? []).some(([, e]) => e > 19.5),
  ).length;
  const busyDays = DAYS.filter((day) => committedOn(cal, day) >= 5).length;
  let score =
    0.6 +
    Math.min((activityHours + schoolHours * SCHOOL_WEIGHT) / 3.2, 4.4) +
    Math.min(pendingSoon * 0.8, 2.6) +
    Math.min(upcomingExams.length * 0.7, 2) +
    lateFinishes * 0.25 +
    (busyDays >= 6 ? 0.6 : 0);
  if (completionPercentage >= 80) score -= 0.5;
  if (completionPercentage < 40) score += 1;
  score = round1(clamp(score, 1, 10));

  // ---- stress ----
  /**
   * Six axes whose weights sum to 100, so the score is the stress and the
   * drivers are its actual parts — nothing is capped out at a fifth of the range.
   */
  const committedWeek = round1(activityHours + schoolHours * STRESS_SCHOOL_WEIGHT);
  const squeezedDays = DAYS.filter((day) => {
    const atSchool = cal.school.get(day);
    if (!atSchool) return false;
    const after = (cal.activity.get(day) ?? []).filter(([s]) => s >= atSchool[1]);
    return after.length > 0 && after.every(([s]) => s - atSchool[1] < 0.5);
  });
  const lightest = DAYS.map((day) => ({ day, committed: committedOn(cal, day) })).sort((a, b) => a.committed - b.committed)[0];
  const weekendLoad = round1(committedOn(cal, 'Saturday') + committedOn(cal, 'Sunday'));
  const ratio = demandHours / Math.max(1, capacityHours);
  const examWeights = upcomingExams.map((e) => {
    const away = Math.max(0, daysUntil(e.examDate));
    return away <= 2 ? 1 : away <= 4 ? 0.9 : away <= 7 ? 0.6 : 0.35;
  });
  const crowdedExams = upcomingExams.some((a, i) =>
    upcomingExams.some((b, j) => j > i && Math.abs(daysUntil(a.examDate) - daysUntil(b.examDate)) <= 2),
  );

  const axes: { level: number; weight: number; label: string; detail: string }[] = [];

  axes.push({
    level: clamp((committedWeek - 20) / 35, 0, 1),
    weight: 20,
    label: 'Долоо хоногийн нийт ачаалал',
    detail: `Сургуульд ${schoolHours}, хичээлээс гадуурх ажилд ${activityHours} цаг. Сургуулийн цагийг 85 хувиар тооцоод ачааллыг ${committedWeek} цаг гэж үзэв.`,
  });

  axes.push({
    level: clamp((lightest.committed - 1.5) / 5, 0, 1) * 0.6 + clamp(weekendLoad / 8, 0, 1) * 0.4,
    weight: 14,
    label: 'Сэргээх цаг',
    detail: `Хамгийн хөнгөн ${DAY_MN[lightest.day]} гарагт ${lightest.committed} цаг, амралтын өдрүүдэд нийт ${weekendLoad} цаг ажил төлөвлөгдсөн.`,
  });

  axes.push({
    level: clamp(lateFinishes / 3, 0, 1),
    weight: 12,
    label: 'Орой хүртэлх ачаалал',
    detail: `${lateFinishes} өдөрт 19:30-аас хойш ажил дуусч, унтахад үлдэх цаг хумигдаж байна.`,
  });

  axes.push({
    level: clamp(squeezedDays.length / 3, 0, 1),
    weight: 10,
    label: 'Хичээлийн дараах завсар',
    detail: squeezedDays.length
      ? `${squeezedDays.map((d) => DAY_MN[d]).join(', ')} гарагт сургууль дуусаад завсарлага авах завсаргүйгээр дараагийн ажил эхэлж байна.`
      : 'Сургуулийн дараа ажил руу шилжих завсартай.',
  });

  const backlogParts: string[] = [];
  if (overdue) backlogParts.push(`${overdue} даалгаврын хугацаа хэтрэв`);
  if (pendingSoon) backlogParts.push(`${pendingSoon} даалгавар 7 хоногийн дотор дуусах ёстой`);
  if (demandHours > 0 && ratio > 0.45)
    backlogParts.push(`бие даах ажил ${demandHours} цаг шаардагдахад тохиромжтой чөлөөт цаг ${capacityHours} цаг үлдэв`);
  axes.push({
    level:
      clamp(overdue / 2, 0, 1) * 0.6 +
      clamp(pendingSoon / 3, 0, 1) * 0.25 +
      (demandHours > 0 ? clamp(ratio / 1.2, 0, 1) * 0.15 : 0),
    weight: 20,
    label: 'Даалгаврын хуримтлал',
    detail: backlogParts.length ? `${backlogParts.join('; ')}.` : 'Дуусаагүй даалгавар хуримтлагдаагүй байна.',
  });

  axes.push({
    level: clamp((examWeights.reduce((s, w) => s + w, 0) + (crowdedExams ? 0.4 : 0)) / 2.2, 0, 1),
    weight: 26,
    label: upcomingExams.length > 1 ? 'Ойртсон шалгалтууд' : 'Ойртсон шалгалт',
    detail: `${upcomingExams
      .map((e) => {
        const away = Math.max(0, daysUntil(e.examDate));
        return `${e.subject} — ${mnDate(e.examDate)} (${away === 0 ? 'өнөөдөр' : `${away} хоногийн дараа`})`;
      })
      .join('; ') || 'ойрын 14 хоногт шалгалт товлогдоогүй'}${crowdedExams ? '; шалгалтууд хоног сөхөж товлогдсон тул нэгт нь бэлдэх завсар байхгүй' : ''}.`,
  });

  const toneOf = (level: number): StressDriver['tone'] => (level >= 0.75 ? 'danger' : level >= 0.4 ? 'warn' : 'ok');
  const drivers: StressDriver[] = axes
    .map((a) => ({
      labelMongolian: a.label,
      detailMongolian: a.detail,
      impact: round1(a.level * a.weight),
      tone: toneOf(a.level),
    }))
    .filter((d) => d.impact >= 1)
    .sort((a, b) => b.impact - a.impact);

  let rawStress = axes.reduce((sum, a) => sum + a.level * a.weight, 0);
  if (completionPercentage >= 80 && pending.length === 0) rawStress -= 4;
  const stressScore = Math.round(clamp(rawStress, 0, 100));

  if (!drivers.length) {
    drivers.push({
      labelMongolian: 'Хуваарийн тэнцвэр',
      detailMongolian: 'Стрессийг нэмэгдүүлэх нөхцөл илэрч байхгүй — ачаалал, амралт тэнцүү байна.',
      impact: 0,
      tone: 'ok',
    });
  }

  return {
    score,
    status: statusFromScore(score),
    stressScore,
    stressRisk: riskFromScore(stressScore),
    stressDrivers: drivers,
    activityHours,
    schoolHours,
    freeHours,
    capacityHours,
    demandHours,
    scheduledItems: stored.length,
    total,
    completed,
    completionPercentage,
    pendingSoon,
    overdue,
    upcomingExams,
    conflicts: detectConflicts(cal, assignments, exams),
  };
}

const previousDay = (day: Day) => DAYS[(DAYS.indexOf(day) + 6) % 7];

/** A due date is only a conflict when that day genuinely has no room left. */
function detectConflicts(cal: Calendar, assignments: Assignment[], exams: Exam[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const exam of exams) {
    const away = daysUntil(exam.examDate);
    if (away < -1 || away > 14) continue;
    const day = dayOfDate(exam.examDate);
    const committed = committedOn(cal, day);
    const slack = slackOn(cal, day);
    if (committed >= 7) {
      conflicts.push({
        examOrAssignment: `${exam.subject} шалгалт`,
        date: exam.examDate,
        conflictDescriptionMongolian: `${exam.subject} шалгалт (${mnDate(exam.examDate)}) ${DAY_MN[day]} гарагт товлогдсон бөгөөд тэр өдөр хичээл, үйл ажиллагаа нийлээд ${committed} цаг байна.`,
      });
    } else if (slack < 1.5) {
      conflicts.push({
        examOrAssignment: `${exam.subject} шалгалт`,
        date: exam.examDate,
        conflictDescriptionMongolian: `${exam.subject} шалгалтын өдөр (${mnDate(exam.examDate)}) зөвхөн ${slack} цаг чөлөөт цаг үлдэж, бэлтгэх боломж хязгаарлагдмал байна.`,
      });
    } else {
      const before = previousDay(day);
      const beforeLoad = committedOn(cal, before);
      if (beforeLoad >= 7) {
        conflicts.push({
          examOrAssignment: `${exam.subject} шалгалт`,
          date: exam.examDate,
          conflictDescriptionMongolian: `${exam.subject} шалгалтын (${mnDate(exam.examDate)}) өмнөх ${DAY_MN[before]} гарагт ${beforeLoad} цагийн ачаалал төлөвлөгдсөн тул өмнө нь бэлдэх цаг алга.`,
        });
      }
    }
  }

  for (const a of assignments) {
    if (a.isCompleted) continue;
    const away = daysUntil(a.dueDate);
    if (away < -3 || away > 10) continue;
    const day = dayOfDate(a.dueDate);
    const committed = committedOn(cal, day);
    const slack = slackOn(cal, day);
    if (committed >= 7 || slack < 1) {
      conflicts.push({
        examOrAssignment: a.title,
        date: a.dueDate,
        conflictDescriptionMongolian: `«${a.title}» даалгаврын хугацаа (${mnDate(a.dueDate)}) ${DAY_MN[day]} гарагийн ${committed} цагийн ачаалал дунд, зөвхөн ${slack} цаг чөлөөт цагтай давхцаж байна.`,
      });
    }
  }
  return conflicts;
}

export function matchOpportunities(student: StudentProfile, free: WeeklyScheduleItem[]): OpportunityWithMatch[] {
  const interests = student.aboutMe.interests.map(normalize);
  const skills = student.aboutMe.skills.map(normalize);
  const enrolledIds = db.signups.opportunityIdsFor(student.id);
  const signupCounts = db.signups.counts();

  const fitsFreeSlot = (opp: { day: Day; timeSlot: string }) => {
    const [os, oe] = parseSlot(opp.timeSlot);
    return free.some((f) => {
      if (f.day !== opp.day) return false;
      const [fs, fe] = parseSlot(f.timeSlot);
      return fs <= os && oe <= fe;
    });
  };

  return db.opportunities
    .all()
    // A deadline that already passed is not a match, however good it looks.
    .filter((opp) => !opp.deadline || daysUntil(opp.deadline) >= 0)
    .filter(fitsFreeSlot)
    .map((opp) => {
      const req = opp.requiredSkills.map(normalize);
      const skillHits = req.filter((r) => skills.includes(r)).length;
      const interestHit =
        interests.some((i) =>
          [opp.title, opp.organizer, ...opp.requiredSkills].some((t) => normalize(t).includes(i)),
        ) || interests.some((i) => req.some((r) => r.includes(i)));
      const signups = signupCounts.get(opp.id) ?? 0;
      const placesLeft = opp.capacity > 0 ? Math.max(0, opp.capacity - signups) : null;
      let score = 25 + (req.length ? (skillHits / req.length) * 50 : 25) + (interestHit ? 25 : 0);
      if (placesLeft === 0) score -= 30;
      else if (placesLeft !== null && placesLeft <= 2) score += 5;
      score = clamp(Math.round(score), 5, 100);

      const matchedSkills = opp.requiredSkills.filter((r) => skills.includes(normalize(r)));
      const kinds: string[] = [];
      const matched: string[] = [];
      if (matchedSkills.length) {
        kinds.push('ур чадвар');
        matched.push(...matchedSkills);
      }
      if (interestHit) {
        kinds.push('сонирхол');
        matched.push(student.aboutMe.interests[0] ?? '—');
      }
      const placeNote =
        placesLeft === null
          ? ''
          : placesLeft === 0
            ? ' Сул орон дууссан тул хүлээлийн жагсаалтад бичигдэнэ.'
            : ` Одоо ${placesLeft} сул орон байна.`;
      const reason = matched.length
        ? `Таны ${kinds.join(' болон ')}той (${matched.join(', ')}) нийцэж, ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтаж байна.${placeNote}`
        : `Шаардагдсан ур чадвартай давхцахгүй ч ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтах тул шинэ ур чадвар эзэмшихэд тохиромжтой.${placeNote}`;
      return {
        ...opp,
        matchScore: `${score}%`,
        matchReasonMongolian: reason,
        enrolled: enrolledIds.has(opp.id),
        signups,
        placesLeft,
      };
    })
    .sort((a, b) => parseInt(b.matchScore) - parseInt(a.matchScore));
}

function matchedOpportunitiesForAnalysis(matches: OpportunityWithMatch[]): MatchedOpportunity[] {
  return matches.slice(0, 3).map((m) => ({
    opportunityId: m.id,
    title: m.title,
    matchScore: m.matchScore,
    matchReasonMongolian: m.matchReasonMongolian,
  }));
}

const riskMn = (risk: 'Low' | 'Medium' | 'High', upper: boolean) =>
  risk === 'High' ? (upper ? 'Өндөр' : 'өндөр') : risk === 'Medium' ? (upper ? 'Дунд' : 'дунд') : upper ? 'Бага' : 'бага';

async function gemmaEnrich(
  student: StudentProfile,
  facts: WorkloadFacts,
): Promise<Partial<{ aiSummaryMongolian: string; deadlineAdjustments: string; examPrepAdvice: string; progressSummaryMongolian: string }>> {
  if (!gemmaEnabled) return {};
  const prompt = `Чи бол BalanceEd платформын AI туслах. Доорх мэдээлэлд үндэслэн Монгол хэлээр 4 хэсэг бүтээ. Зөвхөн JSON буцаа (markdown хэрэглэхгүй).
Сурагч: ${student.name}, ${student.grade}, ${student.school}
Ачааллын оноо (1-10): ${facts.score}, стрессийн түвшин (0-100): ${facts.stressScore}
Стрессийн шалтгаан: ${facts.stressDrivers.filter((d) => d.impact > 0).map((d) => d.detailMongolian).join(' ') || 'байхгүй'}
Хугацаа: сургууль ${facts.schoolHours} цаг, хичээлээс гадуурх ажил ${facts.activityHours} цаг, чөлөөт цаг ${facts.freeHours} цаг
Гүйцэтгэл: ${facts.completionPercentage}%, хугацаа хэтэрсэн: ${facts.overdue}, ойрын шалгалт: ${facts.upcomingExams.map((e) => `${e.subject} (${mnDate(e.examDate)})`).join(', ') || 'байхгүй'}
Давхцал: ${facts.conflicts.map((c) => `${c.examOrAssignment} ${mnDate(c.date)}`).join('; ') || 'байхгүй'}
Огноог зааварчилгаагүйгээр "10 сарын 29" хэлбэрээр бич.

JSON түлхүүрүүд:
"aiSummaryMongolian": эцэг эхэд зориулсан 2-3 өгүүлбэрийн эелдэг тойм,
"deadlineAdjustments": багшид зориулсан хугацаа сунгах тодорхой зөвлөмж,
"examPrepAdvice": шалгалтад бэлтгэх зөвлөмж,
"progressSummaryMongolian": эцэг эхийн тайлангийн 1-2 өгүүлбэр.`;
  const raw = await gemmaComplete(prompt);
  if (!raw) return {};
  try {
    const json = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
  } catch {
    return {};
  }
}

/** Everything the model knows about one student, without report text or network calls. */
export function buildWorkloadFacts(student: StudentProfile): WorkloadFacts {
  return measure(
    student,
    storedSchedule(student.id),
    db.schoolHours.byStudent(student.id),
    db.assignments.byStudent(student.id),
    db.exams.byStudent(student.id),
  );
}

export async function buildWorkloadAnalysis(student: StudentProfile) {
  const stored = storedSchedule(student.id);
  const school = db.schoolHours.byStudent(student.id);
  const facts = measure(student, stored, school, db.assignments.byStudent(student.id), db.exams.byStudent(student.id));
  const matches = matchOpportunities(student, freeSlotsFrom(student.id, stored, school));
  const ai = await gemmaEnrich(student, facts);

  const topDriver = facts.stressDrivers[0];
  const aiSummaryMongolian =
    ai.aiSummaryMongolian ??
    `${student.name} сурагчийн долоо хоногийн ачаалал ${facts.score}/10 (${STATUS_MN[facts.status] ?? facts.status}), стрессийн түвшин ${facts.stressScore}/100 буюу ${riskMn(facts.stressRisk, false)} эрсдэлтэй байна. Сургуульд ${facts.schoolHours} цаг, хичээлээс гадуурх ажилд ${facts.activityHours} цаг зарцуулж, гарын чөлөөт цаг ${facts.freeHours} цаг үлдэж байна.${
      topDriver && topDriver.impact > 0 ? ` Гол шалтгаан: ${topDriver.detailMongolian}` : ' Стрессийг нэмэгдүүлэх гол шалтгаан илэрч байхгүй байна.'
    }${facts.conflicts.length ? ' Хуваарьт давхцал илэрсэн тул зарим даалгаврын хугацааг хойшлуулахыг зөвлөж байна.' : ' Одоогоор ноцтой давхцал алга.'}`;

  const deadlineAdjustments =
    ai.deadlineAdjustments ??
    (facts.conflicts.length
      ? `${facts.conflicts[0].examOrAssignment} (${mnDate(facts.conflicts[0].date)})-гийн хугацааг хоёр хоногоор сунгавал ${DAY_MN[dayOfDate(facts.conflicts[0].date)]} гарагийн ачаалал буурч, бэлтгэх цаг олно.`
      : 'Одоогоор хугацаа сунгах шаардлагагүй — хуваарь тэнцвэртэй байна.');

  const examPrepAdvice =
    ai.examPrepAdvice ??
    (facts.upcomingExams.length
      ? `${facts.upcomingExams[0].subject} шалгалтад (${mnDate(facts.upcomingExams[0].examDate)}) бэлтгэхийн тулд чөлөөт цагаа 45 минутын хэсэгт хувааж, шалгалтын өмнөх өдөр 19:30-аас хойш ажил төлөвлөхөөс зайлсхийгээрэй.`
      : 'Ойрын хугацаанд шалгалт товлогдоогүй тул чөлөөт цагтай өдрүүдэд тогтмол давталт хийж сэдвээ батжуулаарай.');

  const progressSummaryMongolian =
    ai.progressSummaryMongolian ??
    `Таны хүүхэд ${facts.total} даалгавраас ${facts.completed}-г гүйцэтгэсэн (${facts.completionPercentage}%).${
      facts.overdue ? ` ${facts.overdue} даалгаврын хугацаа хэтрэв.` : ''
    }${
      facts.upcomingExams.length
        ? ` Ойрын өдрүүдэд ${facts.upcomingExams.map((e) => `${e.subject} (${mnDate(e.examDate)})`).join(', ')} шалгалт байна.`
        : ''
    } Ачааллын оноо ${facts.score}/10, стрессийн түвшин ${facts.stressScore}/100 тул эрсдэл ${riskMn(facts.stressRisk, false)} байна.`;

  return {
    studentName: student.name,
    workloadAnalysis: {
      workloadScore: facts.score,
      status: facts.status,
      stressScore: facts.stressScore,
      stressRisk: facts.stressRisk,
      stressDrivers: facts.stressDrivers,
      aiSummaryMongolian,
    },
    academicProgress: {
      totalAssignments: facts.total,
      completedAssignments: facts.completed,
      completionPercentage: facts.completionPercentage,
      overdueAssignments: facts.overdue,
      upcomingExamsCount: facts.upcomingExams.length,
      scheduleConflicts: facts.conflicts,
    },
    matchedOpportunities: matchedOpportunitiesForAnalysis(matches),
    teacherRecommendations: { deadlineAdjustments, examPrepAdvice },
    parentReport: { progressSummaryMongolian },
    weeklyScheduleSummary: {
      totalActivityHours: facts.activityHours,
      schoolHours: facts.schoolHours,
      freeHours: facts.freeHours,
      scheduledItems: facts.scheduledItems,
    },
  };
}

export interface WorkloadRow {
  studentId: string;
  studentName: string;
  grade: string;
  workloadScore: number;
  status: string;
  stressScore: number;
  stressRisk: 'Low' | 'Medium' | 'High';
  /** Highest-impact driver, or null when nothing is pushing stress up. */
  topDriver: string | null;
}

/** Scores the whole class from the model alone — no report text, no matching, no network. */
export function buildClassWorkload(students: StudentProfile[]): WorkloadRow[] {
  return students
    .map((student) => {
      const facts = buildWorkloadFacts(student);
      const top = facts.stressDrivers.find((d) => d.impact > 0);
      return {
        studentId: student.id,
        studentName: student.name,
        grade: student.grade,
        workloadScore: facts.score,
        status: facts.status,
        stressScore: facts.stressScore,
        stressRisk: facts.stressRisk,
        topDriver: top ? top.labelMongolian : null,
      };
    })
    .sort((a, b) => b.stressScore - a.stressScore || b.workloadScore - a.workloadScore);
}
