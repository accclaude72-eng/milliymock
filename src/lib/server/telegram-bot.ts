import "server-only";
import { randomBytes } from "node:crypto";
import { makeToken, uzDate } from "@/lib/certificate";
import { verifyUrl } from "./certificates";
import { ensureTodayChallenge } from "./challenges";
import { siteBase } from "./notifications";
import { todayUz } from "./plans";
import { attemptsOf } from "./repo";
import { must, sb } from "./supabase";
import { botUsername, plain, sendTelegramTo } from "./telegram";

const LINK_TTL_MS = 15 * 60_000;

export const COMMANDS = [
  { command: "natija", description: "Oxirgi natijalarim" },
  { command: "challenge", description: "Bugungi challenge" },
  { command: "reja", description: "Bugungi o‘quv reja" },
  { command: "xatolar", description: "Takrorlash vaqti kelgan xatolar" },
  { command: "xp", description: "XP va streak" },
  { command: "sertifikat", description: "Sertifikatlarim" },
  { command: "sozlamalar", description: "Bildirishnoma sozlamalari" },
  { command: "uzish", description: "Hisobni botdan uzish" },
  { command: "yordam", description: "Buyruqlar ro‘yxati" },
];

/** One-time deep link: t.me/<bot>?start=<code> (valid 15 minutes). */
export async function createLinkCode(uid: string): Promise<{ url: string | null; code: string; expiresAt: number }> {
  // Old unused codes of this student are dropped — only the newest link works.
  must(await sb().from("telegram_link_codes").delete().eq("user_id", uid).is("used_at", null), "drop old codes");
  const code = makeToken(24, randomBytes(24));
  const expiresAt = Date.now() + LINK_TTL_MS;
  must(
    await sb()
      .from("telegram_link_codes")
      .insert({ code, user_id: uid, expires_at: new Date(expiresAt).toISOString() }),
    "link code",
  );
  const bot = await botUsername();
  return { url: bot ? `https://t.me/${bot}?start=${code}` : null, code, expiresAt };
}

interface Update {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string }; from?: { username?: string; is_bot?: boolean } };
}

const HELP =
  "Men Milliy Mock botiman. Buyruqlar:\n" + COMMANDS.map((c) => `/${c.command} — ${c.description}`).join("\n") + "\n\nHisobni ulash uchun saytda: Kabinet → Bildirishnomalar → “Telegramni ulash”.";

async function uidOf(chatId: number): Promise<string | null> {
  const r = must(await sb().from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle(), "uid by chat");
  return (r?.user_id as string | undefined) ?? null;
}

async function link(code: string, chatId: number, username: string | undefined): Promise<string> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(code)) return "Havola noto‘g‘ri. Saytdan yangi havola oling.";
  // Claim the code atomically: only an unused, unexpired code can be taken, and only once.
  const claimed = must(
    await sb().from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code).is("used_at", null).gt("expires_at", new Date().toISOString()).select("user_id"),
    "claim code",
  ) as { user_id: string }[] | null;
  if (!claimed?.length) return "Havola eskirgan yoki ishlatilgan. Saytda “Telegramni ulash” tugmasini qayta bosing.";
  const uid = claimed[0].user_id;
  // One chat = one account: a chat linked to someone else is moved to this account.
  must(await sb().from("telegram_links").delete().eq("chat_id", chatId).neq("user_id", uid), "move chat");
  must(
    await sb()
      .from("telegram_links")
      .upsert({ user_id: uid, chat_id: chatId, username: username?.slice(0, 64) ?? null, linked_at: new Date().toISOString() }, { onConflict: "user_id" }),
    "save link",
  );
  return "✅ Hisobingiz ulandi! Endi natijalar, challenge eslatmalari va battle takliflari shu yerga keladi.\n\n" + HELP;
}

