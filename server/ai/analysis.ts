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
export function computeFreeSlots(studentId: string): WeeklyScheduleItem[] {
  const items = db.schedule.find((s) => s.studentId === studentId && !s.isFreeSlot);
  const out: WeeklyScheduleItem[] = [];
  for (const day of DAYS) {
    const [winStart, winEnd] = DAY_WINDOW[day];
    const busy = items
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

function busyHoursByDay(studentId: string): Map<Day, number> {
  const map = new Map<Day, number>();
  for (const item of db.schedule.find((s) => s.studentId === studentId && !s.isFreeSlot)) {
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

export function matchOpportunities(student: StudentProfile): OpportunityWithMatch[] {
  const free = computeFreeSlots(student.id);
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
      const why: string[] = [];
      if (matchedSkills.length) why.push(`ур чадвар (${matchedSkills.join(', ')})`);
      if (interestHit) why.push(`сонирхол (${student.aboutMe.interests[0] ?? '—'})`);
      const reason = why.length
        ? `Таны ${why.join(' болон ')}-тай нийцэж, ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтаж байна.`
        : `Шууд ур чадварын нийц багатай ч ${DAY_MN[opp.day]} гарагийн ${opp.timeSlot} чөлөөт цагт багтах тул шинэ ур чадвар эзэмшихэд тохиромжтой.`;
      return { ...opp, matchScore: `${score}%`, matchReasonMongolian: reason };
    })
    .sort((a, b) => parseInt(b.matchScore) - parseInt(a.matchScore));
}

function matchedOpportunitiesForAnalysis(student: StudentProfile): MatchedOpportunity[] {
  return matchOpportunities(student).slice(0, 3).map((m) => ({
    opportunityId: m.id,
    title: m.title,
    matchScore: m.matchScore,
    matchReasonMongolian: m.matchReasonMongolian,
  }));
}

function detectConflicts(
  student: StudentProfile,
  assignments: Assignment[],
  exams: Exam[],
): { examOrAssignment: string; date: string; conflictDescriptionMongolian: string }[] {
  const busy = busyHoursByDay(student.id);
  const dayOf = (iso: string) => DAYS[new Date(iso + 'T12:00:00').getDay() === 0 ? 6 : new Date(iso + 'T12:00:00').getDay() - 1];
  const conflicts: { examOrAssignment: string; date: string; conflictDescriptionMongolian: string }[] = [];

  for (const exam of exams.filter((e) => withinDays(e.examDate, 14))) {
    const day = dayOf(exam.examDate);
    const hours = busy.get(day) ?? 0;
    if (hours >= 3) {
      conflicts.push({
        examOrAssignment: `${exam.subject} шалгалт`,
        date: exam.examDate,
        conflictDescriptionMongolian: `${exam.subject} шалгалт (${exam.examDate}) ${DAY_MN[day]} гарагт товлогдсон бөгөөд тэр өдөр ${hours.toFixed(1)} цагийн хичээлээс гадуурх ачаалалтай давхцаж байна.`,
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
        conflictDescriptionMongolian: `"${a.title}" даалгаврын хугацаа (${a.dueDate}) ${DAY_MN[day]} гарагийн ${hours.toFixed(1)} цагийн ачаалалтай давхцаж байна.`,
      });
    }
  }
  return conflicts;
}

async function gemmaEnrich(student: StudentProfile, ctx: {
  score: number;
  conflicts: { examOrAssignment: string; date: string }[];
  completion: number;
  exams: Exam[];
}): Promise<Partial<{ aiSummaryMongolian: string; deadlineAdjustments: string; examPrepAdvice: string; progressSummaryMongolian: string }>> {
  if (!gemmaEnabled) return {};
  const prompt = `Чи бол BalanceEd платформын AI туслах. Доорх мэдээлэлд үндэслэн Монгол хэлээр 4 хэсэг бүтээ. Зөвхөн JSON буцаа (markdown хэрэглэхгүй).
Сурагч: ${student.name}, ${student.grade}, ${student.school}
Ачааллын оноо (1-10): ${ctx.score}, гүйцэтгэл: ${ctx.completion}%, удахгүй шалгалт: ${ctx.exams.map((e) => `${e.subject} (${e.examDate})`).join(', ') || 'байхгүй'}
Давхцал: ${ctx.conflicts.map((c) => `${c.examOrAssignment} ${c.date}`).join('; ') || 'байхгүй'}

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
  const assignments = db.assignments.find((a) => a.studentId === student.id);
  const exams = db.exams.find((e) => e.studentId === student.id);
  const weeklyItems = db.schedule.find((s) => s.studentId === student.id && !s.isFreeSlot);

  const busy = busyHoursByDay(student.id);
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

  const stressRisk = stressFromScore(score);
  const status = statusFromScore(score);
  const conflicts = detectConflicts(student, assignments, exams);

  const ai = await gemmaEnrich(student, { score, conflicts, completion: completionPercentage, exams: upcomingExams });

  const aiSummaryMongolian =
    ai.aiSummaryMongolian ??
    `${student.name} сурагчийн долоо хоногийн ачаалал ${score}/10 (${STATUS_MN[status] ?? status}) байна. Нийт ${totalActivityHours.toFixed(1)} цаг хичээлээс гадуурх үйл ажиллагаа, ${pendingSoon} гүйцэтгээгүй даалгавар, ${upcomingExams.length} шалгалт төлөвлөгдсөн. Стрессийн эрсдэл: ${stressRisk === 'High' ? 'Өндөр' : stressRisk === 'Medium' ? 'Дунд' : 'Бага'}. ${conflicts.length ? 'Хуваарьт давхцал илэрсэн тул зарим даалгаврын хугацааг хойшлуулахыг зөвлөж байна.' : 'Хуваарьт ноцтой давхцал алга.'}`;

  const deadlineAdjustments =
    ai.deadlineAdjustments ??
    (conflicts.length
      ? `${conflicts[0].examOrAssignment} (${conflicts[0].date}) хугацааг хамгийн их ачаалалтай өдрөөс хойш хоёр хоног сунгахыг зөвлөж байна.`
      : 'Одоогоор хугацаа сунгах шаардлагагүй — хуваарь тэнцвэртэй байна.');

  const examPrepAdvice =
    ai.examPrepAdvice ??
    (upcomingExams.length
      ? `${upcomingExams[0].subject} шалгалтад (${upcomingExams[0].examDate}) бэлтгэхийн тулд чөлөөт цагийн хэсгүүдийг 45 минутын блокт хувааж, шалгалтын өмнөх өдөр хүнд үйл ажиллагаа төлөвлөхөөс зайлсхий.`
      : 'Удахгүй шалгалт байхгүй тул тогтмол давталтаар сэдвүүдээ батжуулаарай.');

  const progressSummaryMongolian =
    ai.progressSummaryMongolian ??
    `Таны хүүхэд ${total} даалгавраас ${completed}-г гүйцэтгэсэн (${completionPercentage}% биелэлт). ${upcomingExams.length ? `Удахгүй ${upcomingExams.map((e) => `${e.subject} (${e.examDate})`).join(', ')} шалгалт байна. ` : ''}Ачааллын оноо ${score}/10, стрессийн эрсдэл ${stressRisk === 'High' ? 'өндөр' : stressRisk === 'Medium' ? 'дунд' : 'бага'} түвшинд байна.`;

  return {
    studentName: student.name,
    workloadAnalysis: {
      workloadScore: score,
      status,
      stressRisk,
      aiSummaryMongolian,
    },
    academicProgress: {
      totalAssignments: total,
      completedAssignments: completed,
      completionPercentage,
      upcomingExamsCount: upcomingExams.length,
      scheduleConflicts: conflicts,
    },
    matchedOpportunities: matchedOpportunitiesForAnalysis(student),
    teacherRecommendations: { deadlineAdjustments, examPrepAdvice },
    parentReport: { progressSummaryMongolian },
    weeklyScheduleSummary: {
      totalActivityHours: Math.round(totalActivityHours * 10) / 10,
      scheduledItems: weeklyItems.length,
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

export async function buildClassWorkload(students: StudentProfile[]): Promise<WorkloadRow[]> {
  const rows: WorkloadRow[] = [];
  for (const student of students) {
    const a = await buildWorkloadAnalysis(student);
    rows.push({
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      workloadScore: a.workloadAnalysis.workloadScore,
      status: a.workloadAnalysis.status,
      stressRisk: a.workloadAnalysis.stressRisk,
    });
  }
  return rows.sort((x, y) => y.workloadScore - x.workloadScore);
}
