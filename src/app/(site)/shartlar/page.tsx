import type { Metadata } from "next";

export const metadata: Metadata = { title: "Foydalanish shartlari" };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Huquqiy</p>
      <h1 className="display mt-2 text-5xl">Foydalanish shartlari</h1>
      <ol className="mt-8 list-decimal space-y-4 pl-5 leading-relaxed text-ink-2 marker:font-mono marker:text-accent">
        <li>
          Milliy Mock — Milliy sertifikat imtihonlariga tayyorlanish uchun mustaqil mock-imtihon platformasi. U Bilim va malakalarni baholash agentligining
          rasmiy imtihoni emas, davlat sertifikatini bermaydi va rasmiy natija yoki daraja va’da qilmaydi.
        </li>
        <li>
          Imtihon formatlari agentlik e’lon qilgan spetsifikatsiyalar asosida tuzilgan, biroq rasmiy talablar o‘zgarishi mumkin. Har doim rasmiy manbalarni
          tekshiring.
        </li>
        <li>Mock natijalari tayyorgarlik darajangizni baholash uchun mo‘ljallangan. Rasch kalibratsiyasi mavjud bo‘lmasa, faqat xom natija ko‘rsatiladi.</li>
        <li>Hisobingizni boshqalarga bermang. Bir urinishni bir vaqtning o‘zida bir nechta qurilmada ochish cheklanadi.</li>
        <li>Test materiallarini nusxalash, tarqatish yoki tijorat maqsadida ishlatish taqiqlanadi.</li>
        <li>Qoidalarni buzgan hisoblar administrator tomonidan vaqtincha bloklanishi mumkin.</li>
      </ol>
    </article>
  );
}
