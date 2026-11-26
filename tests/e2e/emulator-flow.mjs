// End-to-end flow against the Firebase Emulator Suite + a running dev server.
// Usage:  npm run emulators   (terminal 1)
//         npm run dev:emu     (terminal 2)
//         ADMIN_CODE=<code> BASE=http://localhost:3000 node tests/e2e/emulator-flow.mjs
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ADMIN_CODE = process.env.ADMIN_CODE;
if (!ADMIN_CODE) throw new Error("Set ADMIN_CODE env var");
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const STORAGE = "http://127.0.0.1:9199/v0/b/demo-milliy-mock.appspot.com/o";
const KEY = "demo-api-key";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const fsdb = getFirestore(initializeApp({ projectId: "demo-milliy-mock" }, "e2e"));

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra ?? "");
  }
}

let adminCookie = "";
async function call(path, { method = "GET", body, token, admin, origin = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (admin && adminCookie) headers.Cookie = adminCookie;
  if (origin) headers.Origin = BASE;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && setCookie.startsWith("mm_admin=")) adminCookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

async function signUp(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "parol12345", returnSecureToken: true }) });
  const j = await r.json();
  return { token: j.idToken, uid: j.localId };
}

async function upload(path, content, contentType, idToken) {
  const r = await fetch(`${STORAGE}?name=${encodeURIComponent(path)}`, { method: "POST", headers: { Authorization: `Firebase ${idToken}`, "Content-Type": contentType }, body: content });
  return r.status;
}

const BOOKLET = `<!DOCTYPE html><html><head><meta charset="windows-1251"><title>Biologiya mock 1</title></head><body>
${Array.from({ length: 43 }, (_, i) => `<p>${i + 1}. Savol matni ${i + 1}</p>`).join("\n")}
</body></html>`;

console.log(`\nE2E against ${BASE}\n`);

// ───────────────────────────────────────────────── health & seed
console.log("Health & seed");
const health = await call("/api/health");
check("health: firebase configured via emulators", health.json?.data?.firebase && health.json?.data?.emulators, health.json);
check("health: admin configured", health.json?.data?.admin === true);
const subjects = await call("/api/subjects");
check("4 subjects seeded", subjects.json?.data?.length === 4, subjects.json);
const bioFmt = subjects.json.data.find((s) => s.code === "biologiya").format;
check("biology format: 43 tasks / 180 min / O2 30+35+10", bioFmt.totalTasks === 43 && bioFmt.totalMinutes === 180 && bioFmt.o2Tasks.map((t) => t.maxScore).join() === "30,35,10");

// ───────────────────────────────────────────────── admin auth
console.log("Admin auth");
check("admin API without cookie → 401", (await call("/api/admin/stats")).status === 401);
const page = await fetch(BASE + "/admin", { redirect: "manual" });
check("/admin page without cookie redirects to /admin/kirish", page.status >= 300 && page.status < 400 && (page.headers.get("location") ?? "").includes("/admin/kirish"));
const bad = await call("/api/admin/login", { method: "POST", body: { code: "wrong-code" } });
check("wrong admin code → 401", bad.status === 401, bad.json);
const crossOrigin = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ code: ADMIN_CODE }) });
check("cross-origin admin login blocked → 403", crossOrigin.status === 403);
const good = await call("/api/admin/login", { method: "POST", body: { code: ADMIN_CODE } });
check("correct admin code → session cookie", good.status === 200 && adminCookie.startsWith("mm_admin="), good.json);
const cookieHeader = good.headers.get("set-cookie") ?? "";
check("admin cookie is HttpOnly + SameSite=Strict", /httponly/i.test(cookieHeader) && /samesite=strict/i.test(cookieHeader));
check("admin stats with cookie → 200", (await call("/api/admin/stats", { admin: true })).status === 200);

