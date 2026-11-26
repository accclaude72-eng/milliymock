import type { Metadata } from "next";
import { SubjectsGrid } from "@/components/landing/subjects-grid";

export const metadata: Metadata = { title: "Fanlar" };

export default function SubjectsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Fanlar reestri</p>
      <h1 className="display mt-2 text-5xl sm:text-6xl">Fanlar va formatlar</h1>
      <p className="mt-3 max-w-2xl text-ink-2">
        Har bir fan uchun faol spetsifikatsiya versiyasi, topshiriqlar tuzilishi va vaqt chegaralari. Yangi fanlar administrator tomonidan reestrga
        qo‘shilganda shu yerda avtomatik paydo bo‘ladi.
      </p>
      <div className="mt-10">
        <SubjectsGrid />
      </div>
    </div>
  );
}
