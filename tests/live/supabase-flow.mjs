// Live end-to-end test against a real Supabase project + a running dev server.
// Creates clearly-labelled test data and deletes all of it at the end.
// Usage: ADMIN_CODE=<code> BASE=http://localhost:3000 node tests/live/supabase-flow.mjs
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const BASE = process.env.BASE ?? "http://localhost:3000";
const ADMIN_CODE = process.env.ADMIN_CODE;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ADMIN_CODE || !URL_ || !PUB || !SECRET) throw new Error("Missing ADMIN_CODE or Supabase env vars");

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const adminSb = createClient(URL_, SECRET, noPersist);
const anon = () => createClient(URL_, PUB, noPersist);

let passed = 0;
let failed = 0;
const check = (name, cond, extra) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300));
  }
};

let adminCookie = "";
async function call(path, { method = "GET", body, token, admin } = {}) {
  const headers = { Origin: BASE };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (admin && adminCookie) headers.Cookie = adminCookie;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const sc = res.headers.get("set-cookie");
  if (sc?.startsWith("mm_admin=")) adminCookie = sc.split(";")[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const stamp = Date.now();
const created = { users: [], materials: [], files: [] };
const PASSWORD = `Test-${stamp}-pw`;

async function makeUser(tag) {
  const email = `mm-livetest-${tag}-${stamp}@example.com`;
  const { data, error } = await adminSb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);
  const client = anon();
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw s.error;
  return { uid: data.user.id, email, token: s.data.session.access_token, client };
}

const BOOKLET = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Live test</title></head><body>${Array.from({ length: 43 }, (_, i) => `<p>${i + 1}. Savol ${i + 1}</p>`).join("")}</body></html>`;
const PNG = Buffer.from("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEA73581E40000000049454E44AE426082", "hex");

async function uploadBooklet() {
  const t = await call("/api/admin/storage-token", { admin: true });
  const { error } = await anon().storage.from(t.json.data.bucket).uploadToSignedUrl(t.json.data.path, t.json.data.token, new Blob([BOOKLET], { type: "text/html" }), { contentType: "text/html" });
  return { path: t.json.data.path, error };
}

try {
  console.log(`\nLIVE test against ${BASE}\n\nConnectivity & seed`);
  const h = await call("/api/health");
  check("health: server + browser Supabase configured", h.json?.data?.supabase && h.json?.data?.supabaseBrowser, h.json);
  const subs = await call("/api/subjects");
  check("4 subjects seeded in Postgres", subs.json?.data?.length === 4, subs.json);
  const bio = subs.json?.data?.find((s) => s.code === "biologiya")?.format;
  check("Biology format 43 tasks / 180 min / O2 30-35-10", bio?.totalTasks === 43 && bio?.totalMinutes === 180 && bio?.o2Tasks.map((t) => t.maxScore).join() === "30,35,10");

  console.log("RLS (anonymous browser key)");
  const a0 = anon();
  check("anon can read subjects", ((await a0.from("subjects").select("id")).data ?? []).length === 4);
  check("anon cannot read answer keys", ((await a0.from("material_keys").select("id")).data ?? []).length === 0);
  check("anon cannot read audit log", ((await a0.from("audit_logs").select("id")).data ?? []).length === 0);
  check("anon cannot read profiles", ((await a0.from("profiles").select("id")).data ?? []).length === 0);
  check("anon cannot write subjects", !!(await a0.from("subjects").insert({ id: "hack", doc: {} })).error);
  check("anon cannot call server-only functions", !!(await a0.rpc("next_candidate_number")).error);

  console.log("Auth & profiles");
  const A = await makeUser("a");
  const B = await makeUser("b");
  check("candidate login returns a session", !!A.token && !!B.token);
  check("no profile yet → profile_required", (await call("/api/me/attempts", { token: A.token })).json?.error?.code === "profile_required");
  const pa = await call("/api/me", { method: "POST", token: A.token, body: { firstName: "Test", lastName: "Alpha", region: "Toshkent shahri", grade: "11-sinf" } });
  check("profile created with Candidate ID", pa.status === 201 && /^MM-\d{2}-\d{6}$/.test(pa.json?.data?.profile?.candidateId ?? ""), pa.json);
  const pa2 = await call("/api/me", { method: "POST", token: A.token, body: { firstName: "Test", lastName: "Alpha" } });
  check("profile creation idempotent", pa2.json?.data?.profile?.candidateId === pa.json?.data?.profile?.candidateId);
  await call("/api/me", { method: "POST", token: B.token, body: { firstName: "Test", lastName: "Beta" } });
  check("bad token → 401", (await call("/api/me", { token: "not-a-token" })).status === 401);
  const ownProfiles = (await A.client.from("profiles").select("id")).data ?? [];
  check("RLS: candidate sees only own profile", ownProfiles.length === 1 && ownProfiles[0].id === A.uid, ownProfiles);

  console.log("Admin");
  check("admin API without cookie → 401", (await call("/api/admin/stats")).status === 401);
  check("wrong admin code → 401", (await call("/api/admin/login", { method: "POST", body: { code: "wrong" } })).status === 401);
  const login = await call("/api/admin/login", { method: "POST", body: { code: ADMIN_CODE } });
  check("correct admin code → session", login.status === 200 && !!adminCookie, login.json);
  check("candidate token cannot use admin API", (await call("/api/admin/stats", { token: A.token })).status === 401);
  const stats = await call("/api/admin/stats", { admin: true });
  check("admin stats from Postgres", stats.status === 200 && stats.json.data.users >= 2, stats.json);

  console.log("HTML upload & material");
  const up = await uploadBooklet();
  check("booklet uploaded to private bucket via signed URL", !up.error, up.error);
  const mat = await call("/api/admin/materials", {
    method: "POST",
    admin: true,
    body: { title: `LIVE TEST ${stamp}`, description: "", subjectCode: "biologiya", mode: "full", timed: true, range: null, minutes: null, revealAnswers: true, attemptLimit: null, html: { path: up.path, fileName: "booklet.html", inlinedImages: 0, warnings: [] } },
  });
  check("draft material created", mat.status === 201, mat.json);
  const matId = mat.json?.data?.id;
  created.materials.push(matId);
  check("publish with empty key refused", (await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { status: "published" } })).status === 409);
  const key = {};
  for (let n = 1; n <= 32; n++) key[n] = { type: "Y1", correct: "ABCD"[n % 4], topic: "Organ va organizm darajasi" };
  for (const n of [33, 34, 35]) key[n] = { type: "Y2", left: 4, right: 6, pairs: ["A", "B", "C", "D"] };
  for (const n of [36, 37, 38, 39, 40]) key[n] = { type: "O1", accepted: ["0,5"], tolerance: null };
  const ks = await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { key } });
  check("key saved & complete", ks.json?.data?.material?.keyStatus?.complete === true, ks.json);
  check("material published", (await call(`/api/admin/materials/${matId}`, { method: "PATCH", admin: true, body: { status: "published" } })).json?.data?.material?.status === "published");
  const cat = await call("/api/materials");
  check("catalog lists it, without keys", cat.json?.data?.some((m) => m.id === matId) && !cat.text.includes('"correct"'));
  check("RLS: candidate cannot read the key", ((await A.client.from("material_keys").select("id").eq("id", matId)).data ?? []).length === 0);

  console.log("Exam attempt");
  const st = await call(`/api/materials/${matId}/start`, { method: "POST", token: A.token });
  check("attempt started", st.status === 201, st.json);
  const att = st.json?.data?.attemptId;
  check("second start resumes", (await call(`/api/materials/${matId}/start`, { method: "POST", token: A.token })).json?.data?.attemptId === att);
  const v = await call(`/api/attempts/${att}`, { token: A.token });
  check("server deadline ~100 min", Math.abs(v.json?.data?.view?.timing?.deadline - Date.now() - 100 * 60_000) < 60_000);
  const bk = await fetch(v.json?.data?.bookletUrl);
  check("booklet signed URL serves the HTML", bk.ok && (await bk.text()).includes("Savol 43"));
  const s1 = await call(`/api/attempts/${att}/save`, { method: "POST", token: A.token, body: { clientId: "client-aaaa-1111", changes: { 1: "B", 2: "C", 3: "A", 4: "Z", 33: ["A", "B", "", ""], 36: "0.5", 37: "1/2", 41: { text: "early" } } } });
  const rej = Object.fromEntries((s1.json?.data?.result?.rejected ?? []).map((r) => [r.n, r.reason]));
  check("autosave accepted valid answers", ["1", "2", "3", "33", "36", "37"].every((n) => s1.json?.data?.result?.accepted?.includes(n)), s1.json);
  check("invalid letter and closed-section O2 rejected", !!rej["4"] && !!rej["41"]);
  check("second tab → conflict", (await call(`/api/attempts/${att}/save`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222", changes: { 5: "A" } } })).status === 409);
  check("takeover works", (await call(`/api/attempts/${att}/save`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222", changes: { 5: "A" }, takeover: true } })).status === 200);
  const rl = await call(`/api/attempts/${att}`, { token: A.token });
  check("answers persist after reload", rl.json?.data?.view?.answers?.["1"] === "B" && rl.json?.data?.view?.answers?.["5"] === "A");
  check("other candidate cannot read attempt (API)", (await call(`/api/attempts/${att}`, { token: B.token })).status === 404);
  check("RLS: other candidate cannot read attempt row", ((await B.client.from("attempts").select("id").eq("id", att)).data ?? []).length === 0);
  check("RLS: owner can read own attempt row", ((await A.client.from("attempts").select("id").eq("id", att)).data ?? []).length === 1);
  const adv = await call(`/api/attempts/${att}/advance`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222", fromIndex: 0 } });
  check("stage 1 closed, stage 2 has 80 min", adv.json?.data?.view?.timing?.index === 1 && Math.abs(adv.json.data.view.timing.deadline - Date.now() - 80 * 60_000) < 60_000, adv.json);
  const s2 = await call(`/api/attempts/${att}/save`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222", changes: { 1: "D", 41: { text: "Berilgan … Javob: 12" } } } });
  check("stage-1 answers locked; O2 text accepted", s2.json?.data?.result?.rejected?.some((r) => r.n === "1") && s2.json?.data?.result?.accepted?.includes("41"));

  console.log("O2 upload");
  const prep = await call(`/api/attempts/${att}/files`, { method: "POST", token: A.token, body: { action: "prepare", n: "41", name: "yechim.png", size: PNG.length, contentType: "image/png" } });
  check("upload URL issued", prep.status === 200, prep.json);
  const upl = await anon().storage.from("submissions").uploadToSignedUrl(prep.json.data.path, prep.json.data.token, new Blob([PNG], { type: "image/png" }), { contentType: "image/png" });
  check("PNG uploaded to private bucket", !upl.error, upl.error);
  created.files.push(prep.json.data.path);
  const reg = await call(`/api/attempts/${att}/files`, { method: "POST", token: A.token, body: { action: "register", n: "41", path: prep.json.data.path, name: "yechim.png" } });
  check("file registered on attempt", reg.status === 201 && reg.json?.data?.view?.o2Files?.["41"]?.length === 1, reg.json);
  check("foreign path refused", (await call(`/api/attempts/${att}/files`, { method: "POST", token: A.token, body: { action: "register", n: "41", path: `${B.uid}/${att}/41/x.png`, name: "x.png" } })).status === 400);
  check("wrong file type refused", (await call(`/api/attempts/${att}/files`, { method: "POST", token: A.token, body: { action: "prepare", n: "41", name: "x.html", size: 10, contentType: "text/html" } })).status === 400);
  const fid = reg.json?.data?.file?.id;
  const fu = await call(`/api/attempts/${att}/files/${fid}`, { token: A.token });
  check("owner gets signed file URL", fu.status === 200 && (await fetch(fu.json.data.url)).ok);
  check("other candidate cannot get the file", (await call(`/api/attempts/${att}/files/${fid}`, { token: B.token })).status === 404);
  check("bucket is private (direct download denied)", !!(await B.client.storage.from("submissions").download(prep.json.data.path)).error);

  console.log("Submit, grade, review, publish");
  const sub = await call(`/api/attempts/${att}/submit`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222" } });
  check("submitted → pending_review", sub.json?.data?.view?.status === "pending_review", sub.json);
  check("double submit idempotent", (await call(`/api/attempts/${att}/submit`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222" } })).json?.data?.view?.status === "pending_review");
  check("answers frozen after submit", (await call(`/api/attempts/${att}/save`, { method: "POST", token: A.token, body: { clientId: "client-bbbb-2222", changes: { 41: { text: "late" } } } })).json?.data?.result?.accepted?.length === 0);
  const r1 = (await call(`/api/attempts/${att}/result`, { token: A.token })).json?.data;
  check("raw result computed (0.5 and 1/2 accepted)", r1?.questions?.find((q) => q.n === 36)?.status === "correct" && r1?.questions?.find((q) => q.n === 37)?.status === "correct", r1?.summary);
  check("answers hidden before publication", r1?.revealAnswers === false && r1?.questions?.every((q) => q.correct === null));
  const rev = await call(`/api/admin/attempts/${att}/review`, { method: "POST", admin: true, body: { o2: { 41: { m: 20, a: 5 }, 42: { m: 10, a: 5 }, 43: { m: 3, a: 2 } } } });
  check("review saved → graded", rev.json?.data?.status === "graded", rev.json);
  check("O2 above max refused", (await call(`/api/admin/attempts/${att}/review`, { method: "POST", admin: true, body: { o2: { 43: { m: 8, a: 5 } } } })).status === 400);
  check("result published", (await call(`/api/admin/attempts/${att}/publish`, { method: "POST", admin: true, body: { action: "publish" } })).json?.data?.status === "published");
  const r2 = (await call(`/api/attempts/${att}/result`, { token: A.token })).json?.data;
  check("candidate sees O2 total 25+15+5=45/75 and answers", r2?.o2Total === 45 && r2?.o2Max === 75 && r2?.revealAnswers === true, { t: r2?.o2Total });

  console.log("Server timer expiry");
  const m2 = await call("/api/admin/materials", {
    method: "POST",
    admin: true,
    body: { title: `LIVE TEST diag ${stamp}`, description: "", subjectCode: "matematika", mode: "diagnostic", timed: true, range: { from: 1, to: 3 }, minutes: 5, revealAnswers: false, attemptLimit: 1, html: { path: up.path, fileName: "booklet.html", inlinedImages: 0, warnings: [] } },
  });
  const m2id = m2.json?.data?.id;
  created.materials.push(m2id);
  await call(`/api/admin/materials/${m2id}`, { method: "PATCH", admin: true, body: { key: { 1: { type: "Y1", correct: "A" }, 2: { type: "Y1", correct: "B" }, 3: { type: "Y1", correct: "C" } } } });
  await call(`/api/admin/materials/${m2id}`, { method: "PATCH", admin: true, body: { status: "published" } });
  const a2 = (await call(`/api/materials/${m2id}/start`, { method: "POST", token: B.token })).json?.data?.attemptId;
  await call(`/api/attempts/${a2}/save`, { method: "POST", token: B.token, body: { clientId: "client-dddd-4444", changes: { 1: "A", 2: "A" } } });
  const row = (await adminSb.from("attempts").select("doc").eq("id", a2).single()).data.doc;
  row.timing.starts[0] -= 6 * 60_000; // simulate the 5-minute clock running out
  await adminSb.from("attempts").update({ doc: row }).eq("id", a2);
  const hb = await call(`/api/attempts/${a2}/heartbeat`, { method: "POST", token: B.token, body: { clientId: "client-dddd-4444" } });
  check("expired attempt auto-finalized & published", hb.json?.data?.view?.status === "published", hb.json);
  const r3 = (await call(`/api/attempts/${a2}/result`, { token: B.token })).json?.data;
  check("timeout grade 1/3, keys stay hidden", r3?.summary?.score === 1 && r3?.summary?.max === 3 && r3?.finalizeReason === "timeout" && r3?.questions?.every((q) => q.correct === null));
  check("attempt limit enforced", (await call(`/api/materials/${m2id}/start`, { method: "POST", token: B.token })).json?.error?.code === "attempt_limit");

  console.log("Users");
  const users = await call(`/api/admin/users?q=mm-livetest`, { admin: true });
  check("admin sees new users", users.json?.data?.users?.filter((u) => u.email.includes(String(stamp))).length === 2);
  check("suspend user", (await call(`/api/admin/users/${B.uid}`, { method: "PATCH", admin: true, body: { action: "suspend" } })).json?.data?.status === "suspended");
  const blocked = await call("/api/me/attempts", { token: B.token });
  check("suspended user blocked", blocked.status === 401 || blocked.status === 403, blocked.status);
  check("reactivate user", (await call(`/api/admin/users/${B.uid}`, { method: "PATCH", admin: true, body: { action: "activate" } })).json?.data?.status === "active");
  const audit = await call("/api/admin/audit", { admin: true });
  check("audit log records actions", ["admin.login", "material.create", "review.save", "result.publish", "user.suspend"].every((x) => audit.json?.data?.some((e) => e.action === x)));
  check("audit log is append-only", !!(await adminSb.from("audit_logs").delete().eq("action", "admin.login")).error);
} catch (e) {
  failed++;
  console.log("  ✗ unexpected error:", e?.message ?? e);
} finally {
  console.log("\nCleanup");
  for (const id of created.users) await adminSb.auth.admin.deleteUser(id); // cascades profiles + attempts
  for (const id of created.materials.filter(Boolean)) await call(`/api/admin/materials/${id}`, { method: "DELETE", admin: true });
  if (created.files.length) await adminSb.storage.from("submissions").remove(created.files);
  const left = ((await adminSb.from("materials").select("id").in("id", created.materials.filter(Boolean))).data ?? []).length;
  console.log(`  removed ${created.users.length} test users, ${created.materials.length - left} test materials, ${created.files.length} files${left ? ` (${left} material(s) left — check admin panel)` : ""}`);
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
