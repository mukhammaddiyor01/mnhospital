// Run with node --env-file=.env scripts/verify-auth-access.cjs.
// Uses a newly named test database. Never reads/writes application documents.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { randomBytes } = require('crypto');
const root = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'test';
require(root + '/node_modules/dotenv').config({ path: process.env.MN_AUTH_VERIFY_ENV_FILE ?? path.join(root, '.env') });
require(root + '/node_modules/ts-node').register({
	transpileOnly: true,
	compilerOptions: { module: 'commonjs', experimentalDecorators: true, emitDecoratorMetadata: true },
});
require(root + '/node_modules/reflect-metadata');
const { Test } = require(root + '/node_modules/@nestjs/testing');
const { Module, ValidationPipe } = require(root + '/node_modules/@nestjs/common');
const { MongooseModule, getConnectionToken, getModelToken } = require(root + '/node_modules/@nestjs/mongoose');
const { WsAdapter } = require(root + '/node_modules/@nestjs/platform-ws');
const { Types } = require(root + '/node_modules/mongoose');
const request = require(root + '/node_modules/supertest');
const WebSocket = require(root + '/node_modules/ws');
const { AppModule } = require(root + '/apps/mnhospital-api/src/app.module');
const { DatabaseModule } = require(root + '/apps/mnhospital-api/src/database/database.module');
const { AuthService } = require(root + '/apps/mnhospital-api/src/components/auth/auth.service');
const database = 'mn_auth_' + Date.now() + '_' + randomBytes(4).toString('hex');
const password = 'FixturePass123';
const origin = 'http://localhost:2003';
process.env.AUTH_ALLOWED_ORIGINS = origin;
let app,
	connection,
	checks = 0,
	cleaning = false;
