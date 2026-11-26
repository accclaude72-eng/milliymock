/**
 * Official National Certificate exam formats — initial, versioned configurations.
 *
 * These are SEED values only. At runtime the authoritative copies live in Firestore
 * (`formats` collection) where admins can edit them / create new versions.
 * Every attempt stores a snapshot of the format it was taken under, so editing
 * a format never changes historical results.
 *
 * Sources (see README "Official sources"):
 *  - Biologiya-MS2025.pdf, Kimyo-MS2025.pdf (uzbmb.uz, 2025 specifications)
 *  - Matematika_2024.pdf, Fizika_2024.pdf (uzbmb.uz, 2024 test details)
 */

export type TaskType = "Y1" | "Y2" | "O1" | "O" | "O2";

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  Y1: "Yopiq test — bitta to‘g‘ri javob",
  Y2: "Moslashtirish topshirig‘i",
  O1: "Ochiq test — qisqa javob",
  O: "Ochiq test — qisqa javob",
  O2: "Yozma ish — kengaytirilgan javob",
};

export interface FormatSection {
  id: string;
  title: string;
  from: number;
  to: number;
  /** Minutes allotted to this stage. */
  minutes: number;
}

export interface TaskGroup {
  type: TaskType;
  from: number;
  to: number;
}

export interface O2TaskSpec {
  number: number;
  maxScore: number;
}

export type Y2Scoring = "per_pair" | "all_or_nothing";

export interface ExamFormat {
  id: string;
  subjectCode: string;
  subjectName: string;
  version: string;
  label: string;
  effectiveDate: string; // YYYY-MM-DD
  sourceUrl: string;
  sourceTitle: string;
  totalTasks: number;
  totalMinutes: number;
  sections: FormatSection[];
  taskGroups: TaskGroup[];
  y1OptionCount: number;
  y2Scoring: Y2Scoring;
  /** Whether the Y2 scoring rule has been confirmed by an admin against the official source. */
  y2ScoringConfirmed: boolean;
  o2Tasks: O2TaskSpec[];
  topics: string[];
  /** What the official specification says about the assessment model for Y1/Y2/O1. */
  assessmentNote: string;
  /** Calibrated Rasch parameter set id. null = not available → raw results only. */
  raschParameterSetId: string | null;
  /** Sections move on automatically when their time is up. */
  autoAdvanceSections: boolean;
  status: "active" | "archived";
  createdAt?: number;
  updatedAt?: number;
}

export interface SubjectInfo {
  code: string;
  name: string;
  description: string;
  order: number;
  activeFormatId: string;
  archived: boolean;
}

const BIO_TOPICS = [
  "Biologiya — hayot haqidagi fan. Tirik organizmlar xilma-xilligi",
  "Hujayra, molekula va to‘qima darajasi",
  "Organ va organizm darajasi",
  "Tur va populyatsiya darajasi",
  "Ekotizim, biosfera va filogenez",
  "Umumbiologik qonuniyatlarga oid masalalar",
];

const CHEM_TOPICS = ["Umumiy kimyo", "Anorganik kimyo", "Organik kimyo", "Kimyoviy tahlil"];

const MATH_TOPICS = [
  "Sonlar va amallar",
  "Algebraik ifodalarni shakl almashtirish",
  "Tenglamalar va tengsizliklar",
  "Funksiyalar",
  "Matematik analiz asoslari",
  "Geometriya",
  "To‘plamlar, mantiq, ma’lumotlar tahlili, kombinatorika, ehtimollar nazariyasi va matematik modellashtirish",
];

const PHYS_TOPICS = [
  "Mexanika",
  "Molekulyar fizika va termodinamika",
  "Elektr va magnetizm",
  "Optika va nisbiylik nazariyasi asoslari",
  "Kvant fizikasi, atom va yadro fizikasi",
];

const RASCH_2025_NOTE =
  "Rasmiy 2025-yil spetsifikatsiyasiga ko‘ra Y1, Y2 va O1 topshiriqlari Rasch modeli asosida baholanadi. Kalibrlangan parametrlar mavjud bo‘lmaguncha platforma faqat xom natijani ko‘rsatadi.";
