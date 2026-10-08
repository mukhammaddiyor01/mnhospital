# Doctor xizmat sanalarini rejalashtirish

Xizmat create/edit formasida **Service dates / Xizmat sanalari / 서비스 날짜** kalendari bor:

- **Haftalik jadval**: sana cheklovi yo‘q, mavjud doctor ish jadvali amal qiladi.
- **Kunlarni tanlash**: bir yoki bir nechta oyda, masalan 13, 15, 18 kunlarini tanlash mumkin. Oy navigatsiyasi va shu oyning kelajak kunlarini bir bosishda qo‘shish bor.
- **Muddat oralig‘i**: boshlanish va tugash sanasi kiritiladi, ikkala chegara ham kiradi. Bir oy yoki boshqa istalgan muddatni, jami 366 kungacha tanlash mumkin.

Sanalar bitta Service hujjatining `availabilityDates: [YYYY-MM-DD]` maydonida saqlanadi. Bir kun uchun alohida xizmat yoki serviceType limiti sarflanmaydi. Bo‘sh ro‘yxat/eskidan maydoni yo‘q xizmat haftalik jadvalga qaytadi. Null, takroriy, noto‘g‘ri kalendar sanalari va 366 tadan ko‘p sana API tomonidan rad etiladi. Sana klinika vaqt zonasida talqin qilinadi; UTC konvertatsiyasi kalendardagi kunni siljitmaydi.

Bu tanlov doctor ish jadvalini almashtirmaydi. Doctorning mavjud haftalik ish vaqti bo‘lishi kerak; tanlangan sananing haftalik jadvali inactive/yo‘q bo‘lsa slot chiqmaydi. Patient slotlari quyidagi kesishmadan olinadi: tanlangan xizmat sanalari, doctorning faol ish vaqti, tanaffus, xizmat davomiyligi, mavjud appointmentlar va mavjud xona. Eski openedAt/closedAt vaqt chegaralari ham to‘liq slotga qo‘llanadi; yopilish boshlanishdan keyin bo‘lishi shart.

Public `getAvailableDoctorSlots`, patient `createAppointmentBooking` va appointment yaratish bir xil schedule xizmatidan foydalanadi. Tanlanmagan sanaga qo‘lda API so‘rovi yuborish bron yaratmaydi. Yaratish va doctor/admin tahrirlash mavjud resolver → service → Mongoose, specialty, ownership, xizmat statusi va type limiti qoidalarini saqlaydi. Sanalar tahriri ilgari yaratilgan appointment/paymentlarni o‘chirmaydi yoki o‘zi bekor qilmaydi; yangi bookingga yangi cheklov qo‘llanadi.

EN/KR/UZ labels, keyboard bilan bosiladigan kalendar kunlari, tanlangan holat, o‘tgan kunlarni UI’da bloklash va ixcham sana ro‘yxati bor. Yangi kutubxona yoki DB migratsiyasi kerak emas.

Tekshiruv: 375 backend regressiya testi; 13 to‘liq API + alohida MongoDB persistence testi; 8 kalendar yordamchisi testi (sakrash yili, oy chegarasi, 366 kun); 107 frontend GraphQL operatsiyasi, 0 nomutanosib kontrakt; backend/frontend build. Brauzerda 13/15/18 va oyni tanlash tekshirildi. `node scripts/verify-service-calendar.cjs`, `npm test -- --runInBand --watchman=false`, `node scripts/verify-checkout-persistence.cjs .env` bilan qayta tekshirish mumkin. Persistence skripti faqat yangi test bazasini yaratib tozalaydi.
