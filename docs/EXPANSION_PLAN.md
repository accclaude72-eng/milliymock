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
| **4 ✅** | Flashcards (SM-2), Video darslar, Savol muhokamalari va moderatsiya | `flashcard_decks`, `flashcards`, `flashcard_reviews`, `video_lessons`, `video_progress`, `discussions`, `discussion_replies`, `discussion_reports` |
| **5 ✅** | Mock sertifikatlar (PDF, QR, tekshirish sahifasi), Telegram bot (hisob ulash, buyruqlar, webhook, ertalabki eslatma) | `certificates`, `certificate_checks`, `telegram_links`, `telegram_link_codes`, `notification_prefs`, `notification_log` |
| **6 ✅** | PWA va offline o‘qish, nomzod dashboardini qayta loyihalash, admin panelni kengaytirish, yakuniy optimizatsiya | — |

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

## 5. 4-bosqich tafsilotlari (bajarildi, 2026-11-28)

- **Flashcards** (`/kartalar`)
  - SM-2 algoritmi: “Qayta / Qiyin / Yaxshi / Oson” tugmalari, har birida keyingi takrorlash muddati ko‘rsatiladi. Klaviatura bilan ham ishlaydi: Probel — kartani ochish, 1–4 — baho.
  - Har bir to‘plamdan kuniga ko‘pi bilan 20 ta yangi karta beriladi. Takrorlash holati faqat nomzodning o‘ziga ko‘rinadi.
  - To‘plam turlari:
    - nomzodning o‘z to‘plamlari — ommaviy qo‘shish mumkin (har qatorda “savol | javob”);
    - rasmiy to‘plamlar — admin yaratadi, e’lon qilingach hammaga ko‘rinadi;
    - “Xatolarim” — xatolar daftaridan avtomatik tuziladi (faqat javoblari ochiq testlardan); hal qilingan xato to‘plamdan chiqadi.
- **Video darslar** (`/videolar`)
  - Video saytga yuklanmaydi: admin YouTube yoki Vimeo havolasini qo‘shadi. Pleyer `youtube-nocookie` orqali ochiladi.
  - Darslar fan va mavzu bo‘yicha guruhlanadi, nomzod “Ko‘rdim” deb belgilaydi.
  - Admin darsni qoralama, e’lon qilingan yoki arxiv holatiga o‘tkazadi va har bir darsni nechta nomzod ko‘rganini kuzatadi.
- **Savol muhokamalari** (`/muhokama/[savol]`, xatolar daftaridan havola)
  - Javoblar oshkor bo‘lmasligi uchun muhokama faqat shu savolga javob bergan nomzodga ochiladi.
  - Imkoniyatlar:
    - mavzu ochish va unga javob yozish;
    - “Foydali” ovozi (o‘z xabariga ovoz berib bo‘lmaydi);
    - o‘z xabarini 30 daqiqa ichida tahrirlash va o‘chirish;
    - shikoyat qilish (bitta nomzod bitta xabarga bir marta).
  - Admin moderatsiyasi: xabarni yashirish yoki qaytarish, shikoyatni rad etish. Har bir amal audit jurnaliga yoziladi.
- **Jadvallar va RLS.** Kontent jadvallarini faqat server o‘qiydi. Nomzod faqat o‘z takrorlash holatini, video progressini va ovozlarini ko‘radi.
- **Biologiya testlari.** Diagnostik format `biologiya-2026-ab` qo‘shildi: 36–55-topshiriqlar 10 ta masalaning a) va b) qismlari. Admin material yaratishda fanning boshqa format versiyasini tanlay oladi. Uchta yangi test qoralama sifatida yuklandi.

## 6. 5-bosqich tafsilotlari (bajarildi, 2026-11-28)

- **Sertifikatlar** (`/kabinet/sertifikatlar`)
  - Faqat e’lon qilingan **to‘liq** mock natijasiga beriladi. Har bir urinish uchun bitta sertifikat — parallel so‘rovlarda ham.
  - PDF (A4) so‘rov bo‘yicha yaratiladi va hech qayerda saqlanmaydi. Unda quyidagilar bor:
    - seriya `MM-YYYY-XXXXXX`;
    - xom ball va “platforma bahosi”;
    - tekshirish sahifasiga olib boradigan QR kod;
    - “rasmiy davlat sertifikati emas” degan ogohlantirish.
- **Ochiq tekshirish** (`/sertifikat/[kod]`, kirishsiz)
  - Ism qisqartiriladi (“Shohrux M.”). Email va Candidate ID ko‘rsatilmaydi.
  - Har bir tekshiruv jurnalga yoziladi (IP faqat xesh ko‘rinishida). Bir IP’dan soatiga ko‘pi bilan 60 ta tekshiruv.