const RASCH_UNKNOWN_NOTE =
  "Ushbu fan uchun amaldagi baholash mezonlarini rasmiy manbadan tekshirib, konfiguratsiyaga kiriting. Kalibrlangan parametrlar mavjud bo‘lmaguncha faqat xom natija ko‘rsatiladi.";

export const DEFAULT_FORMATS: ExamFormat[] = [
  {
    id: "biologiya-2025",
    subjectCode: "biologiya",
    subjectName: "Biologiya",
    version: "2025",
    label: "Biologiya · MS-2025 spetsifikatsiyasi",
    effectiveDate: "2025-01-01",
    sourceUrl: "https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Biologiya-MS2025.pdf",
    sourceTitle: "Biologiya-MS2025.pdf (BMBA)",
    totalTasks: 43,
    totalMinutes: 180,
    sections: [
      { id: "test", title: "1-bosqich: test topshiriqlari", from: 1, to: 40, minutes: 100 },
      { id: "yozma", title: "2-bosqich: yozma ish", from: 41, to: 43, minutes: 80 },
    ],
    taskGroups: [
      { type: "Y1", from: 1, to: 32 },
      { type: "Y2", from: 33, to: 35 },
      { type: "O1", from: 36, to: 40 },
      { type: "O2", from: 41, to: 43 },
    ],
    y1OptionCount: 4,
    y2Scoring: "per_pair",
    y2ScoringConfirmed: false,
    o2Tasks: [
      { number: 41, maxScore: 30 },
      { number: 42, maxScore: 35 },
      { number: 43, maxScore: 10 },
    ],
    topics: BIO_TOPICS,
    assessmentNote: RASCH_2025_NOTE,
    raschParameterSetId: null,
    autoAdvanceSections: true,
    status: "active",
  },
  {
    id: "kimyo-2025",
    subjectCode: "kimyo",
    subjectName: "Kimyo",
    version: "2025",
    label: "Kimyo · MS-2025 spetsifikatsiyasi",
    effectiveDate: "2025-01-01",
    sourceUrl: "https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Kimyo-MS2025.pdf",
    sourceTitle: "Kimyo-MS2025.pdf (BMBA)",
    totalTasks: 43,
    totalMinutes: 180,
    sections: [
      { id: "test", title: "1-bosqich: test topshiriqlari", from: 1, to: 40, minutes: 100 },
      { id: "yozma", title: "2-bosqich: yozma ish", from: 41, to: 43, minutes: 80 },
    ],
    taskGroups: [
      { type: "Y1", from: 1, to: 32 },
      { type: "Y2", from: 33, to: 35 },
      { type: "O1", from: 36, to: 40 },
      { type: "O2", from: 41, to: 43 },
    ],
    y1OptionCount: 4,
    y2Scoring: "per_pair",
    y2ScoringConfirmed: false,
    o2Tasks: [
      { number: 41, maxScore: 25 },
      { number: 42, maxScore: 25 },
      { number: 43, maxScore: 25 },
    ],
    topics: CHEM_TOPICS,
    assessmentNote: RASCH_2025_NOTE,
    raschParameterSetId: null,
    autoAdvanceSections: true,
    status: "active",
  },
  {
    id: "matematika-2024",
    subjectCode: "matematika",
    subjectName: "Matematika",
    version: "2024",
    label: "Matematika · 2024 test tafsilotlari",
    effectiveDate: "2024-01-01",
    sourceUrl: "https://uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Matematika_2024.pdf",
    sourceTitle: "Matematika_2024.pdf (BMBA)",
    totalTasks: 45,
    totalMinutes: 150,
    sections: [{ id: "test", title: "Test topshiriqlari", from: 1, to: 45, minutes: 150 }],
    taskGroups: [
      { type: "Y1", from: 1, to: 32 },
      { type: "Y2", from: 33, to: 35 },
      { type: "O", from: 36, to: 45 },
    ],
    y1OptionCount: 4,
    y2Scoring: "per_pair",
    y2ScoringConfirmed: false,
    o2Tasks: [],
    topics: MATH_TOPICS,
    assessmentNote: RASCH_UNKNOWN_NOTE,
    raschParameterSetId: null,
    autoAdvanceSections: true,
    status: "active",
  },
  {
    id: "fizika-2024",
    subjectCode: "fizika",
    subjectName: "Fizika",
    version: "2024",
    label: "Fizika · 2024 test tafsilotlari",
    effectiveDate: "2024-01-01",
    sourceUrl: "https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Fizika_2024.pdf",
    sourceTitle: "Fizika_2024.pdf (BMBA)",
    totalTasks: 45,
    totalMinutes: 150,
    sections: [{ id: "test", title: "Test topshiriqlari", from: 1, to: 45, minutes: 150 }],
    taskGroups: [
      { type: "Y1", from: 1, to: 32 },
      { type: "Y2", from: 33, to: 35 },
      { type: "O", from: 36, to: 45 },
    ],
    y1OptionCount: 4,
    y2Scoring: "per_pair",
    y2ScoringConfirmed: false,
    o2Tasks: [],
    topics: PHYS_TOPICS,
    assessmentNote: RASCH_UNKNOWN_NOTE,
    raschParameterSetId: null,
    autoAdvanceSections: true,
    status: "active",
  },
];

