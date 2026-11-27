import "server-only";
import type { PaymentRecord, PaymentStatus } from "@/lib/types";
import { ApiError } from "./http";
import { T, must, sb } from "./supabase";

/*
 * Paid-test access. Every request and every decision is an append-only audit-log entry
 * ("payment.request" / "payment.approved" / "payment.rejected"); the newest entry for a
 * (candidate, material) pair is its current state. Append-only means two writers can never
 * overwrite each other, and the full payment history is kept.
 */
const ACTIONS = ["payment.request", "payment.approved", "payment.rejected"] as const;
const STATUS: Record<(typeof ACTIONS)[number], PaymentStatus> = {
  "payment.request": "pending",
  "payment.approved": "approved",
  "payment.rejected": "rejected",
};

interface Row {
  at: string;
  actor: string;
  action: (typeof ACTIONS)[number];
  details: Omit<PaymentRecord, "status" | "requestedAt" | "decidedAt" | "decidedBy">;
}

function reduce(rows: Row[]): PaymentRecord[] {
  // rows are oldest → newest
  const by = new Map<string, PaymentRecord>();
  for (const r of rows) {
    const k = `${r.details.uid}:${r.details.materialId}`;
    const t = Date.parse(r.at);
    const prev = by.get(k);
    if (r.action === "payment.request") {
      by.set(k, { ...r.details, status: "pending", requestedAt: t });
    } else if (prev) {
      by.set(k, { ...prev, status: STATUS[r.action], decidedAt: t, decidedBy: r.actor === "agent" ? "agent" : "admin" });
    }
  }
  return [...by.values()];
}

async function rows(filter: { uid?: string; materialId?: string; limit?: number }): Promise<Row[]> {
  let q = sb().from(T.audit).select("at, actor, action, details").in("action", ACTIONS as unknown as string[]);
  if (filter.uid) q = q.eq("details->>uid", filter.uid);
  if (filter.materialId) q = q.eq("details->>materialId", filter.materialId);
  const data = must(await q.order("at", { ascending: false }).limit(filter.limit ?? 2000), "payments");
  return ((data ?? []) as Row[]).reverse();
}

export async function paymentOf(uid: string, materialId: string): Promise<PaymentRecord | null> {
  return reduce(await rows({ uid, materialId, limit: 50 }))[0] ?? null;
}

export async function listPayments(): Promise<PaymentRecord[]> {
  return reduce(await rows({})).sort((a, b) => (b.decidedAt ?? b.requestedAt) - (a.decidedAt ?? a.requestedAt));
}

async function append(action: Row["action"], actor: string, details: Row["details"]): Promise<void> {
  const { error } = await sb()
    .from(T.audit)
    .insert({ actor, action, target: `payments/${details.uid}/${details.materialId}`, details });
  if (error) {
    console.error("[payment] write failed", error);
    throw new ApiError(500, "db_error", "To‘lov ma’lumotini saqlab bo‘lmadi.");
  }
}

export async function requestPayment(d: Row["details"]): Promise<void> {
  await append("payment.request", `candidate:${d.candidateId}`, d);
}

export async function decidePayment(uid: string, materialId: string, decision: "approved" | "rejected", actor: "admin" | "agent"): Promise<PaymentRecord> {
  const cur = await paymentOf(uid, materialId);
  if (!cur) throw new ApiError(404, "not_found", "To‘lov so‘rovi topilmadi.");
  const details: Row["details"] = {
    uid: cur.uid,
    materialId: cur.materialId,
    candidateId: cur.candidateId,
    candidateName: cur.candidateName,
    amount: cur.amount,
    materialTitle: cur.materialTitle,
    note: cur.note,
  };
  await append(decision === "approved" ? "payment.approved" : "payment.rejected", actor, details);
  return { ...cur, status: decision, decidedAt: Date.now(), decidedBy: actor };
}
