// Uploads a booklet + key built by build-source-test.mjs as a DRAFT material (not published),
// so an admin can check the key in the panel before publishing.
//
// Usage (PowerShell):
//   $env:ADMIN_CODE="<admin code>"; $env:BASE="http://localhost:3005"
//   node scripts/upload-draft.mjs content/<file>.html content/<file>.key.json
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [htmlPath, keyPath] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!htmlPath || !keyPath || !CODE) {
  console.error("Usage: ADMIN_CODE=... BASE=... node scripts/upload-draft.mjs <booklet.html> <key.json>");
  process.exit(1);
}
try {
  process.loadEnvFile(".env.local");
} catch {}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
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

// 0) The a/b diagnostic format is new: make sure it exists in exam_formats (same doc the app seeds).
if (spec.formatId === "biologiya-2026-ab") {
  const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
  const { data: have } = await admin.from("exam_formats").select("id").eq("id", spec.formatId).maybeSingle();
  if (!have) {
    const { data: base } = await admin.from("exam_formats").select("doc").eq("id", "biologiya-2025").single();
    const now = Date.now();
    const doc = {
      ...base.doc,
      id: spec.formatId,
      version: "2026-ab",
      label: "Biologiya · diagnostika (10 ta a/b masala)",
      effectiveDate: "2026-11-28",
      totalTasks: 55,
      totalMinutes: 150,
      sections: [{ id: "test", title: "Test topshiriqlari", from: 1, to: 55, minutes: 150 }],
      taskGroups: [
        { type: "Y1", from: 1, to: 32 },
        { type: "Y2", from: 33, to: 35 },
        { type: "O1", from: 36, to: 55 },
      ],
      o2Tasks: [],
      assessmentNote:
        "Diagnostik format: 1–32 yopiq test, 33–35 moslashtirish, 36–55 qisqa javob (har bir masalaning a va b qismlari alohida topshiriq), 150 daqiqa. Natija xom ball sifatida ko‘rsatiladi.",
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await admin.from("exam_formats").upsert({ id: spec.formatId, doc }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`format seed: ${error.message}`);
    console.log(`✓ format ${spec.formatId} added`);
  }
}

await call("/api/admin/login", "POST", { code: CODE });
console.log("✓ admin login");

// Topic names come from the format the material will use.
const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
const { data: fmt } = await admin.from("exam_formats").select("doc").eq("id", spec.formatId).single();
const topicOf = {};
for (const [idx, nums] of Object.entries(spec.topics ?? {})) for (const n of nums) topicOf[n] = fmt.doc.topics[Number(idx)];

const key = {};
for (const m of spec.y1.matchAll(/(\d+)\s*([A-J])/g)) key[m[1]] = { type: "Y1", correct: m[2], topic: topicOf[m[1]] };
for (const [n, pairs] of Object.entries(spec.y2 ?? {})) key[n] = { type: "Y2", left: pairs.length, right: spec.structure.y2[n].right, pairs, topic: topicOf[n] };
for (const [n, o] of Object.entries(spec.o1 ?? {})) key[n] = { type: "O1", accepted: o.accepted, tolerance: o.tolerance ?? null, unit: o.unit, caseSensitive: false, topic: topicOf[n] };
for (const [n, criteria] of Object.entries(spec.o2 ?? {})) key[n] = { type: "O2", criteria, topic: topicOf[n] };

const up = await call("/api/admin/storage-token");
const sb = createClient(URL_, PUB, { auth: { persistSession: false } });
const { error } = await sb.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, new Blob([html], { type: "text/html" }), { contentType: "text/html" });
if (error) throw new Error(`upload failed: ${error.message}`);
console.log("✓ booklet uploaded");

const { id } = await call("/api/admin/materials", "POST", {
  title: spec.title,
  description: spec.description ?? "",
  subjectCode: spec.subjectCode,
  formatId: spec.formatId,
  mode: spec.mode ?? "full",
  timed: spec.timed ?? true,
  range: spec.range ?? null,
  minutes: spec.minutes ?? null,
  revealAnswers: true,
  attemptLimit: null,
  html: { path: up.path, fileName: htmlPath.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9_.-]/g, "_"), inlinedImages: (html.match(/data:image\//g) ?? []).length, warnings: [] },
});
console.log(`✓ draft created (${id})`);

const { data: mat } = await admin.from("materials").select("doc").eq("id", id).single();
const structure = { ...mat.doc.structure, y2: { ...mat.doc.structure.y2, ...spec.structure.y2 } };
const saved = await call(`/api/admin/materials/${id}`, "PATCH", { structure, key });
const ks = saved.material.keyStatus;
console.log(ks.complete ? "✓ key saved and complete" : `! key saved, still incomplete:\n  ${ks.problems.join("\n  ")}`);
console.log(`→ left as DRAFT: ${BASE}/admin/materiallar/${id}`);
