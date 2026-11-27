// Uploads an HTML test booklet + its answer key to the site and publishes it.
// Goes through the site's own admin API (same checks as the admin panel), so the booklet
// lands in the private Supabase "booklets" bucket and the key stays server-only.
//
// Usage (PowerShell):
//   $env:ADMIN_CODE="<admin code>"; $env:BASE="http://localhost:3000"
//   node scripts/publish-test.mjs content/biologiya-mock-1.html content/biologiya-mock-1.key.json
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [htmlPath, keyPath] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!htmlPath || !keyPath || !CODE) {
  console.error("Usage: ADMIN_CODE=... BASE=... node scripts/publish-test.mjs <booklet.html> <key.json>");
  process.exit(1);
}
try {
  process.loadEnvFile(".env.local");
} catch {}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

const html = readFileSync(htmlPath, "utf8");
const spec = JSON.parse(readFileSync(keyPath, "utf8"));

let cookie = "";
async function call(path, method = "GET", body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc?.startsWith("mm_admin=")) cookie = sc.split(";")[0];
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(`${method} ${path} → ${res.status}: ${json?.error?.message ?? "unknown error"}`);
  return json.data;
}

// 1) admin session
await call("/api/admin/login", "POST", { code: CODE });
console.log("✓ admin login");

// 2) resolve topic names from the subject's active format
const subjects = await call("/api/subjects");
const format = subjects.find((s) => s.code === spec.subjectCode)?.format;
if (!format) throw new Error(`Subject ${spec.subjectCode} not found`);
const topicOf = {};
for (const [idx, nums] of Object.entries(spec.topics ?? {})) for (const n of nums) topicOf[n] = format.topics[Number(idx)];

// 3) build the key in the app's format
const key = {};
for (const m of spec.y1.matchAll(/(\d+)\s*([A-J])/g)) key[m[1]] = { type: "Y1", correct: m[2], topic: topicOf[m[1]] };
for (const [n, pairs] of Object.entries(spec.y2 ?? {})) key[n] = { type: "Y2", left: pairs.length, right: 6, pairs, topic: topicOf[n] };
const o1Type = format.taskGroups.find((g) => g.type === "O1" || g.type === "O")?.type ?? "O1";
for (const [n, o] of Object.entries(spec.o1 ?? {})) key[n] = { type: o1Type, accepted: o.accepted, tolerance: o.tolerance ?? null, unit: o.unit, caseSensitive: !!o.caseSensitive, topic: topicOf[n] };
for (const [n, criteria] of Object.entries(spec.o2 ?? {})) key[n] = { type: "O2", criteria, topic: topicOf[n] };

// 4) upload booklet to the private bucket through a one-time signed URL
const up = await call("/api/admin/storage-token");
const sb = createClient(URL_, PUB, { auth: { persistSession: false } });
const { error } = await sb.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, new Blob([html], { type: "text/html" }), { contentType: "text/html" });
if (error) throw new Error(`upload failed: ${error.message}`);
console.log("✓ booklet uploaded to Supabase Storage");

// 5) create the draft, save the key, publish
const { id } = await call("/api/admin/materials", "POST", {
  title: spec.title,
  description: spec.description ?? "",
  subjectCode: spec.subjectCode,
  // Optional: publish only part of a format, e.g. Multilevel Reading = { mode: "practice", range: { from: 1, to: 35 }, minutes: 60 }
  mode: spec.mode ?? "full",
  timed: spec.timed ?? true,
  range: spec.range ?? null,
  minutes: spec.minutes ?? null,
  revealAnswers: true,
  attemptLimit: null,
  html: { path: up.path, fileName: htmlPath.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9_.-]/g, "_"), inlinedImages: 0, warnings: [] },
});
console.log(`✓ draft created (${id})`);
const saved = await call(`/api/admin/materials/${id}`, "PATCH", { key });
if (!saved.material.keyStatus.complete) {
  console.error("✗ key incomplete:\n  " + saved.material.keyStatus.problems.join("\n  "));
  process.exit(1);
}
console.log("✓ answer key saved and validated");
await call(`/api/admin/materials/${id}`, "PATCH", { status: "published" });
console.log(`✓ published → ${BASE}/imtihon/${id}`);
