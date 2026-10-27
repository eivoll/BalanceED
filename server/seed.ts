import { hashPassword } from './auth.js';
import type {
  Assignment,
  Day,
  Exam,
  Opportunity,
  StudentProfile,
  UserAccount,
  WeeklyScheduleItem,
} from '../shared/types.js';

export interface Table<T extends { id: string }> {
  insertSeed(entity: T): T;
  size(): number;
  all(): T[];
}

export interface Tables {
  students: Table<StudentProfile>;
  schedule: Table<WeeklyScheduleItem>;
  assignments: Table<Assignment>;
  exams: Table<Exam>;
  opportunities: Table<Opportunity>;
  users: Table<UserAccount>;
  linkParent(parentId: string, studentId: string): void;
  addSignup(opportunityId: string, studentId: string): void;
  setSchoolHours(studentId: string, entries: { day: Day; timeSlot: string }[]): void;
  hasSchoolHours(studentId: string): boolean;
  assignUnownedStudentsTo(teacherId: string): number;
}

/** Demo password shown on the login screen — replace it with changePassword before any real use. */
export const DEMO_PASSWORD = 'Demo!2026';

/** Demo dates are anchored to first run, so a freshly seeded class always looks live. */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** The demo class shares one weekday timetable. */
const WEEKDAY_HOURS: { day: Day; timeSlot: string }[] = [
  { day: 'Monday', timeSlot: '08:00-15:00' },
  { day: 'Tuesday', timeSlot: '08:00-15:00' },
  { day: 'Wednesday', timeSlot: '08:00-15:00' },
  { day: 'Thursday', timeSlot: '08:00-15:00' },
  { day: 'Friday', timeSlot: '08:00-15:00' },
];

const STUDENTS: StudentProfile[] = [
  {
    id: 'stu_1',
    name: 'Батбаяр Ганбаатар',
    grade: '11-Б',
    school: 'Улаанбаатар хотын 25-р сургууль',
    aboutMe: {
      interests: ['Дизайн', 'Урлаг', 'Робототехник'],
      skills: ['График дизайн', 'Зураг татах', 'Python'],
      careerGoals: ['UX дизайнер', 'Тоглоомын уран зураач'],
    },
    parentVerification: { isScheduleApproved: true, approvedDate: isoDate(-3) },
    teacherId: 'usr_teacher',
    joinCode: 'DEMOA1',
  },
  {
    id: 'stu_2',
    name: 'Сарангэрэл Бат-Эрдэнэ',
    grade: '11-Б',
    school: 'Улаанбаатар хотын 25-р сургууль',
    aboutMe: {
      interests: ['Маргаа', 'Байгаль', 'Хөгжим'],
      skills: ['Илтгэл хийх', 'Англи хэл', 'Пианино'],
      careerGoals: ['Өмгөөлөгч', 'Бодлогын шинжээч'],
    },
    parentVerification: { isScheduleApproved: false },
    teacherId: 'usr_teacher',
    joinCode: 'DEMOB2',
  },
];

const SCHEDULE: WeeklyScheduleItem[] = [
  // Батбаяр — heavy week (drives a High workload demo)
  { id: 'sch_1', studentId: 'stu_1', day: 'Monday', timeSlot: '16:00-18:00', activity: 'Сагсан бөмбөгийн дасгал', isFreeSlot: false, isSchool: false },
  { id: 'sch_2', studentId: 'stu_1', day: 'Monday', timeSlot: '18:30-20:00', activity: 'Математикийн нэмэлт хичээл', isFreeSlot: false, isSchool: false },
  { id: 'sch_3', studentId: 'stu_1', day: 'Tuesday', timeSlot: '15:30-17:30', activity: 'Роботын клуб', isFreeSlot: false, isSchool: false },
  { id: 'sch_4', studentId: 'stu_1', day: 'Wednesday', timeSlot: '16:00-18:00', activity: 'Сагсан бөмбөгийн дасгал', isFreeSlot: false, isSchool: false },
  { id: 'sch_5', studentId: 'stu_1', day: 'Thursday', timeSlot: '17:00-19:00', activity: 'Зурагийн сургалт', isFreeSlot: false, isSchool: false },
  { id: 'sch_6', studentId: 'stu_1', day: 'Friday', timeSlot: '16:00-18:00', activity: 'Хүүхэд асрах ажил (хагас цаг)', isFreeSlot: false, isSchool: false },
  { id: 'sch_7', studentId: 'stu_1', day: 'Saturday', timeSlot: '10:00-12:00', activity: 'Тэмцээний бэлтгэл', isFreeSlot: false, isSchool: false },
  // Сарангэрэл — balanced week
  { id: 'sch_8', studentId: 'stu_2', day: 'Tuesday', timeSlot: '17:00-18:30', activity: 'Маргааны клуб', isFreeSlot: false, isSchool: false },
  { id: 'sch_9', studentId: 'stu_2', day: 'Thursday', timeSlot: '16:00-17:30', activity: 'Пианины хичээл', isFreeSlot: false, isSchool: false },
  { id: 'sch_10', studentId: 'stu_2', day: 'Saturday', timeSlot: '10:00-12:00', activity: 'Сайн дурын ажил: мод суулгах', isFreeSlot: false, isSchool: false },
];

