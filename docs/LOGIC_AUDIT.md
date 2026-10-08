# MN Hospital mantiqiy oqim auditi — 2026-10-08

Tekshirilgan checkout: sana → faol xizmat/shifokor → backenddagi bo‘sh vaqt → cash yoki haqiqiy Eximbay sandbox → saqlangan appointment. Patient tibbiy profilini majburan to‘ldirmaydi, xona tanlamaydi va to‘lovdan keyin yana appointment yaratmaydi.

## Tuzatilgan nomutanosibliklar

| Oldingi holat | Hozirgi holat |
| --- | --- |
| Booking, payment va appointment alohida qo‘lda yaratilardi | Bitta checkout order, payment va doctor xonasidagi appointmentni bog‘laydi |
| Yangi hisobda tibbiy profil bo‘lmasa booking ishlamasdi | Tasdiqlangan faol patient uchun minimal tibbiy profil avtomatik yaratiladi; noma’lum klinik ma’lumot yozilmaydi |
| Bir vaqtni parallel so‘rovlar band qilishi mumkin edi | Doctor, patient va xona daqiqalari uchun unique indeks va qayta availability tekshiruvi |
| Xona mavjud bo‘lmasa ham bo‘sh vaqt chiqardi | Doctorning mavjud assigned xonasi bo‘lmasa slot ro‘yxati bo‘sh; paymentdan oldin ham availability tekshiriladi |
| Pul va vaqt ayrim sahifalarda KRW/browser va backendda UZS edi | Server konfiguratsiyasidagi currency/timeZone katalog va checkout/listlarga yetkaziladi |
| Qayta bosish yangi payment yaratishi mumkin edi | Owned idempotency key va har bir booking satri uchun bitta faol payment |
| Online to‘lovsiz qabulni staff tasdiqlashi mumkin edi | Online appointmentni tasdiqlash/boshlash uchun backenddagi PAID talab qilinadi |
| Cancel booking appointmentni band holda qoldirardi | Pending payment, appointment va tegishli faol reception tasklari birga bekor qilinadi |
| Tugagan barcha qabullar orderni tugatmasdi | Barcha appointments COMPLETED bo‘lsa to‘langan order COMPLETED bo‘ladi |
| Xizmat inactive bo‘lgandan keyin doctor qayta faollashtira olmasdi | Egasi o‘chirilmagan xizmatni specialty qoidalari asosida qayta faollashtira oladi |
| Backend ishlamasa demo xizmat/maqola ko‘rinardi | Real katalog yoki aniq empty/error holati; demo xizmatni bron qilish mumkin emas |
| Home 150+ doctor va 99% satisfactionni statik ko‘rsatardi | Backenddagi xizmat, doctor va maqola soni; klinika vaqt zonasi |
| Footer 119 yozib 103 raqamiga qo‘ng‘iroq qilardi | Ko‘rinadigan raqam va telefon havolasi 119ga moslashtirildi |
| Revoked session public katalogni ham to‘sardi | Public so‘rov guest sifatida qayta o‘qiladi; private API guardlari saqlanadi |

## Loyiha bo‘ylab tekshiruv xaritasi

| Modul | Tekshirilgan shartlar va dalil |
| --- | --- |
| Auth va role profillari | Public signup PATIENT; role/session holati qayta tekshiriladi; session rotation/logout/password/contact, auth integration va frontend session tekshiruvlari |
| Patient | Medical profile accountdan alohida; owned queries; nullable medical fields; blocked/deleted profile qayta yaratilmasligi |
| Doctor, department, service, room | Specialty mosligi, service ownership/reactivation, assigned room, faol public catalog; mavjud specialty/room/detail testlari |
| Schedule, booking, appointment | Klinika sanasi, ish oralig‘i/break, duration, snapshot, overlap, concurrent slot claim, expiry, cancel va clinical status transitions |
| Payment | Server amount/order/currency; real test gateway; verified callback/retrieve; cash staff tasdig‘i; foreign owner, manual online PAID taqiqi, retry |
| Reception queue | Task claim/status/ownership regressiyalari; appointment cancel tasklarni yopadi; optimistic concurrency |
| Medical reports | Doctor/patient owned report queries, role va file access uchun mavjud security integration testlari |
| Messaging, websocket, guest chat | Participants va role/profile identity; save-before-broadcast va private/guest boundary regressiyalari |
| Notifications/preferences | Receiver role/profile ownership; internal event triggers va owned preferences regressiyalari |
| Article, ads, follow/like/comment | Public/status filtering, author/self ownership va counters mavjud implementatsiyasi ko‘rildi; article/ads/follow workspace tekshiruvlari. Counters reconciliation alohida kuzatuv talab qiladi |
| Admin/dashboard | Staff/account management role chegaralari, public accountdan ajralishi va mavjud access/dashboard integration testlari |
| Upload/AI | Stream upload/security regressiyalari; AI public catalog projection/provider failure testlari. Yangi live AI so‘rovi bu payment ishida bajarilmadi |
| Frontend/API | Barcha eksport qilingan GraphQL hujjatlari running API schemasiga validatsiya qilindi; backend/frontend builds va UI sandbox oynasi tekshirildi |