export const DEFAULT_SUBJECTS: SubjectInfo[] = [
  {
    code: "biologiya",
    name: "Biologiya",
    description: "Hujayradan biosferagacha: 40 ta test topshirig‘i va 3 ta yozma ish, ikki bosqichda.",
    order: 1,
    activeFormatId: "biologiya-2025",
    archived: false,
  },
  {
    code: "kimyo",
    name: "Kimyo",
    description: "Umumiy, anorganik, organik kimyo va kimyoviy tahlil: test hamda 3 ta yozma masala.",
    order: 2,
    activeFormatId: "kimyo-2025",
    archived: false,
  },
  {
    code: "matematika",
    name: "Matematika",
    description: "Sonlardan matematik modellashtirishgacha: 45 ta topshiriq, 150 daqiqa.",
    order: 3,
    activeFormatId: "matematika-2024",
    archived: false,
  },
  {
    code: "fizika",
    name: "Fizika",
    description: "Mexanikadan yadro fizikasigacha: 45 ta topshiriq, 150 daqiqa.",
    order: 4,
    activeFormatId: "fizika-2024",
    archived: false,
  },
];

/** Grade boundaries — informational, from Cabinet of Ministers Resolution No. 646 (current version on lex.uz). */
export const DEFAULT_GRADE_BOUNDARIES = {
  source: "Vazirlar Mahkamasining 646-son qarori (lex.uz, amaldagi tahrir)",
  sourceUrl: "https://lex.uz/acts/-5044726",
  levels: [
    { level: "A+", rule: "70 balldan yuqori" },
    { level: "A", rule: "65 — 69,9 ball" },
    { level: "B+", rule: "60 — 64,9 ball" },
    { level: "B", rule: "55 — 59,9 ball" },
    { level: "C+", rule: "50 — 54,9 ball" },
    { level: "C", rule: "46 — 49,9 ball" },
  ],
  note: "Rasmiy matnda aynan 70,0 ball qaysi darajaga tegishli ekani aniq ko‘rsatilmagan — chegara aniqlashtirishni talab qiladi.",
};

/* ------------------------------------------------------------------ helpers */

export function taskTypeOf(format: Pick<ExamFormat, "taskGroups">, n: number): TaskType | null {
  for (const g of format.taskGroups) if (n >= g.from && n <= g.to) return g.type;
  return null;
}

export function sectionIndexOf(format: Pick<ExamFormat, "sections">, n: number): number {
  return format.sections.findIndex((s) => n >= s.from && n <= s.to);
}

export function o2MaxFor(format: Pick<ExamFormat, "o2Tasks">, n: number): number {
  return format.o2Tasks.find((t) => t.number === n)?.maxScore ?? 0;
}

export function isOpenShort(t: TaskType | null): boolean {
  return t === "O1" || t === "O";
}

export function formatIncludes(format: Pick<ExamFormat, "taskGroups">, t: TaskType): boolean {
  return format.taskGroups.some((g) => g.type === t);
}

