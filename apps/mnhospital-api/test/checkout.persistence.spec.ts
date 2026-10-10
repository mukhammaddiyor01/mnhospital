import { createInputValidationPipe } from '../src/libs/input-validation';
import { INestApplication } from '@nestjs/common';
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
		app.useGlobalPipes(createInputValidationPipe());
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
		await app.get(getModelToken('DoctorReport')).deleteMany({});
		await Promise.all([app.get(getModelToken('ReceptionTask')).deleteMany({}), orders.deleteMany({}), payments.deleteMany({}), appointments.deleteMany({}), app.get(getModelToken('Cart')).deleteMany({}), app.get(getModelToken('CartItem')).deleteMany({})]);
	});
	afterAll(async () => {
		try { if (connection?.name === databaseName && /^mn_flow_[a-f\d]{24}$/.test(databaseName)) await connection.dropDatabase(); }
		finally { await app?.close(); }
	});
	it('discovers actual booking dates and persists the selected visit through cash checkout', async () => {
		const date = clinicDate(new Date(startsAt));
		const response = await gql('query($input:AvailableDoctorDatesInput!){getAvailableDoctorDates(input:$input){dates reason}}',
			{input:{serviceId, doctorId, month:date.slice(0,7)}}, '');
		expect(response.errors).toBeUndefined();
		expect(response.data.getAvailableDoctorDates.reason).toBe('AVAILABLE');
		expect(response.data.getAvailableDoctorDates.dates).toContain(date);
		const slots = await gql('query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt endsAt}}',
			{input:{serviceId, doctorId, date}}, '');
		expect(slots.errors).toBeUndefined();
		const chosen = slots.data.getAvailableDoctorSlots[0];
		const order = await booking('date-discovery-checkout', chosen.startsAt);
		const checkout = await choose(order._id, 'CASH');
		expect(checkout.errors).toBeUndefined();
		const saved = await appointments.findById(checkout.data.chooseBookingPayment.appointments[0]._id);
		expect(saved.startsAt.toISOString()).toBe(chosen.startsAt);
		expect(saved.endsAt.toISOString()).toBe(chosen.endsAt);
		expect(String(saved.doctorId)).toBe(doctorId);
		expect(String(saved.roomId)).toBe(roomId);
		expect(saved.appointmentStatus).toBe('PENDING');
		expect(await payments.countDocuments({bookingOrderId:order._id,paymentProvider:'CASH',paymentStatus:'PENDING'})).toBe(1);
	});

	it('combines discounted discovery, literal search, category and base price with accurate paging', async () => {
		const services = app.get(getModelToken('Service'));
		const doctors = app.get(getModelToken('Doctor'));
		const blocked = await doctors.create({
			docNick: 'blocked-offer-doctor',
			docRoom: '101',
			docPassword: 'fixture',
			docPhone: '+998900002001',
			docExperience: 5,
			docSpecialty: 'CARDIOLOGIST',
			memberStatus: 'BLOCK',
		});
		const fixture = {
			memberId: new Types.ObjectId(doctorId),
			departmentId: new Types.ObjectId(),
			serviceType: 'CONSULTATION',
			serviceName: 'Offer [check]',
			serviceTitle: 'Offer [check]',
			serviceRoomName: 'CONSULTATION',
			serviceRoom: 'ROOM101',
			servicePrice: 200000,
			serviceDuration: '30',
			serviceImages: [],
			serviceDesc: 'Literal search offer',
			serviceDiscountPercent: 10,
		};
		const created = await services.create([
			fixture,
			fixture,
			{ ...fixture, memberId: blocked._id },
			{ ...fixture, serviceStatus: 'INACTIVE' },
			{ ...fixture, serviceDiscountPercent: 0 },
			{ ...fixture, servicePrice: 300000 },
		]);
		const query =
			'query($input:ServicesInquiry!){getServices(input:$input){list{_id servicePrice serviceDiscountPercent}metaCounter{total}}}';
		const input = {
			page: 1,
			limit: 1,
			sort: 'servicePrice',
			direction: 'ASC',
			search: {
				discountedOnly: true,
				text: '[check]',
				serviceTypeList: ['CONSULTATION'],
				priceRange: { start: 190000, end: 210000 },
			},
		};
		try {
			const first = await gql(query, { input }, '');
			expect(first.errors).toBeUndefined();
			expect(first.data.getServices.metaCounter).toEqual([{ total: 2 }]);
			expect(first.data.getServices.list).toHaveLength(1);
			expect(first.data.getServices.list[0].serviceDiscountPercent).toBe(10);
			const second = await gql(query, { input: { ...input, page: 2 } }, '');
			expect(second.errors).toBeUndefined();
			expect(second.data.getServices.list).toHaveLength(1);
			expect(second.data.getServices.list[0]._id).not.toBe(first.data.getServices.list[0]._id);
			const mismatch = await gql(
				query,
				{ input: { ...input, search: { ...input.search, serviceTypeList: ['THERAPY'] } } },
				'',
			);
			expect(mismatch.errors).toBeUndefined();
			expect(mismatch.data.getServices.list).toEqual([]);
			expect((await gql(query, { input: { ...input, search: { text: '[' } } }, '')).errors).toBeUndefined();
		} finally {
			await services.deleteMany({ _id: { $in: created.map((service) => service._id) } });
			await doctors.deleteOne({ _id: blocked._id });
		}
	});

	it('lets only admin create inactive options with inherited ownership and real booking prices', async () => {
		const query = 'mutation($input:ServiceOptionInput!){createServiceOptionByAdmin(input:$input){_id memberId departmentId serviceType serviceStatus servicePrice serviceDuration}}';
		const input = { baseServiceId: serviceId, serviceTitle: 'Extended consultation', servicePrice: 210000, serviceDuration: '45', serviceDesc: 'Extended option fixture' };
		expect((await gql(query, { input }, token)).errors).toBeDefined();
		expect((await gql(query, { input }, doctorToken)).errors).toBeDefined();
		expect((await gql(query, { input: { ...input, serviceDuration: '0' } }, adminToken)).errors).toBeDefined();
		expect((await gql(query, { input: { ...input, servicePrice: -1 } }, adminToken)).errors).toBeDefined();
		const created = await gql(query, { input }, adminToken);
		expect(created.errors).toBeUndefined();
		const option = created.data.createServiceOptionByAdmin;
		expect(option).toMatchObject({ memberId: doctorId, serviceStatus: 'INACTIVE', servicePrice: 210000, serviceDuration: '45', serviceType: 'CONSULTATION' });
		const services = app.get(getModelToken('Service'));
		try {
			const base = await services.findById(serviceId).lean(), saved = await services.findById(option._id).lean();
			expect(String(saved.departmentId)).toBe(String(base.departmentId));
			expect(saved.serviceRoom).toBe(base.serviceRoom);
			expect(saved.serviceImages).toEqual(base.serviceImages);
			expect((await gql(createQuery, { input: { serviceId: option._id, doctorId, requestedStartAt: startsAt, idempotencyKey: 'inactive-option' } })).errors).toBeDefined();
			expect((await gql('mutation($input:ServiceUpdate!){updateServiceByAdmin(input:$input){_id serviceStatus}}', { input: { _id: option._id, serviceStatus: 'ACTIVE' } }, adminToken)).errors).toBeUndefined();
			const booked = await gql(createQuery, { input: { serviceId: option._id, doctorId, requestedStartAt: startsAt, idempotencyKey: 'active-option' } });
			expect(booked.errors).toBeUndefined();
			expect(booked.data.createAppointmentBooking.bookingOrderTotalAmount).toBe(210000);
			const order = await orders.findById(booked.data.createAppointmentBooking._id);
			expect(String(order.bookingOrderItems[0].serviceId)).toBe(option._id);
		} finally { await services.deleteOne({ _id: option._id }); }
	});
	it('preserves the four-service limit and rejects options for blocked doctors', async () => {
		const services = app.get(getModelToken('Service')), doctors = app.get(getModelToken('Doctor'));
		const query = 'mutation($input:ServiceOptionInput!){createServiceOptionByAdmin(input:$input){_id}}';
		const input = { baseServiceId: serviceId, serviceTitle: 'Limit option', servicePrice: 1000, serviceDuration: '30' };
		await doctors.updateOne({ _id: doctorId }, { $set: { memberStatus: 'BLOCK' } });
		try { expect((await gql(query, { input }, adminToken)).errors).toBeDefined(); }
		finally { await doctors.updateOne({ _id: doctorId }, { $set: { memberStatus: 'ACTIVE' } }); }
		const base = await services.findById(serviceId).lean(); delete base._id;
		const fixtures = await services.create([base, base, base]);
		try { expect((await gql(query, { input }, adminToken)).errors).toBeDefined(); expect(await services.countDocuments({ memberId: doctorId, serviceType: 'CONSULTATION' })).toBe(4); }
		finally { await services.deleteMany({ _id: { $in: fixtures.map(row=>row._id) } }); }
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

 it('keeps patient, doctor and reception in sync from cash booking through clinical completion', async () => {
  const order = await booking(); const checkout = (await choose(order._id, 'CASH')).data.chooseBookingPayment;
  const id = checkout.appointments[0]._id; const paymentId = checkout.payments[0]._id;
  const change = (status: string, bearer = doctorToken) => gql('mutation($input:AppointmentStatusInput!){updateAppointmentStatus(input:$input){_id appointmentStatus}}', { input: { appointmentId: id, appointmentStatus: status } }, bearer);
  const staffOrders = () => gql('query{getBookingOrders(input:{page:1,limit:10}){list{_id bookingOrderStatus bookingOrderItems{appointmentId appointmentStatus paymentStatus paymentProvider paymentId}}}}', {}, receptionToken);
  const patientVisits = () => gql('query{getMyAppointments(input:{page:1,limit:10}){list{_id appointmentStatus}}}');
  const queue = () => gql('query{getMyReceptionistAppointmentQueue(input:{page:1,limit:10}){list{_id appointmentStatus}}}', {}, receptionToken);
  expect((await change('CONFIRMED')).errors).toBeUndefined();
  const staff = await staffOrders(); expect(staff.errors).toBeUndefined();
  expect(staff.data.getBookingOrders.list[0]).toMatchObject({ bookingOrderStatus: 'PENDING', bookingOrderItems: [{ appointmentId: id, appointmentStatus: 'CONFIRMED', paymentStatus: 'PENDING', paymentProvider: 'CASH', paymentId }] });
  expect((await patientVisits()).data.getMyAppointments.list[0].appointmentStatus).toBe('CONFIRMED');
  const doc = await gql('query{getMyDoctorBookingRequests(input:{page:1,limit:10}){list{appointmentId appointmentStatus bookingOrderStatus}}}', {}, doctorToken);
  expect(doc.errors).toBeUndefined(); expect(doc.data.getMyDoctorBookingRequests.list[0]).toMatchObject({ appointmentStatus: 'CONFIRMED', bookingOrderStatus: 'PENDING' });
  expect((await queue()).data.getMyReceptionistAppointmentQueue.list[0].appointmentStatus).toBe('CONFIRMED');
  const checkIn = () => gql('mutation($input:ReceptionistCheckInInput!){checkInReceptionistAppointment(input:$input){appointmentStatus}}', { input: { appointmentId: id } }, receptionToken);
  expect((await checkIn()).errors).toBeDefined(); // Accepted CHECK_IN task required.
  const createTask = await gql('mutation($input:ReceptionTaskInput!){createReceptionTask(input:$input){_id taskStatus}}', { input: { appointmentId: id, taskType: 'CHECK_IN', taskPriority: 'MEDIUM', taskInstruction: 'Patient arrival' } }, receptionToken);
  expect(createTask.errors).toBeUndefined(); const taskId = createTask.data.createReceptionTask._id;
  const taskChange = (status: string, result?: string) => gql('mutation($input:ReceptionTaskStatusInput!){updateReceptionTaskStatus(input:$input){taskStatus}}', { input: { taskId, taskStatus: status, ...(result ? { taskResult: result } : {}) } }, receptionToken);
  expect((await queue()).data.getMyReceptionistAppointmentQueue.list[0].appointmentStatus).toBe('CONFIRMED');
  expect((await taskChange('ACCEPTED')).errors).toBeUndefined();
  expect((await taskChange('IN_PROGRESS')).errors).toBeDefined(); // Cannot bypass check-in API.
  const paid = await gql('mutation($input:PaymentStatusInput!){updatePaymentStatus(input:$input){paymentStatus}}', { input: { paymentId, paymentStatus: 'PAID' } }, receptionToken);
  expect(paid.errors).toBeUndefined();
  expect((await staffOrders()).data.getBookingOrders.list[0]).toMatchObject({ bookingOrderStatus: 'CONFIRMED', bookingOrderItems: [{ appointmentStatus: 'CONFIRMED', paymentStatus: 'PAID' }] });
  expect((await checkIn()).data.checkInReceptionistAppointment.appointmentStatus).toBe('IN_PROGRESS');
  expect((await patientVisits()).data.getMyAppointments.list[0].appointmentStatus).toBe('IN_PROGRESS');
  expect((await change('COMPLETED', receptionToken)).errors).toBeDefined();
  expect((await change('COMPLETED', otherToken)).errors).toBeDefined();
  expect((await change('COMPLETED')).errors).toBeUndefined();
  expect((await taskChange('COMPLETED', 'Patient checked in')).errors).toBeUndefined();
  expect((await orders.findById(order._id)).bookingOrderStatus).toBe('COMPLETED');
  expect((await patientVisits()).data.getMyAppointments.list[0].appointmentStatus).toBe('COMPLETED');
  expect((await queue()).data.getMyReceptionistAppointmentQueue.list).toEqual([]);
  expect((await appointments.findById(id)).statusHistory.map((entry) => entry.newStatus)).toEqual(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']);
 });

 it('lets reception record arrival after the doctor starts without repeating the clinical transition', async () => {
  const order = await booking(); const checkout = (await choose(order._id, 'CASH')).data.chooseBookingPayment; const id = checkout.appointments[0]._id;
  const task = await gql('mutation($input:ReceptionTaskInput!){createReceptionTask(input:$input){_id}}', { input: { appointmentId: id, taskType: 'CHECK_IN', taskPriority: 'MEDIUM', taskInstruction: 'Arrival' } }, receptionToken);
  expect(task.errors).toBeUndefined(); const taskId = task.data.createReceptionTask._id;
  expect((await gql('mutation($input:ReceptionTaskStatusInput!){updateReceptionTaskStatus(input:$input){taskStatus}}', { input: { taskId, taskStatus: 'ACCEPTED' } }, receptionToken)).errors).toBeUndefined();
  for (const status of ['CONFIRMED', 'IN_PROGRESS']) expect((await gql('mutation($input:AppointmentStatusInput!){updateAppointmentStatus(input:$input){appointmentStatus}}', { input: { appointmentId: id, appointmentStatus: status } }, doctorToken)).errors).toBeUndefined();
  expect((await gql('mutation($input:ReceptionistCheckInInput!){checkInReceptionistAppointment(input:$input){appointmentStatus}}', { input: { appointmentId: id } }, receptionToken)).data.checkInReceptionistAppointment.appointmentStatus).toBe('IN_PROGRESS');
  expect((await app.get(getModelToken('ReceptionTask')).findById(taskId)).taskStatus).toBe('IN_PROGRESS');
  expect((await appointments.findById(id)).statusHistory.map((entry) => entry.newStatus)).toEqual(['CONFIRMED', 'IN_PROGRESS']);
 });
 it.each(['CANCELLED', 'NO_SHOW'])('closes assigned reception work when the doctor marks a visit %s', async (status) => {
  const order = await booking(); const checkout = (await choose(order._id, 'CASH')).data.chooseBookingPayment; const id = checkout.appointments[0]._id;
  const created = await gql('mutation($input:ReceptionTaskInput!){createReceptionTask(input:$input){_id}}', { input: { appointmentId: id, taskType: 'CHECK_IN', taskPriority: 'MEDIUM', taskInstruction: 'Patient arrival' } }, receptionToken);
  expect(created.errors).toBeUndefined(); const taskId = created.data.createReceptionTask._id;
  expect((await gql('mutation($input:AppointmentStatusInput!){updateAppointmentStatus(input:$input){appointmentStatus}}', { input: { appointmentId: id, appointmentStatus: status } }, doctorToken)).errors).toBeUndefined();
  expect((await app.get(getModelToken('ReceptionTask')).findById(taskId)).taskStatus).toBe('CANCELLED');
  const tasks = await gql('query($input:ReceptionTaskInquiry!){getReceptionTasks(input:$input){list{appointmentStatus appointmentCode taskStatus}}}', { input: { page: 1, limit: 10, appointmentId: id } }, receptionToken);
  expect(tasks.errors).toBeUndefined(); expect(tasks.data.getReceptionTasks.list[0]).toMatchObject({ taskStatus: 'CANCELLED', appointmentStatus: status });
  expect((await payments.findById(checkout.payments[0]._id)).paymentStatus).toBe('PENDING'); // No invented receipt/refund.
 });
	it('discovers a reportable patient visit without IDs and shares the saved report only with its patient and accepted reception', async () => {
		const order = await booking();
		const checkout = (await choose(order._id, 'CASH')).data.chooseBookingPayment;
		const id = checkout.appointments[0]._id;
		const queue = await gql(
			'query{getMyReceptionistAppointmentQueue(input:{page:1,limit:10}){list{_id receptionAssigned appointmentStatus patientPreview{patientFullName}}}}',
			{},
			receptionToken,
		);
		expect(queue.errors).toBeUndefined();
		expect(queue.data.getMyReceptionistAppointmentQueue.list[0]).toMatchObject({
			_id:id,
			receptionAssigned: false,
			appointmentStatus: 'PENDING',
		});
		const pickerQuery =
			'query($input:DoctorReportInquiry!){getMyDoctorReportAppointments(input:$input){list{_id appointmentCode appointmentReason reportId patientPreview{patientFullName}}}}';
		expect(
			(await gql(pickerQuery, { input: { page: 1, limit: 20 } }, doctorToken)).data.getMyDoctorReportAppointments.list,
		).toEqual([]);
		for (const status of ['CONFIRMED', 'IN_PROGRESS']) expect((await gql('mutation($input:AppointmentStatusInput!){updateAppointmentStatus(input:$input){appointmentStatus}}', { input: { appointmentId: id, appointmentStatus: status } }, doctorToken)).errors).toBeUndefined();
		const picker = await gql(pickerQuery, { input: { page: 1, limit: 20, appointmentId: id } }, doctorToken);
		expect(picker.errors).toBeUndefined();
		expect(picker.data.getMyDoctorReportAppointments.list[0]._id).toBe(id);
		const reportMutation = 'mutation($input:DoctorReportInput!){createDoctorReport(input:$input){_id patientId}}';
		const reportInput = {
			appointmentId: id,
			docReportSymptoms: 'Synthetic test symptoms',
			docReportDiagnosis: 'Synthetic test diagnosis',
			docReportMedication: 'Test care instructions',
			docReportRecommendation: 'Follow clinic instructions',
			docReportFollowUp: 'NONE',
		};
		expect((await gql(reportMutation, { input: reportInput }, token)).errors).toBeDefined();
		const created = await gql(reportMutation, { input: reportInput }, doctorToken);
		expect(created.errors).toBeUndefined();
		const reportId = created.data.createDoctorReport._id;
		const patients = await gql(
			'query{getMyPatientReports(input:{page:1,limit:10}){list{_id appointmentCode serviceName docReportDiagnosis}}}',
		);
		expect(patients.errors).toBeUndefined();
		expect(patients.data.getMyPatientReports.list[0]).toMatchObject({
			_id: reportId,
			docReportDiagnosis: reportInput.docReportDiagnosis,
		});
		expect(
			(await gql('query{getMyPatientReports(input:{page:1,limit:10}){list{_id}}}', {}, otherToken)).data
				.getMyPatientReports.list,
		).toEqual([]);
		const receptionReports =
			'query{getMyReceptionistReports(input:{page:1,limit:10}){list{_id patientName appointmentCode}}}';
		expect((await gql(receptionReports, {}, receptionToken)).data.getMyReceptionistReports.list).toEqual([]);
		const task = await gql('mutation($input:ReceptionTaskInput!){createReceptionTask(input:$input){_id}}', { input: { appointmentId: id, taskType: 'CHECK_IN', taskPriority: 'MEDIUM', taskInstruction: 'Arrival' } }, receptionToken);
		expect(task.errors).toBeUndefined();
		expect((await gql(receptionReports, {}, receptionToken)).data.getMyReceptionistReports.list).toEqual([]);
		expect(
			(
				await gql(
					'mutation($input:ReceptionTaskStatusInput!){updateReceptionTaskStatus(input:$input){taskStatus}}',
					{ input: { taskId: task.data.createReceptionTask._id, taskStatus: 'ACCEPTED' } },
					receptionToken,
				)
			).errors,
		).toBeUndefined();
		expect((await gql(receptionReports, {}, receptionToken)).data.getMyReceptionistReports.list[0]._id).toBe(reportId);
		expect(
			(await gql(pickerQuery, { input: { page: 1, limit: 20, appointmentId: id } }, doctorToken)).data
				.getMyDoctorReportAppointments.list[0].reportId,
		).toBe(reportId);
		expect((await gql(reportMutation, { input: reportInput }, doctorToken)).errors).toBeDefined();
	});
	it('accepts an intake appointment for only one receptionist under competing requests', async () => {
		const order = await booking();
		const checkout = (await choose(order._id, 'CASH')).data.chooseBookingPayment;
		const id = checkout.appointments[0]._id;
		const staffModel = app.get(getModelToken('Receptionist'));
		const existing = await staffModel.findOne({ receptionistNick: 'checkout-reception' });
		const other = await staffModel.create({
			receptionistNick: 'competing-reception',
			receptionistPassword: 'SyntheticPassword123',
			receptionistMail: 'competing-reception@example.test',
			receptionistPhone: '+998900009888',
			receptionistFullName: 'Other test reception',
		});
		try {
			const otherReceptionToken = (await app.get(AuthService).startSession(other)).accessToken;
			const create = 'mutation($input:ReceptionTaskInput!){createReceptionTask(input:$input){_id}}';
			const taskA = await gql(
				create,
				{
					input: {
						appointmentId: id,
						receptionistId: String(existing._id),
						taskType: 'CHECK_IN',
						taskPriority: 'MEDIUM',
						taskInstruction: 'A',
					},
				},
				adminToken,
			);
			const taskB = await gql(
				create,
				{
					input: {
						appointmentId: id,
						receptionistId: String(other._id),
						taskType: 'CHECK_IN',
						taskPriority: 'MEDIUM',
						taskInstruction: 'B',
					},
				},
				adminToken,
			);
			expect(taskA.errors).toBeUndefined();
			expect(taskB.errors).toBeUndefined();
			const update =
				'mutation($input:ReceptionTaskStatusInput!){updateReceptionTaskStatus(input:$input){_id taskStatus}}';
			const outcomes = await Promise.all([
				gql(update, { input: { taskId: taskA.data.createReceptionTask._id, taskStatus: 'ACCEPTED' } }, receptionToken),
				gql(
					update,
					{ input: { taskId: taskB.data.createReceptionTask._id, taskStatus: 'ACCEPTED' } },
					otherReceptionToken,
				),
			]);
			expect(outcomes.filter((result) => !result.errors)).toHaveLength(1);
			expect(
				await app.get(getModelToken('ReceptionTask')).countDocuments({ appointmentId: id, taskStatus: 'ACCEPTED' }),
			).toBe(1);
			expect((await appointments.findById(id)).receptionTaskId).toBeTruthy();
		} finally {
			await staffModel.deleteOne({ _id: other._id });
		}
	});
	it('books a discounted service package at its total price and duration and intersects component availability', async () => {
		const services = app.get(getModelToken('Service'));
		const base = await services.findById(serviceId).lean();
		const extra = await services.create({
			...base,
			_id: new Types.ObjectId(),
			serviceTitle: 'Check-up',
			serviceName: 'Check-up',
			servicePrice: 25000,
			serviceDuration: '15',
		});
		let packageId;
		try {
			const input = {
				baseServiceId: serviceId,
				includedServiceIds: [String(extra._id)],
				serviceTitle: 'Consultation + Check-up',
				servicePrice: 165000,
				serviceDuration: '45',
				serviceDesc: 'Synthetic package',
			};
			const create =
				'mutation($input:ServiceOptionInput!){createServiceOptionByAdmin(input:$input){_id packageBaseServiceId packageRegularPrice packageItems{serviceId title duration price}}}';
			expect((await gql(create, {input}, doctorToken)).errors).toBeDefined();
			expect((await gql(create, { input: { ...input, serviceDuration:'30' } }, adminToken)).errors).toBeDefined();
			expect((await gql(create, { input: { ...input, servicePrice: 175000 } }, adminToken)).errors).toBeDefined();
			const created = await gql(create, {input}, adminToken);
			expect(created.errors).toBeUndefined();
			packageId = created.data.createServiceOptionByAdmin._id;
			expect(created.data.createServiceOptionByAdmin).toMatchObject({
				packageBaseServiceId: serviceId,
				packageRegularPrice: 175000,
				packageItems: [
					{ serviceId, title: base.serviceTitle, duration: 30, price: 150000 },
					{ serviceId: String(extra._id), title: 'Check-up', duration: 15, price: 25000 },
				],
			});
			const update = await gql(
				'mutation($input:ServiceOptionUpdateInput!){updateServiceOptionByAdmin(input:$input){serviceStatus}}',
				{ input: { ...input, optionId: packageId, serviceStatus: 'ACTIVE' } },
				adminToken,
			);
			expect(update.errors).toBeUndefined();
			const choices = await gql(
				'query($id:String!){getServiceBookingOptions(serviceId:$id){list{_id packageItems{title}}}}',
				{id:serviceId},
				'',
			);
			expect(choices.errors).toBeUndefined();
			expect(choices.data.getServiceBookingOptions.list.map((row) => row._id)).toEqual([serviceId, packageId]); // Check-up is an add-on, not a separate option.
			const response = await gql(createQuery, {
				input: { serviceId: packageId, doctorId, requestedStartAt: startsAt, idempotencyKey: 'package-booking' },
			});
			expect(response.errors).toBeUndefined();
			expect(response.data.createAppointmentBooking.bookingOrderTotalAmount).toBe(165000);
			const checkout = await choose(response.data.createAppointmentBooking._id, 'CASH');
			expect(checkout.errors).toBeUndefined();
			const visit = await appointments.findById(checkout.data.chooseBookingPayment.appointments[0]._id);
			expect(visit.endsAt.getTime() - visit.startsAt.getTime()).toBe(45 * 60000);
			expect(
				(await payments.findOne({ bookingOrderId: response.data.createAppointmentBooking._id })).paymentAmount,
			).toBe(165000);
			await appointments.deleteMany({});
			await services.updateOne({ _id: extra._id }, { $set: { availabilityDates: ['2099-12-31'] } });
			const slots = await gql(
				'query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}',
				{ input: { doctorId, serviceId: packageId, date: clinicDate(new Date(startsAt)) } },
				'',
			);
			expect(slots.errors).toBeUndefined();
			expect(slots.data.getAvailableDoctorSlots).toEqual([]);
            await services.updateOne({ _id: extra._id }, { $set: { availabilityDates: [], servicePrice: 1000 } });
            const unavailablePackage = await gql('query($id:String!){getServiceBookingOptions(serviceId:$id){list{_id}}}', {id:serviceId}, '');
            expect(unavailablePackage.data.getServiceBookingOptions.list.map(row=>row._id)).toEqual([serviceId]);
            const stalePriceSlots = await gql('query($input:AvailableDoctorSlotsInput!){getAvailableDoctorSlots(input:$input){startsAt}}', { input: { doctorId, serviceId: packageId, date: clinicDate(new Date(startsAt)) } }, '');
            expect(stalePriceSlots.data.getAvailableDoctorSlots).toEqual([]);

		} finally {
			await services.deleteMany({ _id: { $in: [extra._id, ...(packageId ? [new Types.ObjectId(packageId)] : [])] } });
		}
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


 it('persists patient and doctor follows once, rejects self and staff, and reverses counters', async () => {
  const members=app.get(getModelToken('Member'));
  const first=await members.findOne({memberNick:'checkout-patient-1'});
  const second=await members.findOne({memberNick:'checkout-patient-2'});
  const query='mutation($id:String!){subscribe(input:$id){_id followingId followerId}}';
  const requests=await Promise.all(Array.from({length:5},()=>gql(query,{id:String(second._id)})));
  requests.forEach(result=>expect(result.errors).toBeUndefined());
  expect(await app.get(getModelToken('Follow')).countDocuments({followerId:first._id,followingId:second._id})).toBe(1);
  expect((await members.findById(first._id)).memberFollowings).toBe(1);
  expect((await members.findById(second._id)).memberFollowers).toBe(1);
  expect((await gql(query,{id:String(first._id)})).errors).toBeDefined();
  expect((await gql(query,{id:String(second._id)},receptionToken)).errors).toBeDefined();
  expect((await gql(query,{id:String(second._id)},'')).errors).toBeDefined();
  expect((await gql(query,{id:String(second._id)},doctorToken)).errors).toBeUndefined();
  expect((await app.get(getModelToken('Doctor')).findById(doctorId)).docFollowings).toBe(1);
  expect((await members.findById(second._id)).memberFollowers).toBe(2);
  const remove='mutation($id:String!){unsubscribe(input:$id){_id}}';
  expect((await gql(remove,{id:String(second._id)})).errors).toBeUndefined();
  expect((await gql(remove,{id:String(second._id)},doctorToken)).errors).toBeUndefined();
  expect((await members.findById(first._id)).memberFollowings).toBe(0);
  expect((await members.findById(second._id)).memberFollowers).toBe(0);
 });

 it('does not count doctor follow actions as profile visits and maintains the doctor relationship', async () => {
  const doctors=app.get(getModelToken('Doctor')), before=await doctors.findById(doctorId);
  const query='mutation($id:String!){subscribeDoctor(input:$id){_id}}';
  const results=await Promise.all(Array.from({length:4},()=>gql(query,{id:doctorId})));
  results.forEach(result=>expect(result.errors).toBeUndefined());
  const followed=await doctors.findById(doctorId);
  expect(followed.docFollowers).toBe(before.docFollowers+1);
  expect(followed.docViews).toBe(before.docViews);
  expect((await gql(query,{id:doctorId},doctorToken)).errors).toBeDefined();
  expect((await gql('mutation($id:String!){unsubscribeDoctor(input:$id){_id}}',{id:doctorId})).errors).toBeUndefined();
  expect((await doctors.findById(doctorId)).docFollowers).toBe(before.docFollowers);
  expect((await doctors.findById(doctorId)).docViews).toBe(before.docViews);
 });

 it('counts concurrent profile reads only once per viewer and excludes the owner', async () => {
  const members=app.get(getModelToken('Member')), target=await members.findOne({memberNick:'checkout-patient-2'});
  const before=target.memberViews;
  const query='query($id:String!){getMember(memberId:$id){_id memberViews meLiked{myFavorite}}}';
  const results=await Promise.all(Array.from({length:6},()=>gql(query,{id:String(target._id)})));
  results.forEach(result=>expect(result.errors).toBeUndefined());
  expect((await members.findById(target._id)).memberViews).toBe(before+1);
  expect((await gql(query,{id:String(target._id)})).errors).toBeUndefined();
  expect((await gql(query,{id:String(target._id)},otherToken)).errors).toBeUndefined();
  expect((await gql(query,{id:String(target._id)},'')).errors).toBeUndefined();
  expect((await members.findById(target._id)).memberViews).toBe(before+1);
 });

 it('returns persisted like state and keeps counters equal to records under concurrent toggles', async () => {
  const target=await app.get(getModelToken('Member')).findOne({memberNick:'checkout-patient-2'});
  const query='mutation($id:String!){likeTargetMember(memberId:$id){_id memberLikes meLiked{myFavorite}}}';
  const liked=await gql(query,{id:String(target._id)});
  expect(liked.errors).toBeUndefined();expect(liked.data.likeTargetMember.meLiked[0].myFavorite).toBe(true);
  const removed=await gql(query,{id:String(target._id)});
  expect(removed.data.likeTargetMember.meLiked).toEqual([]);
  const results=await Promise.all(Array.from({length:8},()=>gql(query,{id:String(target._id)})));
  results.forEach(result=>expect(result.errors).toBeUndefined());
  const persisted=await app.get(getModelToken('Member')).findById(target._id);
  const count=await app.get(getModelToken('Like')).countDocuments({likeRefId:target._id,likeGroup:'MEMBER'});
  expect(persisted.memberLikes).toBe(count); expect(count).toBeLessThanOrEqual(1);
  expect((await gql(query,{id:String(target._id)},'')).errors).toBeDefined();
  await app.get(getModelToken('Member')).updateOne({_id:target._id},{$set:{memberStatus:'BLOCK'}});
  expect((await gql(query,{id:String(target._id)})).errors).toBeDefined();
  await app.get(getModelToken('Member')).updateOne({_id:target._id},{$set:{memberStatus:'ACTIVE'}});
 });

 it('returns selected service and doctor like state without inflating their view counters', async () => {
  const doctors=app.get(getModelToken('Doctor')), before=await doctors.findById(doctorId);
  const doc=await gql('mutation($id:String!){likeTargetDoctor(doctorId:$id){_id docLikes meLiked{myFavorite}}}',{id:doctorId});
  expect(doc.errors).toBeUndefined();expect(doc.data.likeTargetDoctor.meLiked[0].myFavorite).toBe(true);
  expect((await doctors.findById(doctorId)).docViews).toBe(before.docViews);
  const service=await gql('mutation($id:String!){likeTargetService(serviceId:$id){_id serviceLikes meLiked{myFavorite}}}',{id:serviceId});
  expect(service.errors).toBeUndefined();expect(service.data.likeTargetService.meLiked[0].myFavorite).toBe(true);
  const reads=await Promise.all(Array.from({length:4},()=>gql('query($id:String!){getService(serviceId:$id){_id serviceViews}}',{id:serviceId})));
  reads.forEach(result=>expect(result.errors).toBeUndefined());
  expect((await app.get(getModelToken('Service')).findById(serviceId)).serviceViews).toBe(1);
  expect((await doctors.findById(doctorId)).docViews).toBe(before.docViews);
 });

 it('counts each authenticated viewer once for each doctor, including refreshes and parallel reads', async () => {
  const doctors=app.get(getModelToken('Doctor')), views=app.get(getModelToken('View'));
  const first=await app.get(getModelToken('Member')).findOne({memberNick:'checkout-patient-1'});
  const original=await doctors.findById(doctorId).select('+docPassword'), before=original.docViews;
  const query='query($id:String!){getDoctor(doctorId:$id){_id docViews}}';
  const results=await Promise.all(Array.from({length:6},()=>gql(query,{id:doctorId})));
  results.forEach(result=>expect(result.errors).toBeUndefined());
  expect((await doctors.findById(doctorId)).docViews).toBe(before+1);
  expect(await views.countDocuments({memberId:first._id,viewRefId:doctorId,viewGroup:'DOCTOR'})).toBe(1);
  for(let n=0;n<3;n++) expect((await gql(query,{id:doctorId})).data.getDoctor.docViews).toBe(before+1);
  expect((await gql(query,{id:doctorId},'')).data.getDoctor.docViews).toBe(before+1);
  const other=await gql(query,{id:doctorId},otherToken);
  expect(other.errors).toBeUndefined();expect(other.data.getDoctor.docViews).toBe(before+2);
  expect((await gql(query,{id:doctorId},otherToken)).data.getDoctor.docViews).toBe(before+2);
  const another=await doctors.create({docNick:'unique-view-doctor',docPassword:original.docPassword,docPhone:'+998900007007',docFullName:'Unique View Doctor',docExperience:2,docSpecialty:'CARDIOLOGIST',docRoom:'102',docViews:13});
  try {
   const reads=await Promise.all(Array.from({length:4},()=>gql(query,{id:String(another._id)})));
   reads.forEach(result=>expect(result.errors).toBeUndefined());
   expect((await doctors.findById(another._id)).docViews).toBe(14);
   expect((await gql(query,{id:String(another._id)})).data.getDoctor.docViews).toBe(14);
   expect((await doctors.findById(doctorId)).docViews).toBe(before+2);
  } finally { await doctors.deleteOne({_id:another._id}); }
 });

 it('keeps service views unique across return visits and another service and never adds doctor metadata views', async () => {
  const services=app.get(getModelToken('Service')), views=app.get(getModelToken('View'));
  const original=await services.findById(serviceId);
  const before=original.serviceViews, doctorBefore=(await app.get(getModelToken('Doctor')).findById(doctorId)).docViews;
  const query='query($id:String!){getService(serviceId:$id){_id serviceViews}}';
  const previouslyViewed=await views.exists({memberId:(await app.get(getModelToken('Member')).findOne({memberNick:'checkout-patient-1'}))._id,viewRefId:serviceId,viewGroup:'SERVICE'});
  const expected=before+(previouslyViewed?0:1);
  for(let n=0;n<3;n++) expect((await gql(query,{id:serviceId})).data.getService.serviceViews).toBe(expected);
  expect((await gql(query,{id:serviceId},'')).data.getService.serviceViews).toBe(expected);
  const other=await gql(query,{id:serviceId},otherToken);
  expect(other.errors).toBeUndefined();expect(other.data.getService.serviceViews).toBe(expected+1);
  expect((await gql(query,{id:serviceId},otherToken)).data.getService.serviceViews).toBe(expected+1);
  const another=await services.create({memberId:original.memberId,departmentId:original.departmentId,serviceType:'CONSULTATION',serviceName:'Unique service views',serviceTitle:'Unique service views',serviceDesc:'Unique view persistence test service',serviceRoomName:'CONSULTATION',serviceRoom:'ROOM101',servicePrice:50000,serviceDuration:'30',serviceImages:[],serviceViews:9});
  try {
   const reads=await Promise.all(Array.from({length:5},()=>gql(query,{id:String(another._id)})));
   reads.forEach(result=>expect(result.errors).toBeUndefined());
   expect((await services.findById(another._id)).serviceViews).toBe(10);
   expect((await gql(query,{id:String(another._id)})).data.getService.serviceViews).toBe(10);
   expect((await services.findById(serviceId)).serviceViews).toBe(expected+1);
   expect((await app.get(getModelToken('Doctor')).findById(doctorId)).docViews).toBe(doctorBefore);
  } finally { await services.deleteOne({_id:another._id}); }
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
 it('publishes only opted-in valid promo offers without exposing administrative fields', async () => {
  const mutation = 'mutation($input:PromoCodeInput!){createPromoCodeByAdmin(input:$input){_id showOnHomepage}}';
  const input = {code:'PUBLIC7000',discountType:'FIXED',discountValue:7000,isActive:true,showOnHomepage:true,minSubtotal:10000,serviceIds:[serviceId]};
  expect((await gql(mutation,{input},doctorToken)).errors).toBeDefined();
  const created=await gql(mutation,{input},adminToken);
  expect(created.errors).toBeUndefined();
  const id=created.data.createPromoCodeByAdmin._id;
  const model=app.get(getModelToken('PromoCode'));
  const base={discountType:'FIXED',discountValue:7000,currency:'UZS',isActive:true,showOnHomepage:true,createdBy:new Types.ObjectId()};
  await model.insertMany([
   {...base,code:'PRIVATE',showOnHomepage:false},
   {...base,code:'LEGACY',showOnHomepage:undefined},
   {...base,code:'INACTIVE',isActive:false},
   {...base,code:'FUTURE',startsAt:new Date(Date.now()+60000)},
   {...base,code:'EXPIRED',expiresAt:new Date(Date.now()-1000)},
   {...base,code:'ARCHIVED',deletedAt:new Date()},
   {...base,code:'OTHER_CURRENCY',currency:'KRW'},
  ]);
  const query='{getPublicPromoOffers{_id code discountType discountValue currency minSubtotal serviceIds expiresAt}}';
  const result=await gql(query,{},'');
  expect(result.errors).toBeUndefined();
  expect(result.data.getPublicPromoOffers).toEqual([expect.objectContaining({code:'PUBLIC7000',discountValue:7000,serviceIds:[serviceId],minSubtotal:10000})]);
  const projection=await app.get(require('../src/components/booking/promotion.service').PromotionService).publicOffers();
  expect(projection[0]).not.toHaveProperty('createdBy');
  expect(projection[0]).not.toHaveProperty('updatedBy');
  expect(projection[0]).not.toHaveProperty('showOnHomepage');
  expect((await gql('{getPublicPromoOffers{createdBy}}',{},'')).errors).toBeDefined();
  const hidden=await gql('mutation($input:PromoCodeUpdate!){updatePromoCodeByAdmin(input:$input){showOnHomepage}}',{input:{...input,_id:id,showOnHomepage:false}},adminToken);
  expect(hidden.data.updatePromoCodeByAdmin.showOnHomepage).toBe(false);
  expect((await gql(query,{},'')).data.getPublicPromoOffers).toEqual([]);
  await model.insertMany(Array.from({length:5},(_,i)=>({...base,code:`VISIBLE${i}`})));
  expect((await gql(query,{},'')).data.getPublicPromoOffers).toHaveLength(3);
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
