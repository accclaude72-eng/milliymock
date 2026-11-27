import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { readPaymentSettings, writePaymentSettings } from "@/lib/server/site-settings";

export const GET = route(async () => {
  await requireAdmin();
  return ok(await readPaymentSettings());
});

const PaymentSettingsSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, " "))
    .refine((s) => s === "" || /^[0-9 ]{16,23}$/.test(s), "karta raqami 16–19 ta raqamdan iborat bo‘lishi kerak"),
  cardHolder: z.string().trim().max(80),
  instructions: z.string().trim().max(500).default(""),
});

export const PUT = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const v = PaymentSettingsSchema.parse(await readJson(req));
  await writePaymentSettings(v);
  return ok(await readPaymentSettings());
});