// ───────────────────────────────────────────────── HTML upload to Storage
console.log("Material upload");
const tok = await call("/api/admin/storage-token", { admin: true });
const signIn = await fetch(`${AUTH}/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok.json.data.token, returnSecureToken: true }) });
const adminUpToken = (await signIn.json()).idToken;
const htmlPath = `materials/e2e${Date.now()}abc/booklet.html`;
check("admin uploader can write HTML to materials/", (await upload(htmlPath, BOOKLET, "text/html; charset=utf-8", adminUpToken)) === 200);
check("admin uploader cannot write non-HTML", (await upload(`materials/x${Date.now()}yyyyy/a.html`, "x", "application/javascript", adminUpToken)) === 403);

const created = await call("/api/admin/materials", {
  method: "POST",
  admin: true,
  body: { title: "E2E Biologiya mock", description: "", subjectCode: "biologiya", mode: "full", timed: true, range: null, minutes: null, revealAnswers: true, attemptLimit: null, html: { path: htmlPath, fileName: "booklet.html", inlinedImages: 0, warnings: [] } },
});
check("draft material created", created.status === 201, created.json);
const matId = created.json.data.id;

const pubEarly = await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { status: "published" } });
check("publish with empty key is refused (409)", pubEarly.status === 409, pubEarly.json);

const key = {};
for (let n = 1; n <= 32; n++) key[n] = { type: "Y1", correct: "ABCD"[n % 4], topic: n <= 16 ? "Organ va organizm darajasi" : "Hujayra, molekula va toʻqima darajasi" };
for (const n of [33, 34, 35]) key[n] = { type: "Y2", left: 4, right: 6, pairs: ["A", "B", "C", "D"] };
for (const n of [36, 37, 38, 39, 40]) key[n] = { type: "O1", accepted: ["0,5"], tolerance: null };
key[41] = { type: "O2", criteria: [{ id: "m1", label: "Yechim usuli", component: "M", max: 20 }, { id: "a1", label: "Hisob-kitob", component: "A", max: 10 }] };
const saved = await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { key } });
check("key saved and validated complete", saved.status === 200 && saved.json.data.material.keyStatus.complete === true, saved.json?.data?.material?.keyStatus);
const pub = await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { status: "published" } });
check("material published", pub.status === 200 && pub.json.data.material.status === "published", pub.json);

// ───────────────────────────────────────────────── candidate
console.log("Candidate");
const c1 = await signUp(`e2e-${Date.now()}@example.com`);
check("candidate without profile → 409 profile_required", (await call("/api/me/attempts", { token: c1.token })).json?.error?.code === "profile_required");
const prof = await call("/api/me", { method: "POST", token: c1.token, body: { firstName: "Aziza", lastName: "Karimova", phone: "+998 90 123 45 67", region: "Toshkent shahri", institution: "", grade: "11-sinf" } });
check("profile created with Candidate ID", prof.status === 201 && /^MM-\d{2}-\d{6}$/.test(prof.json.data.profile.candidateId), prof.json);
const prof2 = await call("/api/me", { method: "POST", token: c1.token, body: { firstName: "Aziza", lastName: "Karimova" } });
check("profile creation is idempotent (same Candidate ID)", prof2.json?.data?.profile?.candidateId === prof.json.data.profile.candidateId);

const catalog = await call("/api/materials");
check("catalog lists the published material", catalog.json.data.some((m) => m.id === matId));
check("catalog never contains answer keys", !catalog.text.includes('"correct"') && !catalog.text.includes('"accepted"'));
const instr = await call(`/api/materials/${matId}`, { token: c1.token });
check("instructions: ready, no key", instr.json?.data?.ready === true && !instr.text.includes('"pairs"'));

const start = await call(`/api/materials/${matId}/start`, { method: "POST", token: c1.token });
check("attempt started", start.status === 201, start.json);
const attemptId = start.json.data.attemptId;
const again = await call(`/api/materials/${matId}/start`, { method: "POST", token: c1.token });
check("second start resumes the same attempt", again.json?.data?.attemptId === attemptId && again.json.data.resumed === true);

const view = await call(`/api/attempts/${attemptId}`, { token: c1.token });
check("player view loads with server deadline", view.json?.data?.view?.timing?.deadline > Date.now());
check("player view contains no key", !view.text.includes('"correct"') && !view.text.includes('"accepted"'));
const booklet = await fetch(view.json.data.bookletUrl);
const bookletText = await booklet.text();
check("booklet URL serves HTML", booklet.status === 200 && (booklet.headers.get("content-type") ?? "").startsWith("text/html") && bookletText.includes("Savol matni 43"), booklet.status);

const cid = "client-aaaa-1111";
const s1 = await call(`/api/attempts/${attemptId}/save`, {
  method: "POST",
  token: c1.token,
  body: { clientId: cid, changes: { 1: "B", 2: "C", 3: "A", 4: "Z", 33: ["A", "B", "", ""], 36: "0.5", 37: "1/2", 38: "0,5 m", 39: "5 m", 41: { text: "too early" } } },
});
const rej = Object.fromEntries(s1.json.data.result.rejected.map((r) => [r.n, r.reason]));
check("valid answers accepted", ["1", "2", "3", "33", "36", "37", "38"].every((n) => s1.json.data.result.accepted.includes(n)), s1.json.data.result);
check("invalid option letter rejected", !!rej["4"]);
check("O2 answer rejected while stage 1 is open", !!rej["41"]);
const conflict = await call(`/api/attempts/${attemptId}/save`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", changes: { 5: "A" } } });
check("second tab → 409 conflict", conflict.status === 409 && conflict.json.error.code === "conflict");
const takeover = await call(`/api/attempts/${attemptId}/save`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", changes: { 5: "A" }, takeover: true } });
check("takeover succeeds", takeover.status === 200);
const reload = await call(`/api/attempts/${attemptId}`, { token: c1.token });
check("answers persist after reload", reload.json.data.view.answers["1"] === "B" && reload.json.data.view.answers["5"] === "A");

// other candidate isolation
const c2 = await signUp(`e2e2-${Date.now()}@example.com`);
await call("/api/me", { method: "POST", token: c2.token, body: { firstName: "Bobur", lastName: "Aliyev" } });
check("other candidate cannot read the attempt (404)", (await call(`/api/attempts/${attemptId}`, { token: c2.token })).status === 404);
check("other candidate cannot write the attempt (404)", (await call(`/api/attempts/${attemptId}/save`, { method: "POST", token: c2.token, body: { clientId: "client-cccc-3333", changes: { 1: "A" } } })).status === 404);
check("candidate token cannot access admin API", (await call("/api/admin/stats", { token: c1.token })).status === 401);

// advance stage
const adv = await call(`/api/attempts/${attemptId}/advance`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", fromIndex: 0 } });
check("stage 1 closed early, stage 2 started", adv.json?.data?.view?.timing?.index === 1, adv.json);
const st2Deadline = adv.json.data.view.timing.deadline;
check("stage 2 gets its full 80 minutes", Math.abs(st2Deadline - Date.now() - 80 * 60_000) < 30_000);
const adv2 = await call(`/api/attempts/${attemptId}/advance`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", fromIndex: 0 } });
check("repeated advance is a no-op", adv2.json?.data?.view?.timing?.index === 1 && adv2.json.data.view.timing.deadline === st2Deadline);
const s2 = await call(`/api/attempts/${attemptId}/save`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", changes: { 1: "D", 41: { text: "Berilgan: ... Yechish: ... Javob: 12" } } } });
check("stage-1 answers are locked after advancing", s2.json.data.result.rejected.some((r) => r.n === "1"));
check("O2 text accepted in stage 2", s2.json.data.result.accepted.includes("41"));

// O2 file upload through Storage rules
const filePath = `submissions/${c1.uid}/${attemptId}/41/${Date.now()}-yechim.png`;
const png = Buffer.from("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEA73581E40000000049454E44AE426082", "hex");
check("candidate can upload PNG to own path", (await upload(filePath, png, "image/png", c1.token)) === 200);
check("candidate cannot upload into another user's path", (await upload(`submissions/${c2.uid}/${attemptId}/41/x.png`, png, "image/png", c1.token)) === 403);
check("candidate cannot upload disallowed type", (await upload(`submissions/${c1.uid}/${attemptId}/41/x.html`, "<b>x</b>", "text/html", c1.token)) === 403);
const reg = await call(`/api/attempts/${attemptId}/files`, { method: "POST", token: c1.token, body: { n: "41", path: filePath, name: "yechim.png" } });
check("uploaded file registered on the attempt", reg.status === 201 && reg.json.data.view.o2Files["41"].length === 1, reg.json);
const fileId = reg.json.data.file.id;
const furl = await call(`/api/attempts/${attemptId}/files/${fileId}`, { token: c1.token });
check("owner gets a file URL", furl.status === 200 && (await fetch(furl.json.data.url)).status === 200);
check("other candidate cannot get the file URL", (await call(`/api/attempts/${attemptId}/files/${fileId}`, { token: c2.token })).status === 404);
const spoof = await call(`/api/attempts/${attemptId}/files`, { method: "POST", token: c1.token, body: { n: "41", path: `submissions/${c2.uid}/${attemptId}/41/a.png`, name: "a.png" } });
check("registering a foreign path is refused", spoof.status === 400);

// submit
const sub = await call(`/api/attempts/${attemptId}/submit`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222" } });
check("submitted → pending_review (has O2)", sub.json?.data?.view?.status === "pending_review", sub.json);
const sub2 = await call(`/api/attempts/${attemptId}/submit`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222" } });
check("double submit is idempotent", sub2.json?.data?.view?.status === "pending_review");
const late = await call(`/api/attempts/${attemptId}/save`, { method: "POST", token: c1.token, body: { clientId: "client-bbbb-2222", changes: { 41: { text: "changed after submit" } } } });
check("answers frozen after submission", late.json?.data?.result?.accepted?.length === 0);

const res1 = await call(`/api/attempts/${attemptId}/result`, { token: c1.token });
const r1 = res1.json.data;
check("result: raw summary present", r1.summary && r1.summary.max === 32 + 12 + 5, r1.summary);
// key: n%4 → 1:B 2:C 3:D 5:B ; answers 1:B ✓ 2:C ✓ 3:A ✗ 5:A ✗
check("result: Y1 graded (1,2 correct; 3,5 incorrect)", ["correct", "correct", "incorrect"].join() === [1, 2, 3].map((n) => r1.questions.find((q) => q.n === n)?.status).join() && r1.questions.find((q) => q.n === 5)?.status === "incorrect");
check("result: right number + unexpected unit ('0,5 m') → needs_review", r1.questions.find((q) => q.n === 38)?.status === "needs_review");
check("result: wrong number with unit ('5 m') → incorrect", r1.questions.find((q) => q.n === 39)?.status === "incorrect");
check("result: 0.5 and 1/2 accepted for key 0,5", r1.questions.find((q) => q.n === 36)?.status === "correct" && r1.questions.find((q) => q.n === 37)?.status === "correct");
check("result: Y2 per-pair partial", r1.questions.find((q) => q.n === 33)?.status === "partial" && r1.questions.find((q) => q.n === 33)?.score === 2);
check("result: correct answers hidden before publication", r1.revealAnswers === false && r1.questions.every((q) => q.correct === null));
check("result: no Rasch claim", r1.format.raschAvailable === false);
check("result: O2 pending", r1.o2.every((o) => o.status === "pending_review" && o.review === null));

// ───────────────────────────────────────────────── admin review & publish
console.log("Review & publish");
const queue = await call("/api/admin/attempts?status=pending_review", { admin: true });
check("attempt appears in review queue", queue.json.data.some((a) => a.id === attemptId));
const over = await call(`/api/admin/attempts/${attemptId}/review`, { method: "POST", admin: true, body: { o2: { 41: { criteria: [{ id: "m1", score: 25 }, { id: "a1", score: 5 }] } } } });
check("criterion above its max is refused", over.status === 400, over.json);
const rev = await call(`/api/admin/attempts/${attemptId}/review`, {
  method: "POST",
  admin: true,
  body: {
    o1: { 38: "correct" },
    o2: {
      41: { criteria: [{ id: "m1", score: 16 }, { id: "a1", score: 7 }], comment: "Yaxshi", errorTags: ["Hisoblashda xato"] },
      42: { m: 20, a: 10, criteria: [] },
      43: { m: 5, a: 3, criteria: [] },
    },
  },
});
check("review saved → graded", rev.json?.data?.status === "graded", rev.json);
check("O2 M and A stored separately", rev.json.data.o2Reviews["41"].m === 16 && rev.json.data.o2Reviews["41"].a === 7 && rev.json.data.o2Reviews["41"].total === 23);
const tooMuch = await call(`/api/admin/attempts/${attemptId}/review`, { method: "POST", admin: true, body: { o2: { 43: { m: 8, a: 5, criteria: [] } } } });
check("task 43 total above 10 refused", tooMuch.status === 400);
const pubR = await call(`/api/admin/attempts/${attemptId}/publish`, { method: "POST", admin: true, body: { action: "publish" } });
check("result published", pubR.json?.data?.status === "published");
const res2 = (await call(`/api/attempts/${attemptId}/result`, { token: c1.token })).json.data;
check("published: correct answers revealed", res2.revealAnswers === true && res2.questions.find((q) => q.n === 1)?.correct === "B");
check("published: O2 total 23+30+8 = 61 / 75", res2.o2Total === 61 && res2.o2Max === 75, { t: res2.o2Total, m: res2.o2Max });
check("published: resolved O1 counts as correct", res2.questions.find((q) => q.n === 38)?.status === "correct");

// ───────────────────────────────────────────────── timer expiry
console.log("Server timer");
const m2 = await call("/api/admin/materials", {
  method: "POST",
  admin: true,
  body: { title: "E2E diagnostika", description: "", subjectCode: "matematika", mode: "diagnostic", timed: true, range: { from: 1, to: 3 }, minutes: 5, revealAnswers: false, attemptLimit: 1, html: { path: htmlPath, fileName: "booklet.html", inlinedImages: 0, warnings: [] } },
});
const m2id = m2.json.data.id;
await call(`/api/admin/materials/${m2id}`, { method: "PATCH", admin: true, body: { key: { 1: { type: "Y1", correct: "A" }, 2: { type: "Y1", correct: "B" }, 3: { type: "Y1", correct: "C" } } } });
await call(`/api/admin/materials/${m2id}`, { method: "PATCH", admin: true, body: { status: "published" } });
const a2 = (await call(`/api/materials/${m2id}/start`, { method: "POST", token: c2.token })).json.data.attemptId;
await call(`/api/attempts/${a2}/save`, { method: "POST", token: c2.token, body: { clientId: "client-dddd-4444", changes: { 1: "A", 2: "A" } } });
// Simulate the clock running out: move the start 6 minutes into the past.
const ref = fsdb.collection("attempts").doc(a2);
const snap = await ref.get();
const timing = snap.get("timing");
timing.starts[0] -= 6 * 60_000;
await ref.update({ timing });
const hb = await call(`/api/attempts/${a2}/heartbeat`, { method: "POST", token: c2.token, body: { clientId: "client-dddd-4444" } });
check("expired attempt auto-finalized on next contact", hb.json?.data?.view?.status === "published" && hb.json.data.view.timing.finished === true, hb.json?.data?.view?.status);
const after = (await ref.get()).data();
check("finalizeReason = timeout, submittedAt = deadline", after.finalizeReason === "timeout" && after.submittedAt === timing.starts[0] + 5 * 60_000);
check("late save after expiry rejected", (await call(`/api/attempts/${a2}/save`, { method: "POST", token: c2.token, body: { clientId: "client-dddd-4444", changes: { 3: "C" } } })).json?.data?.result?.accepted?.length === 0);
const r3 = (await call(`/api/attempts/${a2}/result`, { token: c2.token })).json.data;
check("no-O2 attempt auto-published with raw score 1/3", r3.status === "published" && r3.summary.score === 1 && r3.summary.max === 3);
check("revealAnswers=false keeps keys hidden after publication", r3.questions.every((q) => q.correct === null));
const limit = await call(`/api/materials/${m2id}/start`, { method: "POST", token: c2.token });
check("attempt limit enforced", limit.status === 403 && limit.json.error.code === "attempt_limit");

// ───────────────────────────────────────────────── users
console.log("Users");
const users = await call("/api/admin/users", { admin: true });
check("admin sees new users", users.json.data.users.some((u) => u.uid === c1.uid) && users.json.data.users.some((u) => u.uid === c2.uid));
const csv = await fetch(BASE + "/api/admin/users?format=csv", { headers: { Cookie: adminCookie } });
const csvText = await csv.text();
check("CSV export works", csv.status === 200 && csvText.includes("Candidate ID") && csvText.includes("Karimova"));
const susp = await call(`/api/admin/users/${c2.uid}`, { method: "PATCH", admin: true, body: { action: "suspend" } });
check("suspend user", susp.json?.data?.status === "suspended");
const blocked = await call("/api/me/attempts", { token: c2.token });
check("suspended user is blocked", blocked.status === 401 || blocked.status === 403, blocked.status);
await call(`/api/admin/users/${c2.uid}`, { method: "PATCH", admin: true, body: { action: "activate" } });
const audit = await call("/api/admin/audit", { admin: true });
check("audit log records admin actions", ["admin.login", "admin.login_failed", "material.create", "review.save", "result.publish", "user.suspend"].every((a) => audit.json.data.some((e) => e.action === a)));
const del = await call(`/api/admin/materials/${matId}`, { method: "DELETE", admin: true });
check("material with attempts cannot be deleted", del.status === 409);

// ───────────────────────────────────────────────── logout
await call("/api/admin/logout", { method: "POST", admin: true });
adminCookie = "";
check("after logout admin API → 401", (await call("/api/admin/stats", { admin: true })).status === 401);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
