import { describe, expect, it } from "vitest";
import { inQuietHours, levelOf, makeSerial, makeToken, maskName, pdfSafe, uzDate, uzHour } from "@/lib/certificate";

describe("certificate helpers", () => {
  it("levels by percent", () => {
    expect(levelOf(92).code).toBe("A");
    expect(levelOf(85).code).toBe("A");
    expect(levelOf(70).code).toBe("B");
    expect(levelOf(50).code).toBe("C");
    expect(levelOf(10).code).toBe("D");
  });
  it("masks the surname", () => {
    expect(maskName("Shohrux Muminov")).toBe("Shohrux M.");
    expect(maskName("  Ali  ")).toBe("Ali");
    expect(maskName("Ali Vali o‘g‘li Karimov")).toBe("Ali K.");
  });
  it("serial and token formats", () => {
    const b = new Uint8Array(32).map((_, i) => i * 7);
    expect(makeSerial(2026, b)).toMatch(/^MM-2026-[A-Z0-9]{6}$/);
    expect(makeToken(24, b)).toMatch(/^[A-Za-z0-9]{24}$/);
  });
  it("PDF-safe text keeps Uzbek readable", () => {
    expect(pdfSafe("O‘zbekiston — g‘alaba “zo‘r”")).toBe(`O'zbekiston - g'alaba "zo'r"`);
    expect(pdfSafe("Биология ✓")).toBe(" ");
    expect(pdfSafe("Mock №2")).toBe("Mock No. 2");
    expect(pdfSafe("Mock № 2 (s)")).toBe("Mock No. 2 (s)");
  });
  it("Uzbekistan date and hour", () => {
    const ms = Date.UTC(2026, 10, 28, 20, 30); // 01:30 next day in Tashkent
    expect(uzDate(ms)).toBe("29.11.2026");
    expect(uzHour(ms)).toBe(1);
  });
  it("quiet hours wrap midnight", () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(6, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
    expect(inQuietHours(13, 13, 15)).toBe(true);
    expect(inQuietHours(15, 13, 15)).toBe(false);
    expect(inQuietHours(3, null, 7)).toBe(false);
  });
});
