import { requireAdmin } from "@/lib/server/admin-session";
import { ok, route } from "@/lib/server/http";
import { listPayments } from "@/lib/server/payments";
import { T, must, sb } from "@/lib/server/supabase";

type CountRes = PromiseLike<{ count: number | null; error: { message: string } | null }>;
const count = async (q: CountRes) => {
  const r = await q;
  must({ data: null, error: r.error }, "overview count");
  return r.count ?? 0;
};

/**
 * Platform-wide activity of the learning / social modules (last 7 days) and the
 * "needs attention" queues — every number is counted live in the database, in parallel.
 */
export const GET = route(async () => {
  await requireAdmin();
  const head = { count: "exact" as const, head: true };
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    pendingReview,
    payments,
    openReports,
    flagged,
    draftMaterials,
    challengeAttempts,
    battles,
    activeRooms,
    roomMessages,
    cardReviews,
    videosDone,
    threads,
    certificates,
    telegram,
    mistakesOpen,
    practice,
    plans,
  ] = await Promise.all([
    count(sb().from(T.attempts).select("id", head).eq("status", "pending_review")),
    listPayments(),
    count(sb().from("discussion_reports").select("id", head).eq("status", "open")),
    count(sb().from("challenge_attempts").select("id", head).eq("flagged", true).gte("started_at", since)),
    count(sb().from(T.materials).select("id", head).eq("status", "draft")),
    count(sb().from("challenge_attempts").select("id", head).neq("status", "in_progress").gte("started_at", since)),
    count(sb().from("battles").select("id", head).eq("status", "finished").gte("created_at", since)),
    count(sb().from("study_rooms").select("id", head).eq("status", "active")),
    count(sb().from("study_room_messages").select("id", head).gte("created_at", since)),
    count(sb().from("flashcard_reviews").select("card_id", head).gte("reviewed_at", since)),
    count(sb().from("video_progress").select("video_id", head).eq("completed", true).gte("updated_at", since)),
    count(sb().from("discussions").select("id", head).gte("created_at", since)),
    count(sb().from("certificates").select("id", head).eq("status", "valid")),
    count(sb().from("telegram_links").select("user_id", head)),
    count(sb().from("student_mistakes").select("id", head).neq("status", "resolved")),
    count(sb().from("answer_events").select("question_id", head).like("source", "review:%").gte("at", since)),
    count(sb().from("study_plans").select("id", head).eq("status", "active")),
  ]);
  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  return ok({
    attention: [
      { key: "review", label: "Yozma ish / shubhali javob tekshiruvi", count: pendingReview, href: "/admin/natijalar" },
      { key: "payments", label: "Tasdiq kutayotgan to‘lovlar", count: pendingPayments, href: "/admin/tolovlar" },
      { key: "reports", label: "Muhokamalardagi ochiq shikoyatlar", count: openReports, href: "/admin/muhokamalar" },
      { key: "flagged", label: "Shubhali tez challenge urinishlari (7 kun)", count: flagged, href: "/admin/challenge" },
      { key: "drafts", label: "E’lon qilinmagan qoralama testlar", count: draftMaterials, href: "/admin/materiallar" },
    ],
    week: {
      challengeAttempts,
      battles,
      roomMessages,
      cardReviews,
      videosDone,
      threads,
      practice,
    },
    totals: { activeRooms, certificates, telegram, mistakesOpen, plans },
  });
});