const ASSIGNMENTS: Assignment[] = [
  { id: 'asg_1', studentId: 'stu_1', title: 'Математикийн 7-р бодлогын даалгавар', subject: 'Математик', dueDate: isoDate(2), isCompleted: false },
  { id: 'asg_2', studentId: 'stu_1', title: 'Photoshop зарын төсөл', subject: 'Зураг', dueDate: isoDate(4), isCompleted: true },
  { id: 'asg_3', studentId: 'stu_1', title: 'Оптикийн лабораторийн тайлан', subject: 'Физик', dueDate: isoDate(5), isCompleted: false },
  { id: 'asg_4', studentId: 'stu_1', title: 'Эсрэг төсөөллийн зохиолын илтгэл', subject: 'Англи хэл', dueDate: isoDate(7), isCompleted: true },
  { id: 'asg_5', studentId: 'stu_1', title: 'Python тоглоомын 2-р үе шат', subject: 'Мэдээлэл зүй', dueDate: isoDate(9), isCompleted: false },
  { id: 'asg_6', studentId: 'stu_2', title: 'Иргэн судлал: тохиолдолын шинжилгээ', subject: 'Нийгэм судлал', dueDate: isoDate(3), isCompleted: true },
  { id: 'asg_7', studentId: 'stu_2', title: 'Биологийн бүтцийн зураглал', subject: 'Биологи', dueDate: isoDate(6), isCompleted: false },
  { id: 'asg_8', studentId: 'stu_2', title: 'Маргааны 12-р сэдвийн бэлтгэл', subject: 'Англи хэл', dueDate: isoDate(8), isCompleted: false },
];

const EXAMS: Exam[] = [
  { id: 'exm_1', studentId: 'stu_1', subject: 'Математик', examDate: isoDate(3), time: '09:00' },
  { id: 'exm_2', studentId: 'stu_1', subject: 'Физик', examDate: isoDate(10), time: '11:00' },
  { id: 'exm_3', studentId: 'stu_2', subject: 'Биологи', examDate: isoDate(6), time: '10:00' },
];

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp_1',
    title: 'Сургуулийн хэрэм зураглах баг',
    organizer: '25-р сургуулийн зурагийн салбар',
    requiredSkills: ['График дизайн', 'Зураг татах'],
    day: 'Wednesday',
    timeSlot: '17:30-19:00',
    level: 'School',
    description: 'Сургуулийн үүдний хэрэм дээр хамтран зураг төсөл хийнэ. Санаа гаргаж, өнгө сонгох дуртай сурагчид нээлттэй.',
    location: 'Сургуулийн үүдний хэрэм',
    deadline: isoDate(9),
    capacity: 8,
  },
  {
    id: 'opp_2',
    title: 'Үндэсний роботын үзүүлэн',
    organizer: 'Монголын STEM сан',
    requiredSkills: ['Python', 'Робототехник'],
    day: 'Saturday',
    timeSlot: '14:00-17:00',
    level: 'National',
    description: 'Багаараа робот угсраад шүүгчдэд 10 минутын танилцуулга хийнэ. Програм бичиж чаддаг сурагчид зориулав.',
    location: 'Залуучуудын төв, Улаанбаатар',
    deadline: isoDate(14),
    capacity: 24,
  },
  {
    id: 'opp_3',
    title: 'Уур амьсгалын маргааны цом',
    organizer: 'UN Youth Mongolia',
    requiredSkills: ['Илтгэл хийх', 'Англи хэл'],
    day: 'Sunday',
    timeSlot: '11:00-13:00',
    level: 'Global',
    description: 'Англи хэл дээр уур амьсгалын бодлогыг маргаана. Дөрвөн шаттай тэмцээн, багт гурван хүртэл гишүүн авна.',
    location: 'Онлайн: Zoom',
    deadline: isoDate(7),
    capacity: 0,
  },
  {
    id: 'opp_4',
    title: 'Номын сангийн уншигч хамтрагч',
    organizer: 'Баянзүрх дүүргийн номын сан',
    requiredSkills: ['Англи хэл'],
    day: 'Friday',
    timeSlot: '16:00-17:30',
    level: 'School',
    description: 'Жижиг насны хүүхдүүдэд англи хэлээр ном уншиж өгнө. Долоо хоног бүр тогтмол ирдэг ажил.',
    location: 'Баянзүрх дүүрэг, 11-р хороолол',
    deadline: '',
    capacity: 5,
  },
  {
    id: 'opp_5',
    title: 'Ахлах сурагчдын UX дадлага',
    organizer: 'Nest.mn финтех',
    requiredSkills: ['График дизайн', 'Figma'],
    day: 'Sunday',
    timeSlot: '15:00-17:00',
    level: 'National',
    description: 'Бүтээгдэхүүний багтай хамт интерактив прототип хийж суралцах, найман долоо хоног зайнаас үргэлжлэх дадлага.',
    location: 'Зайнаас',
    deadline: isoDate(20),
    capacity: 3,
  },
  {
    id: 'opp_6',
    title: 'Хандивын пианины концертын баг',
    organizer: 'Улаан загалайн залуучуудын баг',
    requiredSkills: ['Пианино', 'Хөгжим'],
    day: 'Saturday',
    timeSlot: '15:00-17:00',
    level: 'School',
    description: 'Хандивын тоглолтын тайзны ард ажиллах, бэлтгэлд оролцох баг. Хөгжимд дуртай сурагчдад нээлттэй.',
    location: 'Хандивын тоглолтын тайз',
    deadline: isoDate(5),
    capacity: 10,
  },
];

