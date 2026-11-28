import Link from "next/link";

export const metadata = { title: "Internet yo‘q" };

/** Shown by the service worker when a page that was never opened before is requested offline. */
export default function Offline() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="text-6xl" aria-hidden>
        📡
      </p>
      <h1 className="display mt-4 text-4xl">Internet aloqasi yo‘q</h1>
      <p className="mt-3 text-ink-2">
        Bu sahifa hali qurilmangizga saqlanmagan. Ulanish tiklangach qayta urinib ko‘ring. Shu vaqtgacha oflayn saqlagan flashcard to‘plamlaringizni takrorlashingiz mumkin — javoblaringiz internet
        qaytganda yuboriladi.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/kartalar/oflayn" className="btn btn-primary">
          Oflayn kartalar
        </Link>
        <Link href="/" className="btn">
          Bosh sahifa
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted">Mock imtihon, challenge va battle faqat internet bilan ishlaydi — vaqt va natijalar serverda hisoblanadi.</p>
    </div>
  );
}
