import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { WsAdapter } from '@nestjs/platform-ws';
import { Connection, Model, Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/components/auth/auth.service';
import { MemberType } from '../src/components/member/enums/member.enum';
import { clinicDate } from '../src/libs/booking/clinic-time';

// Opt in with a Mongo URI. Never uses or drops the configured application database.
const persistence = process.env.MN_CHECKOUT_TEST_URI ? describe : describe.skip;
persistence('Patient checkout with the complete API and real Mongo persistence', () => {
	jest.setTimeout(60000);
	const databaseName = `mn_flow_${new Types.ObjectId()}`;
	let app: INestApplication;
	let connection: Connection;
	let token: string;
	let otherToken: string;
	let doctorToken: string;
	let receptionToken: string;
	let adminToken: string;
	let serviceId: string;
	let doctorId: string;
	let roomId: string;
	let startsAt: string;
	let orders: Model<any>;
	let payments: Model<any>;
	let appointments: Model<any>;
	let patients: Model<any>;
	async function gql(query: string, variables = {}, bearer = token) {
		const req = request(app.getHttpServer()).post('/graphql').set('Apollo-Require-Preflight', 'true');
		if (bearer) req.set('Authorization', `Bearer ${bearer}`);
		const response = await req.send({ query, variables });
		return response.body;
	}
	const promoQuery = 'mutation($input:BookingPromoInput!){applyBookingPromoCode(input:$input){_id bookingOrderSubtotalAmount bookingOrderDiscountAmount bookingOrderTotalAmount serviceDiscountAmount promoDiscountAmount promoCode}}';
	const createQuery = 'mutation($input:AppointmentBookingInput!){createAppointmentBooking(input:$input){_id bookingOrderTotalAmount bookingOrderCurrency}}';
	const chooseQuery = 'mutation($input:BookingCheckoutInput!){chooseBookingPayment(input:$input){order{_id bookingOrderStatus}payments{_id paymentStatus paymentProvider testPayment}appointments{_id appointmentCode roomId holdExpiresAt}}}';
	const testQuery = 'mutation($input:TestOnlinePaymentInput!){completeTestOnlinePayment(input:$input){_id paymentStatus testPayment}}';
	async function booking(key = String(new Types.ObjectId()), time = startsAt, bearer = token) {
		const response = await gql(createQuery, { input: { serviceId, doctorId, requestedStartAt: time, idempotencyKey: key } }, bearer);
		expect(response.errors).toBeUndefined();
		return response.data.createAppointmentBooking;
	}
	async function choose(order: string, provider: string, bearer = token) {
		return gql(chooseQuery, { input: { bookingOrderId: order, paymentProvider: provider } }, bearer);
	}
	beforeAll(async () => {
		const uri = new URL(process.env.MN_CHECKOUT_TEST_URI);
		uri.pathname = `/${databaseName}`;
		process.env.MONGO_DEV = uri.toString();
		process.env.NODE_ENV = 'test';
		process.env.CLINIC_TIME_ZONE = 'Asia/Tashkent';
		process.env.CLINIC_CURRENCY = 'UZS';
		process.env.SECRET_TOKEN = 'checkout-persistence-fixture-secret';
		process.env.EXIMBAY_TEST_MODE = 'simulated';
		process.env.AI_CHAT_ENABLED = 'false';
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication({ logger: false });
		app.useWebSocketAdapter(new WsAdapter(app));
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();
		connection = app.get(getConnectionToken());
		expect(connection.name).toBe(databaseName);
		await Promise.all(connection.modelNames().map((name) => connection.model(name).init()));
		orders = app.get(getModelToken('BookingOrder'));
		payments = app.get(getModelToken('Payment'));
		appointments = app.get(getModelToken('Appointment'));
		patients = app.get(getModelToken('Patient'));
		const auth = app.get(AuthService);
		const password = await auth.hashPassword('TestPassword123');
		const doctor = await app.get(getModelToken('Doctor')).create({ docNick: 'checkout-doctor', docPassword: password, docPhone: '+998900001001', docFullName: 'Checkout Test Doctor', docExperience: 5, docSpecialty: 'CARDIOLOGIST', docRoom: '101' });
		doctorId = String(doctor._id);
		const room = await app.get(getModelToken('Room')).create({ roomNumber: '101', roomType: 'CONSULTATION', assignedDoctorId: doctor._id });
		roomId = String(room._id);
		const receptionist = await app.get(getModelToken('Receptionist')).create({ receptionistNick: 'checkout-reception', receptionistPassword: password, receptionistPhone: '+998900001002', receptionistFullName: 'Checkout Test Reception', receptionistMail: 'checkout-reception@example.test' });
		doctorToken = (await auth.startSession(doctor)).accessToken;
		receptionToken = (await auth.startSession(receptionist)).accessToken;
		const admin = await app.get(getModelToken('Admin')).create({ adminNick: 'promo-admin', adminPassword: password, adminPhone: '+998900009999', adminMail: 'promo-admin@example.test' });
		adminToken = (await auth.startSession(admin)).accessToken;
		const service = await app.get(getModelToken('Service')).create({ memberId: doctor._id, departmentId: new Types.ObjectId(), serviceType: 'CONSULTATION', serviceName: 'Test consultation', serviceTitle: 'Test consultation', serviceRoomName: 'CONSULTATION', serviceRoom: 'ROOM101', servicePrice: 150000, serviceDuration: '30', serviceImages: [], serviceDesc: 'Isolated test consultation' });
		serviceId = String(service._id);
		const future = new Date(Date.now() + 7 * 86400000);
		const date = clinicDate(future);
		startsAt = new Date(`${date}T09:00:00+05:00`).toISOString();
		await app.get(getModelToken('DoctorSchedule')).create({ doctorId: doctor._id, weekday: new Date(`${date}T12:00:00Z`).getUTCDay(), startTime: '09:00', endTime: '18:00', slotDurationMinutes: 30, isActive: true });
		for (let n = 1; n <= 2; n++) {
			const signup = await gql('mutation($input:MemberInput!){signup(input:$input){_id accessToken}}', { input: { memberNick: `checkout-patient-${n}`, memberPassword: 'TestPassword123', memberPhone: `+99890000100${n + 2}` } }, '');
			expect(signup.errors).toBeUndefined();
			if (n === 1) token = signup.data.signup.accessToken; else otherToken = signup.data.signup.accessToken;
		}
	});
	afterEach(async () => {
		if (!connection || !orders) return;
		await app.get(getModelToken('Service')).updateOne({ _id: serviceId }, { $set: { servicePrice: 150000, serviceDiscountPercent: 0 } });
		await app.get(getModelToken('PromoCode')).deleteMany({});
		await Promise.all([orders.deleteMany({}), payments.deleteMany({}), appointments.deleteMany({}), app.get(getModelToken('Cart')).deleteMany({}), app.get(getModelToken('CartItem')).deleteMany({})]);
	});
	afterAll(async () => {
		try { if (connection?.name === databaseName && /^mn_flow_[a-f\d]{24}$/.test(databaseName)) await connection.dropDatabase(); }
		finally { await app?.close(); }
	});
	it('books for a newly signed-up patient without fabricated clinical details or consuming their active cart', async () => {
		const order = await booking('first-owned-booking');
		expect(order).toMatchObject({ bookingOrderTotalAmount: 150000, bookingOrderCurrency: 'UZS' });
		const profile = await patients.findOne({});
		expect(profile.patientBloodType).toBeUndefined();
		expect(profile.patientIdNumber).toBeUndefined();
		const cart = await app.get(getModelToken('Cart')).create({ patientId: profile._id, cartStatus: 'ACTIVE', currency: 'UZS', totalAmount: 700 });
		const retry = await booking('first-owned-booking');
		expect(retry._id).toBe(order._id);
		expect(await orders.countDocuments()).toBe(1);
		expect((await app.get(getModelToken('Cart')).findById(cart._id)).cartStatus).toBe('ACTIVE');
	});
	it('saves cash appointment in the doctor assigned room, retains pending cash and lets reception confirm it', async () => {
		const order = await booking();
		const result = await choose(order._id, 'CASH');
		expect(result.errors).toBeUndefined();
		const state = result.data.chooseBookingPayment;
		expect(state.appointments).toHaveLength(1);
		expect(state.appointments[0].roomId).toBe(roomId);
		expect(state.payments[0].paymentStatus).toBe('PENDING');
		expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
		expect(await payments.countDocuments()).toBe(1);
		expect(await appointments.countDocuments()).toBe(1);
		const response = await gql('mutation($input:PaymentStatusInput!){updatePaymentStatus(input:$input){paymentStatus}}', { input: { paymentId: state.payments[0]._id, paymentStatus: 'PAID' } }, receptionToken);
		expect(response.errors).toBeUndefined();
		expect((await orders.findById(order._id)).bookingOrderStatus).toBe('CONFIRMED');
	});
	it('persists a simulated online success and the existing appointment, and accepts retries without another charge', async () => {
		const order = await booking();
		const response = await choose(order._id, 'EXIMBAY');
		expect(response.errors).toBeUndefined();
		const state = response.data.chooseBookingPayment;
		expect(state.appointments[0].holdExpiresAt).toBeTruthy();
		expect(state.payments[0].testPayment).toBe(true);
		const input = { paymentId: state.payments[0]._id, outcome: 'PAID' };
		expect((await gql(testQuery, { input })).errors).toBeUndefined();
		expect((await gql(testQuery, { input })).errors).toBeUndefined();
		expect((await appointments.findOne({})).holdExpiresAt).toBeUndefined();
		expect((await orders.findById(order._id)).bookingOrderStatus).toBe('CONFIRMED');
		expect(await payments.countDocuments()).toBe(1);
	});
	it.each(['FAILED', 'CANCELLED'])('releases an online reservation after %s and lets the same booking retry', async (outcome) => {
		const order = await booking();
		const first = await choose(order._id, 'EXIMBAY');
		expect(first.errors).toBeUndefined();
		const paymentId = first.data.chooseBookingPayment.payments[0]._id;
		expect((await gql(testQuery, { input: { paymentId, outcome } })).errors).toBeUndefined();
		expect((await appointments.findOne({})).appointmentStatus).toBe('CANCELLED');
		const retry = await choose(order._id, 'CASH');
		expect(retry.errors).toBeUndefined();
		expect(await appointments.countDocuments({ appointmentStatus: 'PENDING' })).toBe(1);
	});
	it('rejects foreign patients, staff booking writes and production test settlement', async () => {
		const order = await booking();
		expect((await choose(order._id, 'CASH', otherToken)).errors).toBeDefined();
		expect((await choose(order._id, 'CASH', doctorToken)).errors).toBeDefined();
		const chosen = await choose(order._id, 'EXIMBAY');
		expect(chosen.errors).toBeUndefined();
		process.env.NODE_ENV = 'production';
		try { expect((await gql(testQuery, { input: { paymentId: chosen.data.chooseBookingPayment.payments[0]._id, outcome: 'PAID' } })).errors).toBeDefined(); }
		finally { process.env.NODE_ENV = 'test'; }
	});
	it('rejects out-of-schedule booking and blocks concurrent patients from occupying the same time', async () => {
		const outside = new Date(new Date(startsAt).getTime() - 3600000).toISOString();
		expect((await gql(createQuery, { input: { serviceId, doctorId, requestedStartAt: outside, idempotencyKey: 'outside-schedule' } })).errors).toBeDefined();
		const first = await booking('parallel-patient-one');
		const second = await booking('parallel-patient-two', startsAt, otherToken);
		const responses = await Promise.all([choose(first._id, 'CASH'), choose(second._id, 'CASH', otherToken)]);
		expect(responses.filter((response) => !response.errors)).toHaveLength(1);
		expect(await appointments.countDocuments({ appointmentStatus: 'PENDING' })).toBe(1);
	});
	it('cancels appointment, pending payment and booking together, and restores the slot', async () => {
		const order = await booking();
		expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
		expect((await gql('mutation($id:String!){cancelBookingOrder(bookingOrderId:$id){bookingOrderStatus}}', { id: order._id })).errors).toBeUndefined();
		expect((await appointments.findOne({})).appointmentStatus).toBe('CANCELLED');
		expect((await payments.findOne({})).paymentStatus).toBe('CANCELLED');
		const next = await booking('new-after-cancellation');
		expect((await choose(next._id, 'CASH')).errors).toBeUndefined();
	});
	it('blocks unpaid online confirmation by staff and forbids cancellation once treatment starts', async () => {
		const order = await booking();
		const chosen = await choose(order._id, 'EXIMBAY');
		expect(chosen.errors).toBeUndefined();
		const appointmentId = chosen.data.chooseBookingPayment.appointments[0]._id;
		const statusQuery = 'mutation($input:AppointmentStatusInput!){updateAppointmentStatus(input:$input){appointmentStatus}}';
		expect((await gql(statusQuery, { input: { appointmentId, appointmentStatus: 'CONFIRMED' } }, doctorToken)).errors).toBeDefined();
		expect((await gql(testQuery, { input: { paymentId: chosen.data.chooseBookingPayment.payments[0]._id, outcome: 'PAID' } })).errors).toBeUndefined();
		for (const appointmentStatus of ['CONFIRMED', 'IN_PROGRESS']) expect((await gql(statusQuery, { input: { appointmentId, appointmentStatus } }, doctorToken)).errors).toBeUndefined();
		expect((await gql('mutation($id:String!){cancelBookingOrder(bookingOrderId:$id){bookingOrderStatus}}', { id: order._id })).errors).toBeDefined();
		for (const appointmentStatus of ['ENDED', 'COMPLETED']) expect((await gql(statusQuery, { input: { appointmentId, appointmentStatus } }, doctorToken)).errors).toBeUndefined();
		expect((await orders.findById(order._id)).bookingOrderStatus).toBe('COMPLETED');
	});
	it('uses the booking price snapshot even after catalog prices change', async () => {
		const order = await booking();
		const services = app.get(getModelToken('Service'));
		await services.updateOne({ _id: serviceId }, { $set: { servicePrice: 200000 } });
		try {
			expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
			expect((await payments.findOne({})).paymentAmount).toBe(150000);
		} finally { await services.updateOne({ _id: serviceId }, { $set: { servicePrice: 150000 } }); }
	});

	it('does not offer appointments when the doctor room is unavailable', async () => {
		const rooms = app.get(getModelToken('Room'));
		await rooms.updateOne({ _id: roomId }, { $set: { roomStatus: 'MAINTENANCE' } });
		try {
			const result = await gql('query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}', { input: { serviceId, doctorId, date: clinicDate(new Date(startsAt)) } });
			expect(result.errors).toBeUndefined();
			expect(result.data.getAvailableDoctorSlots).toEqual([]);
		} finally { await rooms.updateOne({ _id: roomId }, { $set: { roomStatus: 'AVAILABLE' } }); }
	});

	it('uses clinic wall time for slots and releases expired unpaid online holds', async () => {
		const slots = await gql('query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}', { input: { serviceId, doctorId, date: clinicDate(new Date(startsAt)) } });
		expect(slots.errors).toBeUndefined();
		expect(slots.data.getAvailableDoctorSlots[0].startsAt).toBe(startsAt);
		const order = await booking();
		expect((await choose(order._id, 'EXIMBAY')).errors).toBeUndefined();
		await appointments.updateOne({}, { $set: { holdExpiresAt: new Date(Date.now() - 60000) } });
		const afterExpiry = await gql('query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}', { input: { serviceId, doctorId, date: clinicDate(new Date(startsAt)) } });
		expect(afterExpiry.errors).toBeUndefined();
		expect(afterExpiry.data.getAvailableDoctorSlots[0].startsAt).toBe(startsAt);
	});
	it('persists doctor selected service dates and enforces them for public slots and real booking writes', async () => {
		const services = app.get<Model<any>>(getModelToken('Service'));
		const day = clinicDate(new Date(startsAt));
		const otherDay = clinicDate(new Date(new Date(startsAt).getTime() + 86400000));
		const update = 'mutation($input:ServiceUpdate!){updateService(input:$input){_id availabilityDates}}';
		const slotQuery = 'query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}';
		const slotInput = { input: { serviceId, doctorId, date: day } };
		try {
			const denied = await gql(update, { input: { _id: serviceId, availabilityDates: [day] } }, token);
			expect(denied.errors).toBeDefined();
			const saved = await gql(update, { input: { _id: serviceId, availabilityDates: [otherDay] } }, doctorToken);
			expect(saved.errors).toBeUndefined();
			expect((await services.findById(serviceId)).availabilityDates).toEqual([otherDay]);
			expect((await gql(slotQuery, slotInput, '')).data.getAvailableDoctorSlots).toEqual([]);
			expect((await gql(createQuery, { input: { serviceId, doctorId, requestedStartAt: startsAt, idempotencyKey: 'unselected-service-date' } })).errors).toBeDefined();
			const selected = await gql(update, { input: { _id: serviceId, availabilityDates: [day, otherDay] } }, doctorToken);
			expect(selected.errors).toBeUndefined();
			expect((await gql(slotQuery, slotInput, '')).data.getAvailableDoctorSlots[0].startsAt).toBe(startsAt);
			const order = await booking('selected-service-date');
			expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
			expect(await appointments.countDocuments()).toBe(1);
			for (const dates of [['2030-02-30'], [day,day], null]) {
				expect((await gql(update, { input: { _id: serviceId, availabilityDates: dates } }, doctorToken)).errors).toBeDefined();
			}
			const clear = await gql(update, { input: { _id: serviceId, availabilityDates: [] } }, doctorToken);
			expect(clear.errors).toBeUndefined();
			expect((await services.findById(serviceId)).availabilityDates).toEqual([]);
			expect(await appointments.countDocuments()).toBe(1); // Existing booked appointments are preserved.
		} finally { await services.updateOne({ _id: serviceId }, { $set: { availabilityDates: [] } }); }
	});


 it('allows only admin discount and promo CRUD, normalizes codes and archives removal', async () => {
  const mutation = 'mutation($input:PromoCodeInput!){createPromoCodeByAdmin(input:$input){_id code currency}}';
  const input = { code: ' visit10 ', discountType: 'PERCENT', discountValue: 10, isActive: true };
  for (const bearer of [token, doctorToken, receptionToken, '']) expect((await gql(mutation, { input }, bearer)).errors).toBeDefined();
  const created = await gql(mutation, { input }, adminToken); expect(created.errors).toBeUndefined();
  expect(created.data.createPromoCodeByAdmin.code).toBe('VISIT10');
  const id = created.data.createPromoCodeByAdmin._id;
  expect((await gql(mutation, { input }, adminToken)).errors).toBeDefined();
  const updated = await gql('mutation($input:PromoCodeUpdate!){updatePromoCodeByAdmin(input:$input){discountValue}}', { input: { ...input, code: 'VISIT10', _id: id, discountValue: 15 } }, adminToken);
  expect(updated.data.updatePromoCodeByAdmin.discountValue).toBe(15);
  expect((await gql('mutation($id:String!){removePromoCodeByAdmin(promoCodeId:$id){isActive}}', { id }, adminToken)).data.removePromoCodeByAdmin.isActive).toBe(false);
  expect(await app.get(getModelToken('PromoCode')).countDocuments({ _id: id, deletedAt: { $exists: true } })).toBe(1);
  for (const bearer of [token, doctorToken, receptionToken]) expect((await gql('mutation($input:ServiceDiscountInput!){setServiceDiscountByAdmin(input:$input){_id}}', { input: { serviceId, discountPercent: 20 } }, bearer)).errors).toBeDefined();
 });
 it('snapshots admin service discount then promo discount into actual cash payment', async () => {
  expect((await gql('mutation($input:ServiceDiscountInput!){setServiceDiscountByAdmin(input:$input){serviceDiscountPercent}}', { input: { serviceId, discountPercent: 20 } }, adminToken)).errors).toBeUndefined();
  const order = await booking(); expect(order.bookingOrderTotalAmount).toBe(120000);
  await app.get(getModelToken('PromoCode')).create({ code: 'VISIT10', discountType: 'PERCENT', discountValue: 10, currency: 'UZS', isActive: true, createdBy: new Types.ObjectId() });
  const applied = await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'visit10' } }); expect(applied.errors).toBeUndefined();
  expect(applied.data.applyBookingPromoCode).toMatchObject({ bookingOrderSubtotalAmount: 150000, serviceDiscountAmount: 30000, promoDiscountAmount: 12000, bookingOrderTotalAmount: 108000 });
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'VISIT10' } }, otherToken)).errors).toBeDefined();
  expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
  expect((await payments.findOne({ bookingOrderId: order._id })).paymentAmount).toBe(108000);
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: null } })).errors).toBeDefined();
  await app.get(getModelToken('Service')).updateOne({ _id: serviceId }, { $set: { servicePrice: 999999, serviceDiscountPercent: 50 } });
  expect((await payments.findOne({ bookingOrderId: order._id })).paymentAmount).toBe(108000);
 });
 it('removes or replaces promo without compounding and rejects invalid codes and minimum amounts', async () => {
  const order = await booking();
  const model = app.get(getModelToken('PromoCode'));
  await model.create({ code: 'SAVE20', discountType: 'FIXED', discountValue: 20000, currency: 'UZS', isActive: true, minSubtotal: 100000, createdBy: new Types.ObjectId() });
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'SAVE20' } })).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(130000);
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'SAVE20' } })).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(130000);
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: null } })).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(150000);
  for (const patch of [{ isActive: false }, { currency: 'KRW' }, { expiresAt: new Date(Date.now()-60000) }, { startsAt: new Date(Date.now()+60000) }, { minSubtotal: 999999 }, { serviceIds: [String(new Types.ObjectId())] }]) {
   await model.updateOne({ code: 'SAVE20' }, { $set: { isActive: true, currency: 'UZS', startsAt: null, expiresAt: null, minSubtotal: 0, serviceIds: [], ...patch } });
   expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'SAVE20' } })).errors).toBeDefined();
  }
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'UNKNOWN' } })).errors).toBeDefined();
 });
 it('uses the discounted snapshot for simulated online payment and rejects changes after payment starts', async () => {
  const order = await booking();
  await app.get(getModelToken('PromoCode')).create({ code: 'ONLINE10', discountType: 'PERCENT', discountValue: 10, currency: 'UZS', isActive: true, createdBy: new Types.ObjectId() });
  await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'ONLINE10' } });
  const result = await choose(order._id, 'EXIMBAY'); expect(result.errors).toBeUndefined();
  const payment = await payments.findOne({ bookingOrderId: order._id }); expect(payment.paymentAmount).toBe(135000);
  expect((await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: null } })).errors).toBeDefined();
  expect((await gql(testQuery, { input: { paymentId: String(payment._id), outcome: 'PAID' } })).errors).toBeUndefined();
 });
 it('rejects expiry before first payment but preserves existing pending payment after admin disables the code', async () => {
  const order = await booking();
  const promo = await app.get(getModelToken('PromoCode')).create({ code: 'ENDING10', discountType: 'PERCENT', discountValue: 10, currency: 'UZS', isActive: true, createdBy: new Types.ObjectId() });
  await gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'ENDING10' } });
  await promo.updateOne({ $set: { isActive: false } });
  expect((await choose(order._id, 'CASH')).errors).toBeDefined();
  await promo.updateOne({ $set: { isActive: true } });
  expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
  await promo.updateOne({ $set: { isActive: false } });
  expect((await choose(order._id, 'CASH')).errors).toBeUndefined();
 });
 it('keeps parallel promo/payment updates consistent with the actual persisted payment amount', async () => {
  const order = await booking();
  await app.get(getModelToken('PromoCode')).create({ code: 'RACE10', discountType: 'PERCENT', discountValue: 10, currency: 'UZS', isActive: true, createdBy: new Types.ObjectId() });
  const [, chosen] = await Promise.all([gql(promoQuery, { input: { bookingOrderId: order._id, promoCode: 'RACE10' } }), choose(order._id, 'CASH')]);
  expect(chosen.errors).toBeUndefined();
  const stored = await orders.findById(order._id); const payment = await payments.findOne({ bookingOrderId: order._id });
  expect(payment.paymentAmount).toBe(stored.bookingOrderTotalAmount);
  expect(Number(stored.bookingOrderItems[0].servicePrice)).toBe(payment.paymentAmount);
 });

 it('applies service discounts to the existing cart and preserves them when removing promo', async () => {
  await app.get(getModelToken('Service')).updateOne({ _id: serviceId }, { $set: { serviceDiscountPercent: 30 } });
  const added = await gql('mutation($input:CartItemInput!){addCartItem(input:$input){_id servicePrice}}', { input: { serviceId, doctorId, requestedStartAt: startsAt } });
  expect(added.errors).toBeUndefined(); expect(added.data.addCartItem.servicePrice).toBe(105000);
  const created = await gql('mutation{createBookingOrder{_id bookingOrderSubtotalAmount bookingOrderDiscountAmount bookingOrderTotalAmount}}');
  expect(created.errors).toBeUndefined(); expect(created.data.createBookingOrder).toMatchObject({ bookingOrderSubtotalAmount: 150000, bookingOrderDiscountAmount: 45000, bookingOrderTotalAmount: 105000 });
  await app.get(getModelToken('PromoCode')).create({ code: 'CART10', discountType: 'PERCENT', discountValue: 10, currency: 'UZS', isActive: true, createdBy: new Types.ObjectId() });
  const id=created.data.createBookingOrder._id;
  expect((await gql(promoQuery, { input: { bookingOrderId:id, promoCode:'CART10' } })).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(94500);
  expect((await gql(promoQuery, { input: { bookingOrderId:id, promoCode:null } })).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(105000);
 });
 it('supports a fully discounted booking through cash confirmation without opening a zero-value online charge', async () => {
  const order=await booking();
  await app.get(getModelToken('PromoCode')).create({code:'FREEVISIT',discountType:'PERCENT',discountValue:100,currency:'UZS',isActive:true,createdBy:new Types.ObjectId()});
  expect((await gql(promoQuery,{input:{bookingOrderId:order._id,promoCode:'FREEVISIT'}})).data.applyBookingPromoCode.bookingOrderTotalAmount).toBe(0);
  expect((await choose(order._id,'EXIMBAY')).errors).toBeDefined();
  expect(await payments.countDocuments({bookingOrderId:order._id})).toBe(0);
  expect((await choose(order._id,'CASH')).errors).toBeUndefined();
  expect((await payments.findOne({bookingOrderId:order._id})).paymentAmount).toBe(0);
 });

 it('rejects online checkout before any intent when a multi-service order contains a free line', async () => {
  const order = await booking();
  const stored = await orders.findById(order._id);
  const freeLine = { ...stored.bookingOrderItems[0].toObject(), serviceId: String(new Types.ObjectId()), servicePrice: '0', serviceBasePrice: 150000, serviceDiscountAmount: 150000 };
  await orders.updateOne({ _id: order._id }, { $push: { bookingOrderItems: freeLine }, $set: { bookingOrderSubtotalAmount: 300000, bookingOrderDiscountAmount: 150000, serviceDiscountAmount: 150000 } });
  expect((await choose(order._id, 'EXIMBAY')).errors).toBeDefined();
  expect(await payments.countDocuments({ bookingOrderId: order._id })).toBe(0);
 });
});