/** One scrypt run for all three accounts; only paid when the users table is empty. */
async function demoUsers(): Promise<UserAccount[]> {
  const createdAt = new Date().toISOString();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return [
    { id: 'usr_teacher', email: 'teacher@demo.mn', displayName: 'О. Энхжаргал', role: 'teacher', passwordHash, createdAt },
    { id: 'usr_student_1', email: 'student@demo.mn', displayName: 'Батбаяр Ганбаатар', role: 'student', passwordHash, createdAt, studentId: 'stu_1' },
    { id: 'usr_parent_1', email: 'parent@demo.mn', displayName: 'Г. Мөнхзул', role: 'parent', passwordHash, createdAt },
  ];
}

const DEMO_PARENT_LINKS: [string, string][] = [['usr_parent_1', 'stu_1']];

/** Placed in advance so the hub shows both "бүртгэгдсэн" and "элсэх" states. */
const DEMO_SIGNUPS: [string, string][] = [['opp_1', 'stu_1'], ['opp_4', 'stu_2']];

export async function seedIfEmpty(tables: Tables): Promise<void> {
  if (tables.students.size() === 0) {
    for (const row of STUDENTS) tables.students.insertSeed(row);
    for (const row of SCHEDULE) tables.schedule.insertSeed(row);
    for (const row of ASSIGNMENTS) tables.assignments.insertSeed(row);
    for (const row of EXAMS) tables.exams.insertSeed(row);
    for (const row of OPPORTUNITIES) tables.opportunities.insertSeed(row);
    for (const [opportunityId, studentId] of DEMO_SIGNUPS) tables.addSignup(opportunityId, studentId);
    console.log(
      `[balanceed] seeded ${STUDENTS.length} students, ${SCHEDULE.length} schedule items, ` +
        `${ASSIGNMENTS.length} assignments, ${EXAMS.length} exams, ${OPPORTUNITIES.length} opportunities`,
    );
  }

  if (tables.users.size() === 0) {
    const accounts = await demoUsers();
    for (const row of accounts) tables.users.insertSeed(row);
    for (const [parentId, studentId] of DEMO_PARENT_LINKS) tables.linkParent(parentId, studentId);
    console.log(
      `[balanceed] seeded ${accounts.length} demo accounts (password "${DEMO_PASSWORD}") — change them with changePassword`,
    );
  }

  // Every student needs a timetable before the free-slot maths means anything.
  let timetabled = 0;
  for (const student of tables.students.all()) {
    if (tables.hasSchoolHours(student.id)) continue;
    tables.setSchoolHours(student.id, WEEKDAY_HOURS);
    timetabled++;
  }
  if (timetabled) console.log(`[balanceed] gave ${timetabled} student(s) the weekday 08:00-15:00 timetable`);

  // Databases seeded before accounts existed have students nobody owns.
  const adopted = tables.assignUnownedStudentsTo('usr_teacher');
  if (adopted) console.log(`[balanceed] assigned ${adopted} student(s) to the demo teacher account`);
}
