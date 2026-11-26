import type { Metadata } from "next";

export const metadata: Metadata = { title: "Maxfiylik siyosati" };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Huquqiy</p>
      <h1 className="display mt-2 text-5xl">Maxfiylik siyosati</h1>
      <div className="mt-8 space-y-6 leading-relaxed text-ink-2 [&_h2]:display [&_h2]:text-2xl [&_h2]:text-ink">
        <section>
          <h2>Qanday ma’lumotlar yig‘iladi</h2>
          <p className="mt-2">
            Ro‘yxatdan o‘tishda: ism, familiya, email, ixtiyoriy telefon raqami, hudud, ta’lim muassasasi va sinf/kurs. Imtihon jarayonida: javoblaringiz,
            yuklagan fayllaringiz (yozma ishlar), boshlash va topshirish vaqtlari.
          </p>
        </section>
        <section>
          <h2>Ma’lumotlar qanday ishlatiladi</h2>
          <p className="mt-2">
            Faqat mock-imtihonni o‘tkazish, natijani hisoblash, yozma ishlarni ekspert baholashi va sizga shaxsiy tahlil ko‘rsatish uchun. Ma’lumotlar uchinchi
            shaxslarga sotilmaydi va reklama uchun ishlatilmaydi.
          </p>
        </section>
        <section>
          <h2>Kim ko‘ra oladi</h2>
          <p className="mt-2">
            Natijalaringiz va javoblaringizni faqat siz hamda platforma administratori/eksperti ko‘ra oladi. Fayllar ommaviy havolaga ega emas — ular faqat
            qisqa muddatli, avtorizatsiyalangan havolalar orqali ochiladi.
          </p>
        </section>
        <section>
          <h2>Saqlash</h2>
          <p className="mt-2">
            Ma’lumotlar Google Firebase (Authentication, Firestore, Cloud Storage) xizmatlarida saqlanadi. Parolingiz platformaga ko‘rinmaydi — u faqat
            Firebase Authentication tomonidan xavfsiz shaklda saqlanadi. Hisobingiz va ma’lumotlaringizni o‘chirish uchun administratorga murojaat qiling.
          </p>
        </section>
        <section>
          <h2>Kuzatuv</h2>
          <p className="mt-2">Platforma kamera, mikrofon yoki ekran kuzatuvidan foydalanmaydi va proktoring tizimi emas.</p>
        </section>
      </div>
    </article>
  );
}