Mavjud regressiya suite testlarining ko‘pi fixture/mocked storage ishlatadi. Yangi checkout persistence suite to‘liq AppModule, haqiqiy GraphQL, signup/session/guards/ValidationPipe va ajratilgan MongoDB bazasini ishlatadi. Bu dalillar barcha ishlab chiqarish holatlarida xatosizlikning 100% kafolati emas.

## To‘lov provayderi tanlovi

Eximbay tanlandi: hospitalda mavjud test merchant va integratsiya bor, ready API haqiqiy test serverida ishladi. MNShop Toss TOSS_MOCK_MODE=true holatida; uning getTestSecretKey funksiyasidagi startsWith('') tekshiruvi live keyni bloklamaydi. Bu kod hospitalga ko‘chirilmadi.

EXIMBAY_TEST_QOLLANMA.md texnik reference sifatida o‘qildi. Hujjatdagi v2 SDK o‘rniga amaldagi rasmiy v3 SDK ishlatildi. Hospital runtime test_ key va api-test.eximbay.com bilan qat’iy cheklanadi. .env.example default sandbox; simulated faqat maxsus automated development testlarida va productionda bloklangan.

UZS va KRW ready so‘rovlari HTTP 200/rescode 0000/fgkey qaytardi. UZS checkout provayder oynasi ND08 rad javobini ko‘rsatdi; ready javobi to‘lov usulining yakuniy ishlash kafolati emas. KRW bilan haqiqiy merchant karta formasi ochildi. Hospital lokal .env va example KRW/Asia/Seoulga moslandi. Yakuniy approval Eximbay Terms/Privacy Policy uchun foydalanuvchi tasdig‘ini kutmoqda. 363 regressiya + 12 haqiqiy MongoDB checkout testi, 107 GraphQL hujjati, 25 frontend session check va ikkala build o‘tdi.

## Konfiguratsiya va qolgan chegaralar

- BASE_URL Eximbay status webhook uchun tashqaridan ochiladigan API manzil bo‘lishi kerak; localhostga gateway serveri kira olmaydi. Browser return localhostda ishlashi mumkin.
- Hozirgi indeks migratsiyasi faqat configured development bazasida optional patientIdNumber unique+sparse indeksini tuzatdi. Yangi deploymentda unique slot/order/payment indekslari yaratilishini tekshirish kerak.
- Avvalgi appointmentlar oddiy overlap so‘rovida hisobga olinadi; ularda yangi slotKeys indeksi yo‘q. Eski yozuvlar uchun backfill va bir necha API instance bilan aralash legacy traffic sinovi alohida migration talab qiladi.
- To‘langan bronni bekor qilish pulni qaytarmaydi: refund endpoint bu ishga kiritilmagan. PAID tarixi saqlanadi. Sandboxda real pul yechilmaydi.
- Payment hold tugagandan keyin kelgan kech gateway to‘lovi PAID tarixini saqlaydi, ammo eski slot avtomatik qayta egallanmaydi; reception orqali boshqa vaqt kerak bo‘lishi mumkin. Gatewayni ochishdan oldin hold qayta tekshiriladi.
- Static About/Contact/hero matnlari tahririy kontentdir; klinikaning manzili, telefon, ish soati va yutuqlari egasi tomonidan tasdiqlanishi kerak. Home sonlari endi databasega bog‘langan.
- bookmed.uz reference so‘raldi, ammo ushbu muhitda sahifa timeout/DNS tufayli ochilmadi. Oqim user ko‘rsatgan sodda sana/xizmat/to‘lov talabi bo‘yicha qurildi; saytga aynan tengligi da’vo qilinmaydi.
