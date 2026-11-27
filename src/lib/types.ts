import type { ExamFormat, SubjectInfo, TaskType } from "./formats";
import type { AnswerKey, Answers, O2TaskReview, QuestionResult, RawSummary } from "./grading";
import type { TimingState } from "./timing";

export type AttemptStatus = "in_progress" | "submitted" | "auto_graded" | "pending_review" | "graded" | "published";

export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  in_progress: "Jarayonda",
  submitted: "Topshirildi",
  auto_graded: "Avtomatik tekshirildi",
  pending_review: "Ekspert tekshiruvida",
  graded: "Baholandi",
  published: "Natija e’lon qilindi",
};

export interface Profile {
  uid: string;
  candidateId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  region?: string;
  institution?: string;
  grade?: string;
  status: "active" | "suspended";
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
}

export type PaymentStatus = "pending" | "approved" | "rejected";

export interface PaymentRecord {
  uid: string;
  materialId: string;
  candidateId: string;
  candidateName: string;
  status: PaymentStatus;
  /** Price (so‘m) at the time of the request. */
  amount: number;
  materialTitle: string;
  /** What the candidate wrote (payer name, last card digits, time of transfer…). */
  note: string;
  requestedAt: number;
  decidedAt?: number;
  decidedBy?: "admin" | "agent";
}

/** Card details candidates transfer money to (public by nature — shown on paid tests). */
export interface PaymentSettings {
  cardNumber: string;
  cardHolder: string;
  instructions: string;
}

export interface MaterialStructure {
  y1Options: number;
  /** Per-task Y1 option counts overriding y1Options (copied from the format). */
  y1ByTask?: Record<string, number>;
  /** Y2 layout per task number: number of left items and right options. */
  y2: Record<string, { left: number; right: number }>;
}

export interface MaterialHtml {
  path: string;
  fileName: string;
  size: number;
  uploadedAt: number;
  inlinedImages: number;
  warnings: string[];
}

export type MaterialMode = "full" | "practice" | "diagnostic";

export const MODE_LABEL: Record<MaterialMode, string> = {
  full: "To‘liq mock",
  practice: "Mavzu bo‘yicha mashq",
  diagnostic: "Qisqa diagnostika",
};

export interface Material {
  id: string;
  title: string;
  description: string;
  subjectCode: string;
  subjectName: string;
  formatId: string;
  format: ExamFormat;
  mode: MaterialMode;
  timed: boolean;
  /** For practice/diagnostic: the official task range covered. null = whole format. */
  range: { from: number; to: number } | null;
  status: "draft" | "published" | "archived";
  html: MaterialHtml | null;
  structure: MaterialStructure;
  keyStatus: { complete: boolean; problems: string[] };
  revealAnswers: boolean;
  attemptLimit: number | null;
  /** Price in so‘m. null/0 = free. */
  price?: number | null;
  attemptsCount: number;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface MaterialKeyDoc {
  items: AnswerKey;
  updatedAt: number;
}

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  contentType: string;
  path: string;
  uploadedAt: number;
}

export interface O2ReviewRecord extends O2TaskReview {
  total: number;
  reviewedAt: number;
}

export interface Attempt {
  id: string;
  uid: string;
  candidateId: string;
  candidateName: string;
  materialId: string;
  materialTitle: string;
  /** Storage path of the booklet HTML at the time the attempt started (snapshot). */
  bookletPath: string;
  subjectCode: string;
  subjectName: string;
  format: ExamFormat;
  structure: MaterialStructure;
  mode: MaterialMode;
  timed: boolean;
  status: AttemptStatus;
  statusHistory: { status: AttemptStatus; at: number }[];
  timing: TimingState;
  answers: Answers;
  answeredAt: Record<string, number>;
  o2Files: Record<string, FileMeta[]>;
  client: { id: string; seenAt: number } | null;
  createdAt: number;
  submittedAt: number | null;
  finalizeReason: "manual" | "timeout" | null;
  grading: { questions: QuestionResult[]; summary: RawSummary } | null;
  o2Reviews: Record<string, O2ReviewRecord>;
  hasO2: boolean;
  publishedAt: number | null;
  rev: number;
}

/** Shape of the sanitized material sent to candidates (no key!). */
export interface PublicMaterial {
  id: string;
  title: string;
  description: string;
  subjectCode: string;
  subjectName: string;
  mode: MaterialMode;
  timed: boolean;
  format: ExamFormat;
  structure: MaterialStructure;
  attemptLimit: number | null;
  price: number | null;
  publishedAt: number | null;
}

export interface SubjectWithFormat extends SubjectInfo {
  format: ExamFormat | null;
  publishedMaterials: number;
}

export interface PublicFileMeta {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: number;
}

/** What the exam player receives from the server. Never contains keys. */
export interface PlayerViewT {
  id: string;
  status: AttemptStatus;
  materialId: string;
  materialTitle: string;
  subjectName: string;
  subjectCode: string;
  candidateId: string;
  candidateName: string;
  mode: MaterialMode;
  timed: boolean;
  format: ExamFormat;
  sheet: QuestionSheetItem[];
  timing: {
    index: number;
    finished: boolean;
    deadline: number | null;
    starts: (number | null)[];
    ends: (number | null)[];
    durationsMs: (number | null)[];
  };
  answers: Answers;
  o2Files: Record<string, PublicFileMeta[]>;
  rev: number;
  serverNow: number;
}

export interface QuestionSheetItem {
  n: number;
  type: TaskType;
  section: number;
  options?: number;
  left?: number;
  right?: number;
  o2Max?: number;
}