- **Bekor qilish**
  - Admin natijani qayta tekshiruvga olsa, sertifikat avtomatik bekor bo‘ladi.
  - Admin sertifikatni sabab yozib bekor qilishi yoki tiklashi mumkin; har bir amal audit jurnaliga yoziladi.
- **Telegram bot**
  - Hisobni ulash: Kabinet → Bildirishnomalar → “Telegramni ulash”. Bir martalik havola 15 daqiqa amal qiladi. Bitta Telegram chat faqat bitta hisobga ulanadi.
  - Buyruqlar: /natija, /challenge, /reja, /xatolar, /xp, /sertifikat, /sozlamalar, /uzish, /yordam.
  - Webhook faqat `TELEGRAM_WEBHOOK_SECRET` bilan qabul qilinadi.
- **Bildirishnomalar**
  - Qachon keladi: natija e’lon qilinganda, sertifikat tayyor bo‘lganda, do‘st battle’ga chaqirganda va har kuni ertalab 08:00 da (Vercel Cron, `CRON_SECRET`) — challenge, reja va xatolar haqida.
  - Nomzod xabar turlarini va “jim soatlar”ni o‘zi sozlaydi.
  - Har bir xabar faqat bir marta yuboriladi. Botni bloklagan nomzodning ulanishi o‘zi uziladi.
- **Kerakli env o‘zgaruvchilari (Vercel)**
  - `TELEGRAM_BOT_TOKEN` — allaqachon bor.
  - `TELEGRAM_WEBHOOK_SECRET` — yangi.
  - `CRON_SECRET` — yangi.
  - Kiritgach, admin → “Sertifikat va bot” sahifasida “Webhookni o‘rnatish” tugmasi bosiladi.

## 7. 6-bosqich tafsilotlari (bajarildi, 2026-11-28)

- **PWA**
  - Saytni telefon yoki kompyuterga ilova sifatida o‘rnatish mumkin. Uning manifesti, ikonkalari (maskable ham) va tezkor havolalari bor: Challenge, Flashcards, Xatolar.
  - Kabinetda “Ilovani o‘rnatish” tugmasi bor.
- **Oflayn ishlash** (`public/sw.js`)
  - Avval ochilgan sahifalar internetsiz ham ochiladi.
  - Ochilmagan sahifa so‘ralsa, `/offline` sahifasi ko‘rsatiladi.
  - Quyidagilar **hech qachon** keshlanmaydi: `/api`, admin panel, imtihon, challenge va battle sahifalari.
  - Internet yo‘qligida sahifa tepasida banner chiqadi.
- **Oflayn flashcards**
  - To‘plamni “Oflayn uchun saqlash” mumkin; u qurilmada `/kartalar/oflayn` sahifasida takrorlanadi.
  - Oflayn baholar navbatga yoziladi va internet qaytganda serverga yuboriladi. Tarmoq xatosida navbatda qoladi, o‘chirilgan karta esa tashlab yuboriladi.
- **Nomzod dashboardi.** Yangi “Bugun” bloki: streak, XP, bugungi challenge, reja, takrorlanadigan xatolar va kartalar, battle takliflari, tezkor havolalar. Hammasi bitta API so‘rovida, parallel o‘qiladi.
- **Admin bosh sahifasi**
  - “Diqqat talab qiladi”: tekshiruv navbati, to‘lovlar, shikoyatlar, shubhali urinishlar va qoralamalar soni.
  - Barcha o‘quv modullari bo‘yicha 7 kunlik faollik.
- **Optimizatsiya.** Battle takliflarida ismlar endi bitta so‘rovda olinadi. Dashboard yig‘ma API’si `/api/me/dashboard`, admin uchun esa `/api/admin/overview`.

## 8. Cheklovlar va tashqi sozlamalar

- **Realtime (3-bosqich).** Supabase Realtime (`postgres_changes`) RLS bilan ishlatiladi. Ballni faqat server hisoblaydi. Kim onlayn ekani har 20 soniyada yangilanib turadi.
- **Video.** Katta fayllar Vercel’da saqlanmaydi. YouTube yoki Vimeo havolalari, yoki Supabase Storage ishlatiladi.
- **Sertifikat PDF va QR.** Ikkita kichik kutubxona qo‘shish taklif qilinadi: `pdf-lib`, `qrcode`. Bular rasmiy davlat sertifikati emas, platforma bergan **mock natija sertifikati** ekani har bir sertifikatda yoziladi.
- **Telegram bot.** Mavjud `TELEGRAM_BOT_TOKEN` ishlatiladi va yangi `TELEGRAM_WEBHOOK_SECRET` qo‘shiladi. Webhook Vercel domenida ishlaydi.
- **Hajm.** Barcha bosqichlar juda katta ish. Har bir bosqich alohida yetkazilib, sinab ko‘rilgandan keyingina keyingisiga o‘tiladi.