async function results(uid: string): Promise<string> {
  const list = (await attemptsOf({ uid })).filter((a) => a.status === "published" && a.grading?.summary).slice(0, 5);
  if (!list.length) return "Hali e’lon qilingan natija yo‘q.";
  return (
    "📊 <b>Oxirgi natijalar</b>\n" +
    list
      .map(
        (a) =>
          `• ${plain(a.materialTitle)} — <b>${a.grading!.summary.score}/${a.grading!.summary.max}</b> (${Math.round(a.grading!.summary.percent * 10) / 10}%), ${uzDate(a.publishedAt ?? a.createdAt)}`,
      )
      .join("\n")
  );
}

async function challenge(uid: string): Promise<string> {
  await ensureTodayChallenge().catch(() => undefined);
  const day = todayUz();
  const list = (must(await sb().from("daily_challenges").select("id, title, question_ids, time_limit_sec").eq("day", day).eq("status", "published"), "tg challenges") ?? []) as {
    id: string;
    title: string;
    question_ids: string[];
    time_limit_sec: number;
  }[];
  if (!list.length) return "Bugun challenge yo‘q.";
  const done = new Set(
    (
      (must(
        await sb()
          .from("challenge_attempts")
          .select("challenge_id")
          .eq("user_id", uid)
          .in(
            "challenge_id",
            list.map((c) => c.id),
          )
          .neq("status", "in_progress"),
        "tg done",
      ) ?? []) as { challenge_id: string }[]
    ).map((r) => r.challenge_id),
  );
  return (
    "⚡ <b>Bugungi challenge</b>\n" +
    list.map((c) => `• ${plain(c.title)} — ${c.question_ids.length} savol, ${Math.round(c.time_limit_sec / 60)} daq ${done.has(c.id) ? "✅ topshirilgan" : ""}`).join("\n")
  );
}

async function plan(uid: string): Promise<string> {
  const tasks = (must(await sb().from("study_plan_tasks").select("title, minutes, status").eq("user_id", uid).eq("day", todayUz()).order("id"), "tg tasks") ?? []) as {
    title: string;
    minutes: number | null;
    status: string;
  }[];
  if (!tasks.length) return "Bugun rejada vazifa yo‘q. Reja tuzish: Kabinet → O‘quv reja.";
  return "▦ <b>Bugungi reja</b>\n" + tasks.map((t) => `${t.status === "done" ? "✅" : "▫️"} ${plain(t.title)}${t.minutes ? ` (${t.minutes} daq)` : ""}`).join("\n");
}

async function mistakes(uid: string): Promise<string> {
  const { count } = await sb().from("student_mistakes").select("id", { count: "exact", head: true }).eq("user_id", uid).neq("status", "resolved").lte("next_review_at", new Date().toISOString());
  return count ? `✎ Takrorlash vaqti kelgan xatolar: <b>${count}</b> ta.` : "✎ Hozir takrorlanadigan xato yo‘q. Zo‘r!";
}

