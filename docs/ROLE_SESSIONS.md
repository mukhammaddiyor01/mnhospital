# Bir brauzerda to‘rtta mustaqil rol

Patient, doctor, receptionist va admin bir brauzer profilida alohida tablarda parallel ishlashi mumkin. Har bir tabdagi akkaunt o‘zining `sessionStorage` access JWT’si bilan ishlaydi. Sahifani yangilash va shu tab ichidagi navigatsiya akkauntni saqlaydi. Yangi mustaqil tab guest bo‘lib boshlanadi: tegishli rolning login sahifasida kiring.

- Patient: `/account/signin`
- Doctor: `/account/doctor-signin`
- Receptionist: `/account/receptionist-signin`
- Admin: `/account/admin-signin`

Backend `X-MN-Session-Role` orqali faqat PATIENT, DOCTOR, RECEPTIONIST yoki ADMIN nomli cookie’ni tanlaydi. Har bir rolning refresh siri alohida host-only HttpOnly cookie’da: `mn-hospital-refresh-patient`, `-doctor`, `-receptionist`, `-admin`. Production Secure/SameSite va mavjud origin/preflight talablari saqlanadi. Header ruxsat yoki yangi rol bermaydi: barcha xizmatlar tasdiqlangan JWT, session va profil orqali mavjud ownership/role tekshiruvlarini bajaradi. GraphQL operatsiyalari o‘zgarmagan; header’siz eski API mijozlari eski cookie bilan ishlaydi.

Har bir brauzer profilida har rol uchun bitta faol akkaunt bor. Masalan, boshqa doctor akkauntiga kirish shu brauzerdagi oldingi doctor sessiyasini almashtiradi; patient/receptionist/admin sessiyalari saqlanadi. Bir rol uchun ko‘p mustaqil akkaunt kerak bo‘lsa, alohida brauzer profillaridan foydalaning. Tabni duplicate qilish yoki opener orqali ochish brauzer qoidasi bo‘yicha ayni tab tokenini nusxalashi mumkin; bunday tab ayni akkauntning ikkinchi ko‘rinishidir. Boshqa rolga kirish uning tokenini shu tabda almashtiradi.

Refresh JavaScript’ga sirni bermaydi va boshqa akkauntga yashirincha o‘tmaydi: scoped refresh uchun imzolangan access JWT (muddati tugagan bo‘lsa ham) kerak. Cookie’dagi session ID, owner ID va rol o‘sha JWT bilan mos kelishi shart. Eski tabning refresh/logout so‘rovi yangi shu-rol akkauntining cookie’sini aylantirmaydi, o‘chirmaydi yoki sessiyasini bekor qilmaydi. Logout faqat tegishli sessionni bekor qiladi. Password o‘zgarishi mavjud loyiha qoidasi bo‘yicha o‘sha akkauntning barcha eski sessiyalarini bekor qiladi.

Apollo va React Query har bir tabning JavaScript muhitida alohida. Login o‘zgarganda yoki logout bo‘lganda owned cache tozalanadi, eski akkauntdan kechikkan javoblar rad etiladi. Refresh davomida tab boshqa rolga o‘tsa ham eski javob yangi akkauntni tiklamaydi yoki o‘chirmaydi. localStorage’da access/refresh credential saqlanmaydi; faqat rol/session ID bo‘yicha login/logout signali bor. Signallar boshqa rol tablariga ta’sir qilmaydi. Web Locks ayni rol cookie’sining login/refresh/logout amallarini navbatga qo‘yadi; turli rollar mustaqil ishlaydi. Web Locks mavjud bo‘lmagan brauzerda bitta tab ichidagi parallel refreshlar birlashtiriladi; ayni sessiyadan ko‘p tabda bir paytda refresh qilish backend replay himoyasi sabab qayta loginni talab qilishi mumkin.

Yangi tabni yoki yopib qayta ochilgan brauzerni eski umumiy localStorage tokeni bilan avtomatik login qilish yo‘q. Yangilanishdan keyin har rolga bir marta qayta kiring. Ochiq tabda reload sessiyani tiklaydi; yopilgan tabning storage’i brauzer tomonidan tugatilsa qayta kirish kerak. Brauzer session-restore mavjud bo‘lsa ayni tabni tiklashi mumkin. Cookie muddati mavjud 30 kun, JWT 15 daqiqa. Ma’lumotlar bazasiga migratsiya kerak emas.

## Tekshiruv

Frontend `npm run test:auth` tab tokenlari, scoped signallar, roldan mustaqil login headeri, refresh/logout race, account switch va late response himoyalarini tekshiradi.

Backend `npm test -- --runInBand --watchman=false auth` cookie selektori, HttpOnly/security, origin, identity/ownership, refresh rotation/replay va mavjud account oqimlarini tekshiradi. `node scripts/verify-auth-access.cjs` alohida yaratilgan MongoDB bazasida haqiqiy GraphQL API orqali barcha to‘rt cookie’ni bitta cookie jar’da login/refresh/logout qiladi, same-role replacement va eski tab himoyasini tekshiradi. Faqat shu test bazasi tozalanadi; haqiqiy klinika hujjatlari o‘zgarmaydi.