const sockets = [];
function checked(condition, label) {
	assert.ok(condition, label);
	checks++;
}
async function cleanup() {
	if (cleaning) return;
	cleaning = true;
	for (const socket of sockets) socket.close();
	try {
		if (connection && connection.name === database && /^mn_auth_\d+_[a-f0-9]{8}$/.test(database))
			await connection.dropDatabase();
	} finally {
		if (app) await app.close();
	}
}
async function main() {
	const databaseUri = process.env.MONGO_DEV || process.env.MONGO_PROD;
	checked(Boolean(databaseUri), 'A configured Mongo URI is required for the isolated verification database');
	class IsolatedDatabaseModule {}
	Module({
		imports: [MongooseModule.forRoot(databaseUri, { dbName: database, serverSelectionTimeoutMS: 15000 })],
		exports: [MongooseModule],
	})(IsolatedDatabaseModule);
	const module = await Test.createTestingModule({ imports: [AppModule] })
		.overrideModule(DatabaseModule)
		.useModule(IsolatedDatabaseModule)
		.compile();
	app = module.createNestApplication({ logger: false });
	app.useGlobalPipes(new ValidationPipe());
	app.useWebSocketAdapter(new WsAdapter(app));
	app.enableCors({ origin, credentials: true });
	await app.listen(Number(process.env.MN_AUTH_VERIFY_PORT ?? 2004), '127.0.0.1');
	connection = app.get(getConnectionToken());
	checked(connection.name === database, 'isolated database connection');
	const model = (name) => app.get(getModelToken(name));
	const auth = app.get(AuthService);
	const hash = await auth.hashPassword(password);
	const sharedId = new Types.ObjectId();
	const ids = [sharedId, new Types.ObjectId()];
	const actors = {};
	for (let n = 1; n <= 2; n++) {
		const id = ids[n - 1];
		const definitions = [
			[
				'PATIENT',
				'Member',
				'login',
				'LoginInput',
				{
					_id: id,
					memberNick: 'testpat' + n,
					memberPassword: hash,
					memberPhone: '+8210000001' + n,
					memberFullName: 'Fixture Patient ' + n,
				},
				{ memberNick: 'testpat' + n, memberPassword: password },
			],
			[
				'DOCTOR',
				'Doctor',
				'loginDoctor',
				'DoctorLoginInput',
				{
					_id: id,
					docNick: 'testdoc' + n,
					docPassword: hash,
					docPhone: '+8210000002' + n,
					docExperience: 0,
					docRoom: '90' + n,
					docFullName: 'Fixture Doctor ' + n,
				},
				{ docNick: 'testdoc' + n, docPassword: password },
			],
			[
				'RECEPTIONIST',
				'Receptionist',
				'loginReceptionist',
				'ReceptionistLoginInput',
				{
					_id: id,
					receptionistNick: 'testrec' + n,
					receptionistPassword: hash,
					receptionistPhone: '+8210000003' + n,
					receptionistMail: 'testrec' + n + '@example.test',
					receptionistFullName: 'Fixture Receptionist ' + n,
				},
				{ receptionistNick: 'testrec' + n, receptionistPassword: password },
			],
			[
				'ADMIN',
				'Admin',
				'loginAdmin',
				'AdminLoginInput',
				{
					_id: id,
					adminNick: 'testadm' + n,
					adminPassword: hash,
					adminPhone: '+8210000004' + n,
					adminMail: 'testadm' + n + '@example.test',
					adminImage: '/fixture.png',
					adminDesc: 'Isolated verification fixture',
				},
				{ adminNick: 'testadm' + n, adminPassword: password },
			],
		];
		for (const [role, name, field, type, document, input] of definitions) {
			await model(name).create(document);
			actors[role + n] = { id, role, name, field, type, input };
		}
	}
	for (let n = 1; n <= 2; n++) {
		const profile = await model('Patient').create({
			memberId: ids[n - 1],
			patientFullName: 'Fixture Patient ' + n,
			patientBloodType: 'A_POSITIVE',
			patientGender: 'MALE',
			patientBirthDate: new Date('2000-01-01'),
			patientIdNumber: 'fixture-patient-' + n,
		});
		actors['PATIENT' + n].patientId = profile._id;
	}
	async function gql(query, variables, actor, cookie, requestOrigin = origin) {
		const req = request(app.getHttpServer())
			.post('/graphql')
			.set('Origin', requestOrigin)
			.set('Apollo-Require-Preflight', 'true');
		if (actor?.token) req.set('Authorization', 'Bearer ' + actor.token);
		if (cookie) req.set('Cookie', cookie);
		return req.send({ query, variables });
	}
	async function login(actor) {
		const res = await gql(`mutation($input:${actor.type}!){${actor.field}(input:$input){accessToken}}`, {
			input: actor.input,
		});
		checked(!res.body.errors, actor.role + ' login');
		actor.token = res.body.data[actor.field].accessToken;
		actor.cookie = res.headers['set-cookie'][0].split(';')[0];
		checked(res.headers['set-cookie'][0].includes('HttpOnly'), actor.role + ' refresh cookie is HttpOnly');
		checked(
			['EN', 'UZ', 'KR'].includes(
				(await gql('{getMyPreferences{theme language}}', null, actor)).body.data?.getMyPreferences.language,
			),
			actor.role + ' authenticated preferences',
		);
	}
	for (const actor of Object.values(actors)) await login(actor);
	const ownContact = await gql('{getMyMemberProfile{memberPhone}}', null, actors.PATIENT1);
	checked(
		ownContact.body.data?.getMyMemberProfile.memberPhone === '+82100000011',
		'own account contact restored outside JWT',
	);
	for (const role of ['DOCTOR', 'RECEPTIONIST', 'ADMIN'])
		checked(
			(await gql('{getMyMemberProfile{memberPhone}}', null, actors[role + 1])).body.errors?.[0]?.code === 'FORBIDDEN',
			role + ' cannot use patient self-account API',
		);
	for (const actor of [undefined, actors.PATIENT2, actors.DOCTOR1, actors.RECEPTIONIST1]) {
		const publicContact = await gql(
			'query($id:String!){getMember(memberId:$id){_id memberPhone memberMail memberIdNumber memberAddress}}',
			{ id: String(sharedId) },
			actor,
		);
		checked(
			!publicContact.body.errors &&
				publicContact.body.data.getMember.memberPhone === null &&
				publicContact.body.data.getMember.memberAddress === null,
			'public/nested account contact ownership',
		);
	}
	// Rotation, CSRF and logout against the actual Mongo-backed AuthService.
	for (const role of ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN']) {
		const actor = actors[role + 2];
		const refreshed = await gql('mutation{refreshSession{accessToken}}', null, null, actor.cookie);
		checked(!refreshed.body.errors, role + ' refresh');
		const freshCookie = refreshed.headers['set-cookie'][0].split(';')[0];
		checked(freshCookie !== actor.cookie, role + ' cookie rotates');
		actor.token = refreshed.body.data.refreshSession.accessToken;
		checked(
			(await gql('mutation{refreshSession{accessToken}}', null, null, freshCookie, 'https://untrusted.example')).body
				.errors?.[0]?.code === 'FORBIDDEN',
			role + ' CSRF origin denied',
		);
		checked(
			(await gql('mutation{refreshSession{accessToken}}', null, null, actor.cookie)).body.errors?.[0]?.code ===
				'UNAUTHENTICATED',
			role + ' replay denied',
		);
		checked(
			(await gql('{getMyPreferences{theme language}}', null, actor)).body.errors?.[0]?.code === 'UNAUTHENTICATED',
			role + ' replay revokes access',
		);
		await login(actor);
		checked(
			(await gql('mutation{logoutSession}', null, actor, actor.cookie)).body.data?.logoutSession === true,
			role + ' logout',
		);
		checked(
			(await gql('{getMyPreferences{theme language}}', null, actor)).body.errors?.[0]?.code === 'UNAUTHENTICATED',
			role + ' logout revokes access',
		);
		await login(actor);
	}
	// Independent role/profile keys, deliberately sharing ObjectIds across collections.
	const patient = actors.PATIENT2;
	const oldPatientToken = patient.token;
	const oldPatientCookie = patient.cookie;
	const secondLogin = await gql('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
		input: patient.input,
	});
	checked(!secondLogin.body.errors, 'patient second device login');
	const secondDeviceToken = secondLogin.body.data.login.accessToken;
	const changedPassword = 'FixtureNewPass123';
	const passwordUpdate = await gql(
		'mutation($input:MemberUpdate!){updateMember(input:$input){accessToken memberPhone}}',
		{ input: { _id: String(patient.id), memberPassword: changedPassword } },
		patient,
		patient.cookie,
	);
	checked(!passwordUpdate.body.errors, 'patient password change creates replacement session');
	patient.token = passwordUpdate.body.data.updateMember.accessToken;
	patient.cookie = passwordUpdate.headers['set-cookie'][0].split(';')[0];
	checked(patient.cookie !== oldPatientCookie, 'password change replaces refresh cookie');
	for (const token of [oldPatientToken, secondDeviceToken])
		checked(
			(await gql('{getMyPreferences{theme}}', null, { token })).body.errors?.[0]?.code === 'UNAUTHENTICATED',
			'password change revokes every old device access token',
		);
	checked(
		(await gql('mutation{refreshSession{accessToken}}', null, null, oldPatientCookie)).body.errors?.[0]?.code ===
			'UNAUTHENTICATED',
		'password change revokes old refresh cookie',
	);
	checked(!(await gql('{getMyMemberProfile{memberPhone}}', null, patient)).body.errors, 'replacement access works');
	checked(
		!(await gql('mutation{refreshSession{accessToken}}', null, null, patient.cookie)).body.errors,
		'replacement refresh works',
	);
	patient.input.memberPassword = changedPassword;
	await login(patient);
	for (const [index, role] of ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN'].entries()) {
		const actor = actors[role + 1];
		const language = ['UZ', 'KR', 'EN', 'UZ'][index];
		const changed = await gql(
			'mutation($input:UpdateMyPreferencesInput!){updateMyPreferences(input:$input){language}}',
			{ input: { language } },
			actor,
		);
		checked(changed.body.data?.updateMyPreferences.language === language, role + ' preference ownership');
	}
	for (const [index, role] of ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN'].entries())
		checked(
			(await gql('{getMyPreferences{language}}', null, actors[role + 1])).body.data?.getMyPreferences.language ===
				['UZ', 'KR', 'EN', 'UZ'][index],
			role + ' preferences stay separate after other roles save',
		);
	const notification = await model('Notification').create({
		receiverId: sharedId,
		receiverType: 'PATIENT',
		notificationType: 'SYSTEM',
		notificationGroup: 'REPORT',
		notificationTitle: 'Fixture notification',
		notificationDesc: 'Safe summary',
		notificationRefId: new Types.ObjectId(),
	});
	for (const role of ['DOCTOR', 'RECEPTIONIST', 'ADMIN'])
		checked(
			Boolean(
				(
					await gql(
						'query($id:String!){getMyNotification(notificationId:$id){_id}}',
						{ id: String(notification._id) },
						actors[role + 1],
					)
				).body.errors,
			),
			role + ' cannot read patient notification',
		);
	checked(
		!(
			await gql(
				'query($id:String!){getMyNotification(notificationId:$id){_id}}',
				{ id: String(notification._id) },
				actors.PATIENT1,
			)
		).body.errors,
		'patient reads own notification',
	);
	const direct = await gql(
		'mutation($input:StartDirectConversationInput!){startDirectConversation(input:$input){_id}}',
		{ input: { targetType: 'DOCTOR', targetId: String(sharedId) } },
		actors.PATIENT1,
	);
	checked(!direct.body.errors, 'same ID, different roles can start a direct conversation');
	const conversationId = direct.body.data.startDirectConversation._id;
	const sent = await gql(
		'mutation($id:String!,$input:SendDirectMessageInput!){sendDirectMessage(conversationId:$id,input:$input){_id}}',
		{ id: conversationId, input: { messageContent: 'Fixture private message' } },
		actors.PATIENT1,
	);
	checked(!sent.body.errors, 'participant sends persisted private message');
	checked(
		!(
			await gql(
				'query($id:String!){getMyConversation(conversationId:$id){_id}}',
				{ id: conversationId },
				actors.DOCTOR1,
			)
		).body.errors,
		'doctor participant reads conversation',
	);
	for (const name of ['PATIENT2', 'DOCTOR2', 'RECEPTIONIST1', 'ADMIN1'])
		checked(
			Boolean(
				(
					await gql(
						'query($id:String!){getMyConversation(conversationId:$id){_id}}',
						{ id: conversationId },
						actors[name],
					)
				).body.errors,
			),
			name + ' cannot read another conversation',
		);
	// Clinical report/payment/order ownership uses patient profile ID, not account ID.
	const reportId = new Types.ObjectId(),
		appointmentId = new Types.ObjectId(),
		orderId = new Types.ObjectId(),
		paymentId = new Types.ObjectId();
	await model('DoctorReport').collection.insertOne({
		_id: reportId,
		doctorId: sharedId,
		patientId: actors.PATIENT1.patientId,
		appointmentId,
		createdAt: new Date(),
	});
	await model('BookingOrder').collection.insertOne({
		_id: orderId,
		patientId: actors.PATIENT1.patientId,
		bookingStatus: 'PENDING',
		createdAt: new Date(),
	});
	await model('Payment').collection.insertOne({
		_id: paymentId,
		patientId: actors.PATIENT1.patientId,
		bookingOrderId: orderId,
		paymentStatus: 'PENDING',
		createdAt: new Date(),
	});
	for (const [field, arg, id] of [
		['getMyPatientReport', 'reportId', reportId],
		['getMyBookingOrder', 'bookingOrderId', orderId],
		['getMyPayment', 'paymentId', paymentId],
	]) {
		checked(
			!(await gql(`query($id:String!){${field}(${arg}:$id){_id}}`, { id: String(id) }, actors.PATIENT1)).body.errors,
			field + ' owner allowed',
		);
		checked(
			Boolean(
				(await gql(`query($id:String!){${field}(${arg}:$id){_id}}`, { id: String(id) }, actors.PATIENT2)).body.errors,
			),
			field + ' nonowner denied',
		);
		for (const role of ['DOCTOR', 'RECEPTIONIST', 'ADMIN'])
			checked(
				(await gql(`query($id:String!){${field}(${arg}:$id){_id}}`, { id: String(id) }, actors[role + 1])).body
					.errors?.[0]?.code === 'FORBIDDEN',
				field + ' ' + role + ' role denied',
			);
	}
	checked(
		!(await gql('query($id:String!){getMyDoctorReport(reportId:$id){_id}}', { id: String(reportId) }, actors.DOCTOR1))
			.body.errors,
		'doctor owns report',
	);
	checked(
		Boolean(
			(await gql('query($id:String!){getMyDoctorReport(reportId:$id){_id}}', { id: String(reportId) }, actors.DOCTOR2))
				.body.errors,
		),
		'other doctor cannot read report',
	);
	for (const field of [
		'getMyPreferences{theme}',
		'getMyNotifications(input:{page:1,limit:10}){list{_id}}',
		'getMyConversations(input:{page:1,limit:10}){total}',
		'getMyDoctorProfile{_id}',
		'getMyAdminProfile{_id}',
		'getMyReceptionistProfile{_id}',
	])
		checked((await gql('{' + field + '}')).body.errors?.[0]?.code === 'UNAUTHENTICATED', 'guest private read denied');
	// Blocking closes an already-connected socket, and ACTIVE cannot resurrect old credentials.
	const endpoint = 'ws://127.0.0.1:' + (process.env.MN_AUTH_VERIFY_PORT ?? 2004);
	async function socketFor(actor) {
		const socket = new WebSocket(endpoint + '/?token=' + actor.token);
		sockets.push(socket);
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
			socket.once('open', () => {
				clearTimeout(timer);
				resolve();
			});
			socket.once('error', reject);
		});
		return socket;
	}
	const doctorSocket = await socketFor(actors.DOCTOR1);
	const closed = new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Socket revocation timeout')), 5000);
		doctorSocket.once('close', (code) => {
			clearTimeout(timer);
			resolve(code);
		});
	});
	const block = await gql(
		'mutation($input:DoctorAdminUpdateInput!){updateDoctorByAdmin(input:$input){_id memberStatus}}',
		{ input: { _id: String(sharedId), memberStatus: 'BLOCK' } },
		actors.ADMIN1,
	);
	checked(!block.body.errors, 'admin blocks doctor');
	checked((await closed) === 1008, 'block closes authenticated socket');
	checked(
		(await gql('{getMyPreferences{theme}}', null, actors.DOCTOR1)).body.errors?.[0]?.code === 'UNAUTHENTICATED',
		'blocked access rejected',
	);
	checked(
		!(await gql('{getMyPreferences{theme}}', null, actors.PATIENT1)).body.errors,
		'same ID patient session unaffected',
	);
	await gql(
		'mutation($input:DoctorStatusUpdateInput!){updateDoctorStatusByAdmin(input:$input){_id}}',
		{ input: { _id: String(sharedId), memberStatus: 'ACTIVE' } },
		actors.ADMIN1,
	);
	checked(
		(await gql('mutation{refreshSession{accessToken}}', null, null, actors.DOCTOR1.cookie)).body.errors?.[0]?.code ===
			'UNAUTHENTICATED',
		'reactivation does not restore old refresh',
	);
	checked(
		(await gql('{getMyPreferences{theme}}', null, actors.DOCTOR1)).body.errors?.[0]?.code === 'UNAUTHENTICATED',
		'reactivation does not restore old access',
	);
	await login(actors.DOCTOR1);
	// Role escalation through patient account editing is forbidden.
	checked(
		Boolean(
			(
				await gql(
					'mutation($input:MemberUpdate!){updateMemberByAdmin(input:$input){_id}}',
					{ input: { _id: String(sharedId), memberType: 'ADMIN' } },
					actors.ADMIN1,
				)
			).body.errors,
		),
		'admin patient edit cannot manufacture staff identity',
	);
	checked(
		Boolean(
			(
				await gql(
					'mutation($input:MemberUpdate!){updateMember(input:$input){_id}}',
					{ input: { _id: String(sharedId), memberFullName: 'Unexpected' } },
					actors.DOCTOR1,
				)
			).body.errors,
		),
		'doctor cannot edit Member collection',
	);
	for (const role of ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN']) {
		const actor = actors[role + '2'];
		await login(actor);
		const oldToken = actor.token;
		const prefix = { PATIENT: 'member', DOCTOR: 'doc', RECEPTIONIST: 'receptionist', ADMIN: 'admin' }[role];
		const nickname = 'edited-' + role.toLowerCase();
		const contact = await gql('mutation($input:AccountProfileInput!){updateMyAccountProfile(input:$input){accessToken}}', {
			input: { nickname, description: 'Owned profile fixture', image: `uploads/${prefix}/fixture.png`, ...(role === 'DOCTOR' ? { experience: 12 } : {}) },
		}, actor);
		checked(!contact.body.errors, role + ' owned account edit');
		actor.token = contact.body.data.updateMyAccountProfile.accessToken;
		actor.input[prefix + 'Nick'] = nickname;
		const storedProfile = await model(actor.name).findById(actor.id).lean().exec();
		checked(storedProfile[prefix + 'Image'] === `uploads/${prefix}/fixture.png` && storedProfile[prefix + 'Desc'] === 'Owned profile fixture', role + ' image and description persisted');
		checked((await gql('{getMyPreferences{theme}}', null, { ...actor, token: oldToken })).body.data?.getMyPreferences, role + ' contact edit preserves the existing session');
		const wrong = await gql('mutation($input:AccountPasswordInput!){changeMyAccountPassword(input:$input){accessToken}}', {
			input: { currentPassword: 'WrongFixturePass', newPassword: 'UpdatedFixturePass123' },
		}, actor, actor.cookie);
		checked(Boolean(wrong.body.errors), role + ' wrong current password rejected');
		const oldCookie = actor.cookie;
		const oldAccess = actor.token;
		const passwordResult = await gql('mutation($input:AccountPasswordInput!){changeMyAccountPassword(input:$input){accessToken}}', {
			input: { currentPassword: actor.input[prefix + 'Password'], newPassword: 'UpdatedFixturePass123' },
		}, actor, actor.cookie);
		checked(!passwordResult.body.errors, role + ' password change');
		checked(passwordResult.headers['set-cookie']?.[0]?.includes('HttpOnly'), role + ' replacement refresh cookie');
		actor.token = passwordResult.body.data.changeMyAccountPassword.accessToken;
		actor.cookie = passwordResult.headers['set-cookie'][0].split(';')[0];
		actor.input[prefix + 'Password'] = 'UpdatedFixturePass123';
		checked((await gql('{getMyPreferences{theme}}', null, { ...actor, token: oldAccess })).body.errors?.[0]?.code === 'UNAUTHENTICATED', role + ' prior access revoked');
		checked((await gql('mutation{refreshSession{accessToken}}', null, null, oldCookie)).body.errors?.[0]?.code === 'UNAUTHENTICATED', role + ' prior refresh revoked');
		checked(!(await gql('{getMyPreferences{theme}}', null, actor)).body.errors, role + ' replacement session accepted');
		const credentials = await model(actor.name).findById(actor.id).select('+' + prefix + 'Password').lean().exec();
		checked(await auth.comparePassword('UpdatedFixturePass123', credentials[prefix + 'Password']), role + ' replacement password hashed');
		await login(actor);
	}
	const collection = connection.collection('refreshToken');
	const stored = await collection.findOne({ ownerId: sharedId, ownerType: 'DOCTOR', revokedAt: null });
	checked(Boolean(stored?.tokenHash && !stored.refreshToken), 'Mongo stores hash only');
	console.log('AUTH_ACCESS_VERIFIED ' + checks + ' checks in isolated Mongo database');
	if (process.env.MN_AUTH_VERIFY_KEEP_ALIVE === '1') {
		// Reset preferences so browser verification starts in English/light.
		await model('UserPreference').updateMany({}, { $set: { language: 'EN', theme: 'LIGHT' } });
		fs.writeFileSync(
			'/tmp/mn-auth-fixture.json',
			JSON.stringify(
				{
					port: Number(process.env.MN_AUTH_VERIFY_PORT ?? 2004),
					database,
					password,
					actors: Object.fromEntries(
						Object.entries(actors)
							.filter(([name]) => name.endsWith('1'))
							.map(([name, actor]) => [
								name,
								{ role: actor.role, nickname: Object.values(actor.input)[0], id: String(actor.id) },
							]),
					),
				},
				null,
				2,
			),
		);
		console.log('AUTH_FIXTURE_READY http://localhost:' + (process.env.MN_AUTH_VERIFY_PORT ?? 2004));
		process.once('SIGINT', () => void cleanup().then(() => process.exit(0)));
		process.once('SIGTERM', () => void cleanup().then(() => process.exit(0)));
	} else await cleanup();
}
main().catch(async (error) => {
	console.error(
		'AUTH_ACCESS_VERIFICATION_FAILED ' +
			String(error.message)
				.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database URI]')
				.replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]'),
	);
	await cleanup();
	process.exitCode = 1;
});
