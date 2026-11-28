# Milliy Mock — kengaytirish rejasi

## 1. Tahlil natijalari

| Soha | Hozirgi holat |
|---|---|
| Stack | Next.js 16.4 (App Router, Cache Components), React 19, Tailwind v4, Zod, Vitest. Hosting: Vercel |
| Baza | Supabase Postgres. Jadvallar: `subjects`, `exam_formats`, `profiles`, `user_roles`, `materials`, `material_keys`, `attempts`, `audit_logs` (faqat qo‘shiladi, o‘zgartirib/o‘chirib bo‘lmaydi), `rate_limits` |
| Xavfsizlik | Hamma jadvalda RLS yoqilgan. Nomzod faqat o‘z yozuvlarini o‘qiydi. Har qanday yozish server orqali, secret key bilan |
| Auth | Nomzodlar — Supabase Auth. Admin — alohida kod bilan kiradi va imzolangan `mm_admin` cookie oladi. `user_roles` jadvali bor, lekin hali ishlatilmaydi |
| Imtihon | HTML kitobcha (yopiq `booklets` bucket), raqamli javoblar varaqasi, server taymeri, Y1/Y2/O1 avtomatik tekshiriladi, O2 ni ekspert baholaydi, natija keyin e’lon qilinadi |
| Analitika | `attempts.grading` ichida mavzu va topshiriq turi bo‘yicha xom natijalar bor |
| Yaqinda qo‘shilganlar | 6 ta dizayn, `/intro` sahifasi, pullik testlar, Base44 agent, Telegram bildirishnomalari |
| **Savollar bazasi** | **Yo‘q.** Savollar faqat HTML kitobchalar ichida. Ammo barcha kitobchalar bir xil tuzilgan (`section.task#tN`, `p.q`, `ul.opts`), kalitda esa to‘g‘ri javob va mavzu bor |

**Asosiy qaror.** Haqiqiy savollar bazasini (`question_bank`) e’lon qilingan kitobchalar va ularning kalitlaridan **avtomatik** tuzamiz. Soxta ma’lumot ishlatilmaydi. Quyidagilar shu bazaga tayanadi:
- xatolar daftari;
- kunlik challenge;
- 1v1 battle;
- savol muhokamalari;
- mashq rejimi.

Admin savollarga tushuntirish (`explanation`) va qiyinlik darajasini keyin qo‘shishi mumkin.

**Siz kiritgan qoidalar o‘z kuchida:**
- har bir migratsiya avval sizga ko‘rsatiladi va faqat ruxsatingizdan keyin qo‘llanadi;
- mavjud ma’lumotlar o‘chirilmaydi;
- maxfiy kalitlar faqat env o‘zgaruvchilarida saqlanadi.

## 2. Bosqichlar

Har bir bosqich o‘z migratsiyasi, kodi, testlari va brauzerda tekshiruvi bilan alohida yetkaziladi.

| Bosqich | Modullar | Yangi jadvallar |
|---|---|---|
| **1 ✅** | Savollar bazasi, Xatolar daftari (1-3-7-14 kunlik takrorlash), Shaxsiy o‘quv reja, Kengaytirilgan analitika | `question_bank`, `student_mistakes`, `answer_events`, `study_plans`, `study_plan_tasks` |
| **2 ✅** | Kunlik challenge, XP, yutuqlar, reyting | `daily_challenges`, `challenge_attempts`, `xp_ledger` (bitta mukofot faqat bir marta beriladi — unique cheklov), `student_achievements`, `leaderboard_settings` |
| **3 ✅** | 1v1 Battle, do‘stlar va do‘stlar reytingi, O‘quv xonalari (Supabase Realtime) | `friendships`, `friend_codes`, `battles`, `battle_participants`, `battle_questions`, `battle_answers` (oxirgi ikkisi faqat server uchun), `study_rooms`, `study_room_members`, `study_room_messages` |
| 4 | Flashcards (SM-2), Video darslar, Savol muhokamalari va moderatsiya | `flashcard_decks`, `flashcards`, `flashcard_reviews`, `video_lessons`, `video_progress`, `discussions`, `discussion_replies`, `discussion_reports` |
| 5 | Mock sertifikatlar (PDF, QR, tekshirish sahifasi), Telegram bot (hisob ulash, buyruqlar, webhook) | `certificates`, `certificate_checks`, `telegram_links`, `notification_prefs`, `notification_log` |
| 6 | PWA va offline o‘qish, nomzod dashboardini qayta loyihalash, admin panelni kengaytirish, yakuniy optimizatsiya | — |

## 3. 1-bosqich tafsilotlari (bajarildi, 2026-11-28)

- **Savollar bazasi**
  - Admin "Savollar bazasini yangilash" tugmasini bosganda server e’lon qilingan kitobchalarni o‘qiydi.
  - Y1/O1 savollarining matni, variantlari, to‘g‘ri javobi va mavzusi bazaga yoziladi.
  - Matn tozalanadi: faqat xavfsiz teglar va rasmlar qoladi, skriptlar olib tashlanadi.
  - Jadvalda to‘g‘ri javoblar bor, shuning uchun unga RLS policy berilmaydi — faqat server o‘qiydi.
- **Xatolar daftari**
  - Natija tekshirilgach, noto‘g‘ri javoblar avtomatik yoziladi. Bir urinish ikki marta hisoblanmaydi (`answer_events` jadvalidagi primary key shuni kafolatlaydi).
  - Imkoniyatlar: belgilash (bookmark), shaxsiy izoh, "tushundim" belgisi, faqat xatolardan mashq.
  - Takrorlash jadvali: 1 → 3 → 7 → 14 kun. Uch marta ketma-ket to‘g‘ri javob berilsa, xato "hal qilingan" bo‘ladi.
  - Statistika: jami / hal qilingan / ochiq xatolar, eng qiyin fanlar, eng ko‘p takrorlangan xatolar.
