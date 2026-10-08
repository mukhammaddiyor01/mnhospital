import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Types } from 'mongoose';
import { createAuthFixture } from '../../../test/auth-fixture';
import { MemberType } from '../member/enums/member.enum';
import { RolesGuard } from './guards/roles.guard';
import { AuthGuard } from './guards/auth.guard';

const policies: [MemberType[], string[]][] = [
	[
		[MemberType.PATIENT],
		[
			'getMyMemberProfile',
			'updateMember',
			'getFavorites',
			'getVisited',
			'createPatientProfile',
			'getMyPatientProfile',
			'updateMyPatientProfile',
			'uploadMyPatientImage',
			'createCart',
			'addCartItem',
			'removeCartItem',
			'getMyCart',
			'createBookingOrder',
			'cancelBookingOrder',
			'getMyBookingOrders',
			'getMyBookingOrder',
			'createPayment',
			'getMyPayments',
			'getMyPayment',
			'prepareEximbayPayment',
			'createAppointment',
			'cancelAppointment',
			'getMyAppointments',
			'getMyPatientReports',
			'getMyPatientReport',
		],
	],
	[
		[MemberType.DOCTOR],
		[
			'createService',
			'updateService',
			'getDoctorServices',
			'createArticle',
			'updateArticle',
			'getMyArticles',
			'createDepartment',
			'upsertMyDoctorSchedule',
			'getMyDoctorProfile',
			'updateMyDoctorProfile',
			'getMyDoctorDashboardStats',
			'getMyDoctorBookingRequests',
			'getMyDoctorServiceTypes',
			'createDoctorReport',
			'updateDoctorReport',
			'getMyDoctorReports',
			'getMyDoctorReport',
		],
	],
	[
		[MemberType.ADMIN],
		[
			'getMyAdminProfile',
			'getAdminDashboardStats',
			'getPatientActivityByAdmin',
			'getAllMembersByAdmin',
			'updateMemberByAdmin',
			'getAllServicesByAdmin',
			'updateServiceByAdmin',
			'removeServiceByAdmin',
			'getAllArticlesByAdmin',
			'updateArticleByAdmin',
			'removeArticleByAdmin',
			'getCommentsByAdmin',
			'removeCommentByAdmin',
			'getAdvertisementsByAdmin',
			'createAdvertisement',
			'updateAdvertisement',
			'removeAdvertisement',
			'createDoctorByAdmin',
			'getAvailableDoctorRooms',
			'updateDoctorByAdmin',
			'updateDoctorStatusByAdmin',
			'getDoctorsByAdmin',
			'getDoctorByAdmin',
			'getDoctorDashboardStatsByAdmin',
			'getPatientsByAdmin',
			'getPatientByAdmin',
			'updatePatientStatusByAdmin',
			'createReceptionist',
			'getReceptionists',
			'getReceptionistByAdmin',
			'getReceptionistDashboardStatsByAdmin',
			'updateReceptionistByAdmin',
			'updateReceptionistStatusByAdmin',
			'removeReceptionistByAdmin',
			'createRoom',
			'updateRoom',
			'createNotice',
			'updateNotice',
			'archiveNotice',
		],
	],
	[
		[MemberType.RECEPTIONIST],
		[
			'getMyReceptionistProfile',
			'updateMyReceptionistProfile',
			'getMyReceptionistDashboardStats',
			'getMyReceptionistReports',
			'getMyReceptionistAppointmentQueue',
			'checkInReceptionistAppointment',
		],
	],
	[
		[MemberType.RECEPTIONIST, MemberType.ADMIN],
		[
			'createReceptionTask',
			'getReceptionTasks',
			'getReceptionTask',
			'updateReceptionTaskStatus',
			'getBookingOrders',
			'getPayments',
			'updatePaymentStatus',
		],
	],
	[
		[MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN],
		['getAppointments', 'updateAppointmentStatus'],
	],
	[
		Object.values(MemberType),
		[
			'getMyPreferences',
			'updateMyPreferences',
			'getMyNotifications',
			'getMyNotification',
			'markMyNotificationRead',
			'markAllMyNotificationsRead',
			'archiveMyNotification',
			'startDirectConversation',
			'getMyConversations',
			'getMyConversation',
			'getMyMessages',
			'sendDirectMessage',
			'markMyMessagesRead',
		],
	],
];
function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
		item.isDirectory() ? files(join(dir, item.name)) : item.name.endsWith('.resolver.ts') ? [join(dir, item.name)] : [],
	);
}
const handlers = new Map<string, Function>();
for (const file of files(join(__dirname, '..')))
	for (const value of Object.values(require(file)) as any[]) {
		if (typeof value !== 'function' || !value.prototype) continue;
		for (const name of Object.getOwnPropertyNames(value.prototype))
			if (name !== 'constructor') handlers.set(name, value.prototype[name]);
	}
describe('Hospital role policy regression', () => {
	const cases = policies.flatMap(([roles, names]) => names.map((name) => ({ name, roles })));
	it.each(cases)('enforces $name for every role and rejects guest access', async ({ name, roles }) => {
		const handler = handlers.get(name);
		expect(handler).toBeDefined();
		expect([...(Reflect.getMetadata('roles', handler) ?? [])].sort()).toEqual([...roles].sort());
		expect(Reflect.getMetadata('__guards__', handler)).toContain(RolesGuard);
		const fixture = createAuthFixture();
		const id = new Types.ObjectId();
		const guard = new RolesGuard(new Reflector(), fixture.auth);
		const context = (token?: string) => ({
			contextType: 'graphql',
			getHandler: () => handler,
			getArgByIndex: () => ({ req: { headers: token ? { authorization: 'Bearer ' + token } : {}, body: {} } }),
		});
		await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
		for (const role of Object.values(MemberType)) {
			const session = await fixture.auth.startSession(fixture.profile(role, id));
			if (roles.includes(role)) expect(await guard.canActivate(context(session.accessToken))).toBe(true);
			else await expect(guard.canActivate(context(session.accessToken))).rejects.toMatchObject({ status: 403 });
		}
	});
	it('requires explicit role metadata for role-guarded handlers', async () => {
		const fixture = createAuthFixture();
		const guard = new RolesGuard(new Reflector(), fixture.auth);
		await expect(guard.canActivate({ getHandler: () => () => undefined })).rejects.toMatchObject({ status: 403 });
	});
	it('rejects malformed bearer headers in both guard implementations', async () => {
		const fixture = createAuthFixture();
		const handler = handlers.get('getMyPreferences');
		for (const guard of [new RolesGuard(new Reflector(), fixture.auth), new AuthGuard(fixture.auth)])
			for (const header of [undefined, 'Basic token', 'Bearer', 'Bearer one two', ['Bearer token']]) {
				await expect(
					guard.canActivate({
						contextType: 'graphql',
						getHandler: () => handler,
						getArgByIndex: () => ({ req: { headers: { authorization: header }, body: {} } }),
					}),
				).rejects.toMatchObject({ status: 401 });
			}
	});
});