/** Validates internal consistency of a format. Returns a list of human-readable problems. */
export function validateFormat(f: ExamFormat): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9-]+$/.test(f.id)) errs.push("Format ID faqat kichik lotin harflari, raqam va '-' dan iborat bo‘lishi kerak.");
  if (f.totalTasks < 1 || f.totalTasks > 200) errs.push("Topshiriqlar soni 1–200 oralig‘ida bo‘lishi kerak.");
  const covered = new Array(f.totalTasks + 1).fill(0);
  for (const g of f.taskGroups) {
    if (g.from < 1 || g.to > f.totalTasks || g.from > g.to) errs.push(`Topshiriq guruhi ${g.type} ${g.from}–${g.to} noto‘g‘ri.`);
    else for (let i = g.from; i <= g.to; i++) covered[i]++;
  }
  for (let i = 1; i <= f.totalTasks; i++) if (covered[i] !== 1) errs.push(`${i}-topshiriq turi aniq bitta guruhga tegishli bo‘lishi kerak.`);
  const sc = new Array(f.totalTasks + 1).fill(0);
  for (const s of f.sections) {
    if (s.minutes <= 0) errs.push(`"${s.title}" bosqichi vaqti musbat bo‘lishi kerak.`);
    if (s.from < 1 || s.to > f.totalTasks || s.from > s.to) errs.push(`"${s.title}" bosqichi chegaralari noto‘g‘ri.`);
    else for (let i = s.from; i <= s.to; i++) sc[i]++;
  }
  for (let i = 1; i <= f.totalTasks; i++) if (sc[i] !== 1) errs.push(`${i}-topshiriq aniq bitta bosqichga tegishli bo‘lishi kerak.`);
  for (let i = 1; i < f.sections.length; i++)
    if (f.sections[i].from !== f.sections[i - 1].to + 1) errs.push("Bosqichlar ketma-ket bo‘lishi kerak.");
  const sumMin = f.sections.reduce((a, s) => a + s.minutes, 0);
  if (sumMin !== f.totalMinutes) errs.push(`Bosqichlar vaqti yig‘indisi (${sumMin}) umumiy vaqtga (${f.totalMinutes}) teng emas.`);
  const o2Numbers = f.taskGroups.filter((g) => g.type === "O2").flatMap((g) => range(g.from, g.to));
  for (const n of o2Numbers) if (!f.o2Tasks.some((t) => t.number === n && t.maxScore > 0)) errs.push(`${n}-yozma topshiriq uchun maksimal ball kiritilmagan.`);
  for (const t of f.o2Tasks) if (!o2Numbers.includes(t.number)) errs.push(`${t.number} raqami O2 guruhida emas.`);
  if (f.y1OptionCount < 2 || f.y1OptionCount > 8) errs.push("Y1 variantlar soni 2–8 oralig‘ida bo‘lishi kerak.");
  return errs;
}

/**
 * Derives a practice/diagnostic format from an official one: only tasks `from..to`
 * (official numbering is kept so it matches the booklet), one section, own timer.
 */
export function deriveFormat(base: ExamFormat, from: number, to: number, minutes: number | null, kind: "practice" | "diagnostic"): ExamFormat {
  const groups = base.taskGroups
    .map((g) => ({ ...g, from: Math.max(g.from, from), to: Math.min(g.to, to) }))
    .filter((g) => g.from <= g.to);
  const name = kind === "practice" ? "Mavzu bo‘yicha mashq" : "Qisqa diagnostika";
  return {
    ...base,
    label: `${base.label} · ${name} (${from}–${to})`,
    totalTasks: to - from + 1,
    totalMinutes: minutes ?? 0,
    sections: [{ id: kind, title: `${name}: ${from}–${to}-topshiriqlar`, from, to, minutes: minutes ?? 0 }],
    taskGroups: groups,
    o2Tasks: base.o2Tasks.filter((t) => t.number >= from && t.number <= to),
  };
}

/** All task numbers of a (possibly derived) format, in order. */
export function taskNumbers(format: Pick<ExamFormat, "taskGroups">): number[] {
  return format.taskGroups
    .flatMap((g) => range(g.from, g.to))
    .sort((a, b) => a - b);
}

export function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
