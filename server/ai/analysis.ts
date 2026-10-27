import { db } from '../db.js';
import type {
  Assignment,
  Day,
  Exam,
  MatchedOpportunity,
  OpportunityWithMatch,
  StudentProfile,
  WeeklyScheduleItem,
} from '../../shared/types.js';
import { DAYS } from '../../shared/types.js';
import { gemmaComplete, gemmaEnabled } from './gemma.js';

const DAY_WINDOW: Record<Day, [number, number]> = {
  Monday: [8, 20],
  Tuesday: [8, 20],
  Wednesday: [8, 20],
  Thursday: [8, 20],
  Friday: [8, 20],
  Saturday: [9, 20],
  Sunday: [9, 20],
};

const normalize = (s: string) => s.replace(/^#/, '').toLowerCase();

function parseSlot(timeSlot: string): [number, number] {
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

/** Gaps of >= 1h in the student's day window, per spec "remaining empty time = Free Slots". */
export function freeSlotsFrom(studentId: string, stored: WeeklyScheduleItem[]): WeeklyScheduleItem[] {
  const out: WeeklyScheduleItem[] = [];
  for (const day of DAYS) {
    const [winStart, winEnd] = DAY_WINDOW[day];
    const busy = stored
      .filter((i) => i.day === day)
      .map((i) => parseSlot(i.timeSlot))
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

/** Stored items only — the derived free slots are never persisted. */
function storedSchedule(studentId: string): WeeklyScheduleItem[] {
  return db.schedule.byStudent(studentId).filter((i) => !i.isFreeSlot);
}

export function computeFreeSlots(studentId: string): WeeklyScheduleItem[] {
  return freeSlotsFrom(studentId, storedSchedule(studentId));
}

let freeSeq = 0;
function freeItem(studentId: string, day: Day, start: number, end: number): WeeklyScheduleItem {
  return {
    id: `free_${studentId}_${day}_${++freeSeq}`,
    studentId,
    day,
    timeSlot: fmtSlot(start, end),
    activity: 'Free Slot',
    isFreeSlot: true,
  };
}

function busyHoursByDay(stored: WeeklyScheduleItem[]): Map<Day, number> {
  const map = new Map<Day, number>();
  for (const item of stored) {
    const [s, e] = parseSlot(item.timeSlot);
    map.set(item.day, (map.get(item.day) ?? 0) + (e - s));
  }
  return map;
}

function withinDays(isoDate: string, days: number): boolean {
  const diff = (new Date(isoDate).getTime() - Date.now()) / 86_400_000;
  return diff >= -0.5 && diff <= days;
}

function stressFromScore(score: number): 'Low' | 'Medium' | 'High' {
  return score < 4 ? 'Low' : score <= 7 ? 'Medium' : 'High';
}

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

export function matchOpportunities(student: StudentProfile, free: WeeklyScheduleItem[]): OpportunityWithMatch[] {
  const interests = student.aboutMe.interests.map(normalize);
  const skills = student.aboutMe.skills.map(normalize);

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
    .filter(fitsFreeSlot)
    .map((opp) => {
      const req = opp.requiredSkills.map(normalize);
      const skillHits = req.filter((r) => skills.includes(r)).length;
      const interestHit =
        interests.some((i) =>
          [opp.title, opp.organizer, ...opp.requiredSkills].some((t) =>
            normalize(t).includes(i),
          ),
        ) || interests.some((i) => req.some((r) => r.includes(i)));
      const score = Math.min(
        100,
        Math.round(25 + (req.length ? (skillHits / req.length) * 50 : 25) + (interestHit ? 25 : 0)),
      );
      const matchedSkills = opp.requiredSkills.filter((r) =>
        skills.includes(normalize(r)),
      );
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
      const reason = matched.length
        ? `Таны ${kinds.join(' болон ')}той (${matched.join(', ')}) нийцэж, ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтаж байна.`
        : `Шаардагдсан ур чадвартай давхцахгүй ч ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтах тул шинэ ур чадвар эзэмшихэд тохиромжтой.`;
      return { ...opp, matchScore: `${score}%`, matchReasonMongolian: reason };
    })
    .sort((a, b) => parseInt(b.matchScore) - parseInt(a.matchScore));
}

type Conflict = { examOrAssignment: string; date: string; conflictDescriptionMongolian: string };

function matchedOpportunitiesForAnalysis(student: StudentProfile, free: WeeklyScheduleItem[]): MatchedOpportunity[] {
  return matchOpportunities(student, free).slice(0, 3).map((m) => ({
    opportunityId: m.id,
    title: m.title,
    matchScore: m.matchScore,
    matchReasonMongolian: m.matchReasonMongolian,
  }));
}

function detectConflicts(
  busy: Map<Day, number>,
  assignments: Assignment[],
  exams: Exam[],
): Conflict[] {
  const dayOf = (iso: string) => DAYS[new Date(iso + 'T12:00:00').getDay() === 0 ? 6 : new Date(iso + 'T12:00:00').getDay() - 1];
  const conflicts: Conflict[] = [];

  for (const exam of exams.filter((e) => withinDays(e.examDate, 14))) {
    const day = dayOf(exam.examDate);
    const hours = busy.get(day) ?? 0;
    if (hours >= 3) {
      conflicts.push({
        examOrAssignment: `${exam.subject} шалгалт`,
        date: exam.examDate,
        conflictDescriptionMongolian: `${exam.subject} шалгалт (${mnDate(exam.examDate)}) ${DAY_MN[day]} гарагт товлогдсон бөгөөд тэр өдөр ${hours.toFixed(1)} цагийн хичээлээс гадуурх ачаалалтай давхцаж байна.`,
      });
    }
  }
  for (const a of assignments.filter((a) => !a.isCompleted && withinDays(a.dueDate, 10))) {
    const day = dayOf(a.dueDate);
    const hours = busy.get(day) ?? 0;
    if (hours >= 3) {
      conflicts.push({
        examOrAssignment: a.title,
        date: a.dueDate,
        conflictDescriptionMongolian: `«${a.title}» даалгаврын хугацаа (${mnDate(a.dueDate)}) ${DAY_MN[day]} гарагийн ${hours.toFixed(1)} цагийн ачаалалтай давхцаж байна.`,
      });
    }
  }
  return conflicts;
}

interface WorkloadFacts {
  score: number;
  status: string;
  stressRisk: 'Low' | 'Medium' | 'High';
  totalActivityHours: number;
  scheduledItems: number;
  total: number;
  completed: number;
  completionPercentage: number;
  pendingSoon: number;
  upcomingExams: Exam[];
  conflicts: Conflict[];
}

/**
 * The scoring model on its own: pure, and readable without the report fields.
 * The class index needs only this, so it must not pay for Gemma or matching.
 */
function workloadFacts(stored: WeeklyScheduleItem[], assignments: Assignment[], exams: Exam[]): WorkloadFacts {
  const busy = busyHoursByDay(stored);
  const totalActivityHours = [...busy.values()].reduce((a, b) => a + b, 0);
  const pendingSoon = assignments.filter((a) => !a.isCompleted && withinDays(a.dueDate, 7)).length;
  const upcomingExams = exams.filter((e) => withinDays(e.examDate, 14));
  const total = assignments.length;
  const completed = assignments.filter((a) => a.isCompleted).length;
  const completionPercentage = total ? Math.round((completed / total) * 100) : 0;

  let score =
    1 +
    Math.min(totalActivityHours / 3, 4) +
    Math.min(pendingSoon * 0.9, 3) +
    Math.min(upcomingExams.length, 2);
  if (completionPercentage >= 80) score -= 0.5;
  if (completionPercentage < 40) score += 1;
  score = Math.round(Math.min(10, Math.max(1, score)) * 10) / 10;

  return {
    score,
    status: statusFromScore(score),
    stressRisk: stressFromScore(score),
    totalActivityHours,
    scheduledItems: stored.length,
    total,
    completed,
    completionPercentage,
    pendingSoon,
    upcomingExams,
    conflicts: detectConflicts(busy, assignments, exams),
  };
}

const riskMn = (risk: 'Low' | 'Medium' | 'High', upper: boolean) =>
  risk === 'High' ? (upper ? 'Өндөр' : 'өндөр') : risk === 'Medium' ? (upper ? 'Дунд' : 'дунд') : upper ? 'Бага' : 'бага';

async function gemmaEnrich(student: StudentProfile, facts: WorkloadFacts): Promise<Partial<{ aiSummaryMongolian: string; deadlineAdjustments: string; examPrepAdvice: string; progressSummaryMongolian: string }>> {
  if (!gemmaEnabled) return {};
  const prompt = `Чи бол BalanceEd платформын AI туслах. Доорх мэдээлэлд үндэслэн Монгол хэлээр 4 хэсэг бүтээ. Зөвхөн JSON буцаа (markdown хэрэглэхгүй).
Сурагч: ${student.name}, ${student.grade}, ${student.school}
Ачааллын оноо (1-10): ${facts.score}, гүйцэтгэл: ${facts.completionPercentage}%, ойрын шалгалт: ${facts.upcomingExams.map((e) => `${e.subject} (${mnDate(e.examDate)})`).join(', ') || 'байхгүй'}
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

export async function buildWorkloadAnalysis(student: StudentProfile) {
  const stored = storedSchedule(student.id);
  const assignments = db.assignments.byStudent(student.id);
  const exams = db.exams.byStudent(student.id);
  const facts = workloadFacts(stored, assignments, exams);
  const free = freeSlotsFrom(student.id, stored);
  const ai = await gemmaEnrich(student, facts);

  const aiSummaryMongolian =
    ai.aiSummaryMongolian ??
    `${student.name} сурагчийн долоо хоногийн ачаалал ${facts.score}/10 (${STATUS_MN[facts.status] ?? facts.status}) байна. Нийт ${facts.totalActivityHours.toFixed(1)} цаг хичээлээс гадуурх үйл ажиллагаа, ${facts.pendingSoon} гүйцэтгээгүй даалгавар, ${facts.upcomingExams.length} шалгалт төлөвлөгдсөн. Стрессийн эрсдэл: ${riskMn(facts.stressRisk, true)}. ${facts.conflicts.length ? 'Хуваарьт давхцал илэрсэн тул зарим даалгаврын хугацааг хойшлуулахыг зөвлөж байна.' : 'Хуваарьт ноцтой давхцал алга.'}`;

  const deadlineAdjustments =
    ai.deadlineAdjustments ??
    (facts.conflicts.length
      ? `${facts.conflicts[0].examOrAssignment} (${mnDate(facts.conflicts[0].date)}) хугацааг хамгийн их ачаалалтай өдрөөс хойш хоёр хоног сунгахыг зөвлөж байна.`
      : 'Одоогоор хугацаа сунгах шаардлагагүй — хуваарь тэнцвэртэй байна.');

  const examPrepAdvice =
    ai.examPrepAdvice ??
    (facts.upcomingExams.length
      ? `${facts.upcomingExams[0].subject} шалгалтад (${mnDate(facts.upcomingExams[0].examDate)}) бэлтгэхийн тулд чөлөөт цагаа 45 минутын хэсэгт хувааж, шалгалтын өмнөх өдөр их ачаалалтай үйл ажиллагаа төлөвлөхөөс зайлсхийгээрэй.`
      : 'Ойрын хугацаанд шалгалт товлогдоогүй тул тогтмол давталтаар сэдвүүдээ батжуулаарай.');

  const progressSummaryMongolian =
    ai.progressSummaryMongolian ??
    `Таны хүүхэд ${facts.total} даалгавраас ${facts.completed}-г гүйцэтгэсэн (${facts.completionPercentage}%). ${facts.upcomingExams.length ? `Ойрын өдрүүдэд ${facts.upcomingExams.map((e) => `${e.subject} (${mnDate(e.examDate)})`).join(', ')} шалгалт байна. ` : ''}Ачааллын оноо ${facts.score}/10, стрессийн эрсдэл ${riskMn(facts.stressRisk, false)} түвшинд байна.`;

  return {
    studentName: student.name,
    workloadAnalysis: {
      workloadScore: facts.score,
      status: facts.status,
      stressRisk: facts.stressRisk,
      aiSummaryMongolian,
    },
    academicProgress: {
      totalAssignments: facts.total,
      completedAssignments: facts.completed,
      completionPercentage: facts.completionPercentage,
      upcomingExamsCount: facts.upcomingExams.length,
      scheduleConflicts: facts.conflicts,
    },
    matchedOpportunities: matchedOpportunitiesForAnalysis(student, free),
    teacherRecommendations: { deadlineAdjustments, examPrepAdvice },
    parentReport: { progressSummaryMongolian },
    weeklyScheduleSummary: {
      totalActivityHours: Math.round(facts.totalActivityHours * 10) / 10,
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
  stressRisk: 'Low' | 'Medium' | 'High';
}

/** Scores the whole class from the model alone — no report text, no matching, no network. */
export function buildClassWorkload(students: StudentProfile[]): WorkloadRow[] {
  return students
    .map((student) => {
      const facts = workloadFacts(
        storedSchedule(student.id),
        db.assignments.byStudent(student.id),
        db.exams.byStudent(student.id),
      );
      return {
        studentId: student.id,
        studentName: student.name,
        grade: student.grade,
        workloadScore: facts.score,
        status: facts.status,
        stressRisk: facts.stressRisk,
      };
    })
    .sort((x, y) => y.workloadScore - x.workloadScore);
}