async function xp(uid: string): Promise<string> {
  const rows = (must(await sb().from("xp_ledger").select("amount, created_at").eq("user_id", uid).limit(10000), "tg xp") ?? []) as { amount: number; created_at: string }[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const week = rows.filter((r) => Date.parse(r.created_at) > Date.now() - 7 * 86_400_000).reduce((s, r) => s + Number(r.amount), 0);
  return `🏆 Jami XP: <b>${total}</b>\nShu hafta: +${week}`;
}

async function certificates(uid: string): Promise<{ text: string; buttons: { text: string; url: string }[] }> {
  const list = (must(await sb().from("certificates").select("serial, verify_code, material_title, percent, status").eq("user_id", uid).order("issued_at", { ascending: false }).limit(5), "tg certs") ??
    []) as {
    serial: string;
    verify_code: string;
    material_title: string;
    percent: number;
    status: string;
  }[];
  if (!list.length) return { text: "Hali sertifikat yo‘q. To‘liq mock natijasi e’lon qilingach, Kabinet → Sertifikatlar bo‘limida olishingiz mumkin.", buttons: [] };
  return {
    text: "🎓 <b>Sertifikatlar</b>\n" + list.map((c) => `• ${c.serial} — ${plain(c.material_title)}, ${Number(c.percent)}%${c.status === "revoked" ? " (bekor qilingan)" : ""}`).join("\n"),
    buttons: list.slice(0, 3).map((c) => ({ text: `Tekshirish: ${c.serial}`, url: verifyUrl(c.verify_code) })),
  };
}

/** Handles one webhook update. Only private chats; untrusted text is never echoed unescaped. */
export async function handleUpdate(u: Update): Promise<void> {
  const m = u.message;
  if (!m?.text || m.chat.type !== "private" || m.from?.is_bot) return;
  const chatId = m.chat.id;
  const [cmdRaw, arg] = m.text.trim().split(/\s+/, 2);
  const cmd = cmdRaw.toLowerCase().replace(/@.*$/, "");
  const reply = (text: string, buttons?: { text: string; url: string }[]) => sendTelegramTo(chatId, text, buttons);
  const base = siteBase();

  if (cmd === "/start") {
    if (arg) return void (await reply(await link(arg, chatId, m.from?.username)));
    const linked = await uidOf(chatId);
    return void (await reply(linked ? HELP : `Assalomu alaykum! ${HELP}`, base ? [{ text: "Saytni ochish", url: `${base}/kabinet/bildirishnomalar` }] : undefined));
  }
  if (cmd === "/yordam" || cmd === "/help") return void (await reply(HELP));

  const uid = await uidOf(chatId);
  if (!uid)
    return void (await reply("Avval hisobingizni ulang: saytda Kabinet → Bildirishnomalar → “Telegramni ulash”.", base ? [{ text: "Ulash", url: `${base}/kabinet/bildirishnomalar` }] : undefined));

  switch (cmd) {
    case "/natija":
      return void (await reply(await results(uid), base ? [{ text: "Kabinet", url: `${base}/kabinet` }] : undefined));
    case "/challenge":
      return void (await reply(await challenge(uid), base ? [{ text: "Challenge’ni ochish", url: `${base}/challenge` }] : undefined));
    case "/reja":
      return void (await reply(await plan(uid), base ? [{ text: "Rejani ochish", url: `${base}/kabinet/reja` }] : undefined));
    case "/xatolar":
      return void (await reply(await mistakes(uid), base ? [{ text: "Mashq qilish", url: `${base}/kabinet/mashq?mode=mistakes&due=1&count=20` }] : undefined));
    case "/xp":
      return void (await reply(await xp(uid), base ? [{ text: "Reyting", url: `${base}/reyting` }] : undefined));
    case "/sertifikat": {
      const c = await certificates(uid);
      return void (await reply(c.text, c.buttons));
    }
    case "/sozlamalar":
      return void (await reply("Qaysi xabarlar kelishini saytda sozlaysiz.", base ? [{ text: "Sozlamalar", url: `${base}/kabinet/bildirishnomalar` }] : undefined));
    case "/uzish":
      must(await sb().from("telegram_links").delete().eq("chat_id", chatId), "unlink");
      return void (await reply("Hisobingiz botdan uzildi. Endi xabarlar kelmaydi."));
    default:
      return void (await reply(HELP));
  }
}

/** Morning digest for one student (challenge, plan, mistakes) — respects their settings. */
export async function morningDigest(uid: string, prefs: { daily_challenge: boolean; plan_reminders: boolean; mistakes_due: boolean }): Promise<string | null> {
  const parts: string[] = [];
  if (prefs.daily_challenge) {
    const c = await challenge(uid);
    if (!c.includes("✅") && !c.startsWith("Bugun challenge yo‘q")) parts.push(c);
  }
  if (prefs.plan_reminders) {
    const p = await plan(uid);
    if (!p.startsWith("Bugun rejada")) parts.push(p);
  }
  if (prefs.mistakes_due) {
    const x = await mistakes(uid);
    if (x.includes("<b>")) parts.push(x);
  }
  return parts.length ? `☀️ <b>Xayrli tong!</b>\n\n${parts.join("\n\n")}` : null;
}