- **O‘quv reja**
  - Reja AI’siz, aniq qoidalar asosida tuziladi. Kiruvchi ma’lumotlar: imtihon sanasi, kunlik vaqt, o‘qish kunlari, ustuvor mavzular, mavzular bo‘yicha haqiqiy natijalar, takrorlash vaqti kelgan xatolar.
  - Har 7-kun — haftalik baholash.
  - Rejani tahrirlash, to‘xtatish, qayta boshlash va qayta tuzish mumkin. O‘tkazib yuborilgan vazifalar aniqlanadi.
  - Ko‘rinishlar: taqvim, imtihongacha qolgan vaqt, ketma-ket o‘qish kunlari (streak).
- **Analitika**
  - Faqat haqiqiy urinishlar asosida.
  - Grafiklar: 7 va 30 kunlik natija, fanlar, mavzular, to‘g‘ri va noto‘g‘ri javoblar, bitta savolga sarflangan o‘rtacha vaqt.
  - Taqqoslashlar: oxirgi mock va undan oldingisi, hafta va o‘tgan hafta, oy va o‘tgan oy.
  - Ko‘rsatkichlar "xom natija / platforma bahosi" deb aniq belgilanadi, rasmiy ball sifatida ko‘rsatilmaydi.

## 4. 3-bosqich tafsilotlari (bajarildi, 2026-11-28)

- **Do‘stlar** (`/dostlar`)
  - Har bir nomzodda 8 belgili shaxsiy kod bor. Do‘st faqat shu kod orqali qo‘shiladi, email yoki Candidate ID bo‘yicha qidirib bo‘lmaydi.
  - Imkoniyatlar: so‘rov yuborish, qabul qilish, rad etish, olib tashlash, bloklash.
  - Do‘stlar reytingi shu haftadagi XP bo‘yicha tuziladi.
  - Ko‘rinadigan ism — nomzod o‘zi tanlagan ism. Tanlanmagan bo‘lsa, "Nomzod XXXX" deb ko‘rsatiladi.
- **1v1 Battle** (`/battle`)
  - Uch xil boshlash: tasodifiy raqib (fan bo‘yicha navbat), do‘stni chaqirish, 6 belgili kod.
  - Ikkala o‘yinchiga bir xil 7 ta haqiqiy savol beriladi, variantlar tartibi esa har biriga alohida.
  - Savollar ketma-ket, har biriga faqat bir marta javob beriladi. Server faqat joriy savolni yuboradi.
  - Raqib faqat qaysi savolda ekanini ko‘radi. Ball battle tugagandan keyin ochiladi.
  - G‘olib: ko‘proq to‘g‘ri javob bergan. Teng bo‘lsa — tezroq tugatgan.
  - XP: g‘alaba 15, durang 8, ishtirok 5. Faqat savollarning kamida yarmiga javob berilsa beriladi, har bir battle uchun bir marta.
  - Hech kim qo‘shilmagan battle 10 daqiqada yopiladi. Vaqti tugagan battle’ni server o‘zi yakunlaydi.
- **O‘quv xonalari** (`/xonalar`)
  - Xonaga faqat taklif kodi bilan kiriladi. Nomzod ko‘pi bilan 5 ta xona ochishi va 20 ta xonada bo‘lishi mumkin.
  - Ichida: chat (oddiy matn), kim onlayn ekani, umumiy pomodoro taymer (25 daqiqa o‘qish / 5 daqiqa tanaffus).
  - Xona egasi a’zoni cheklashi yoki chiqarishi, xabarni yashirishi mumkin. Egasi chiqib ketsa, egalik eng eski a’zoga o‘tadi.
- **Admin → "Battle va xonalar"**
  - Statistika: battle’lar soni va turlari, do‘stliklar soni.
  - Moderatsiya: xonani yoki xabarni yashirish va qaytarish. Har bir amal audit jurnaliga yoziladi.
- **Realtime.** Raqibning holati, battle boshlanishi va yangi xabarlar Supabase Realtime orqali keladi, RLS bunda ham amal qiladi. Ulanish uzilsa, sahifa o‘zi qayta so‘rov yuborib turadi.

## 5. Cheklovlar va tashqi sozlamalar

- **Realtime (3-bosqich).** Supabase Realtime (`postgres_changes`) RLS bilan ishlatiladi. Ballni faqat server hisoblaydi. Kim onlayn ekani har 20 soniyada yangilanib turadi.
- **Video.** Katta fayllar Vercel’da saqlanmaydi. YouTube yoki Vimeo havolalari, yoki Supabase Storage ishlatiladi.
- **Sertifikat PDF va QR.** Ikkita kichik kutubxona qo‘shish taklif qilinadi: `pdf-lib`, `qrcode`. Bular rasmiy davlat sertifikati emas, platforma bergan **mock natija sertifikati** ekani har bir sertifikatda yoziladi.
- **Telegram bot.** Mavjud `TELEGRAM_BOT_TOKEN` ishlatiladi va yangi `TELEGRAM_WEBHOOK_SECRET` qo‘shiladi. Webhook Vercel domenida ishlaydi.
- **Hajm.** Barcha bosqichlar juda katta ish. Har bir bosqich alohida yetkazilib, sinab ko‘rilgandan keyingina keyingisiga o‘tiladi.
