import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthModule } from '../src/components/auth/auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { WithoutGuard } from '../src/components/auth/guards/without.guard';
import { MemberType } from '../src/components/member/enums/member.enum';
import { NotificationResolver } from '../src/components/notification/notification.resolver';
import { NoticeResolver } from '../src/components/notification/notice.resolver';
import { NotificationService } from '../src/components/notification/notification.service';
import { NoticeService } from '../src/components/notification/notice.service';
import { NotificationStatus, NotificationType, NoticeStatus } from '../src/components/notification/enums/notification.enum';

const patientId = new ObjectId();
const adminId = new ObjectId();
const notificationId = new ObjectId();
const noticeId = new ObjectId();
const appointmentId = new ObjectId();

describe('Notification and notice GraphQL integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const notificationService = {
		getMyNotifications: jest.fn(),
		getMyNotification: jest.fn(),
		markMyNotificationRead: jest.fn(),
		markAllMyNotificationsRead: jest.fn(),
		archiveMyNotification: jest.fn(),
	};
	const noticeService = {
		getPublishedNotices: jest.fn(),
		getNoticesByAdmin: jest.fn(),
		createNotice: jest.fn(),
		updateNotice: jest.fn(),
		archiveNotice: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'notification-integration-test-secret';
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
			],
			providers: [
				NotificationResolver,
				NoticeResolver,
				RolesGuard,
				WithoutGuard,
				{ provide: NotificationService, useValue: notificationService },
				{ provide: NoticeService, useValue: noticeService },
			],
		}).compile();

			app = moduleFixture.createNestApplication();
			app.useGlobalPipes(new ValidationPipe());
			await app.init();
		authService = app.get(AuthService);
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	async function tokenFor(memberId: ObjectId, memberType: MemberType): Promise<string> {
		return authService.createToken({ _id: memberId, memberType });
	}

	it('reads only the authenticated profile notifications with variables', async () => {
		notificationService.getMyNotifications.mockResolvedValue({
			list: [
				{
					_id: notificationId,
					notificationType: NotificationType.APPOINTMENT,
					notificationStatus: NotificationStatus.UNREAD,
					notificationGroup: 'APPOINTMENT',
					notificationTitle: 'Appointment confirmed',
					notificationDesc: 'Your appointment was confirmed',
					notificationRefId: appointmentId,
				},
			],
			metaCounter: [{ total: 1 }],
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({
				query: `query GetMyNotifications($input: NotificationInquiry!) {
					getMyNotifications(input: $input) {
						list { _id notificationType notificationStatus notificationTitle notificationRefId }
						metaCounter { total }
					}
				}`,
				variables: {
					input: { page: 1, limit: 10, notificationStatus: NotificationStatus.UNREAD },
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getMyNotifications.list[0].notificationTitle).toBe('Appointment confirmed');
		expect(notificationService.getMyNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			MemberType.PATIENT,
			expect.objectContaining({ page: 1, limit: 10, notificationStatus: NotificationStatus.UNREAD }),
		);
	});

	it('marks a notification as read through the receiver ownership context', async () => {
		notificationService.markMyNotificationRead.mockResolvedValue({
			_id: notificationId,
			notificationStatus: NotificationStatus.READ,
			notificationType: NotificationType.APPOINTMENT,
			notificationGroup: 'APPOINTMENT',
			notificationTitle: 'Appointment confirmed',
			notificationDesc: 'Read notification',
			notificationRefId: appointmentId,
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({
				query: `mutation MarkNotificationRead($notificationId: String!) {
					markMyNotificationRead(notificationId: $notificationId) { _id notificationStatus }
				}`,
				variables: { notificationId: notificationId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.markMyNotificationRead.notificationStatus).toBe(NotificationStatus.READ);
		expect(notificationService.markMyNotificationRead).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			MemberType.PATIENT,
			expect.objectContaining({ toString: expect.any(Function) }),
		);
	});

	it('rejects a malformed notification ID before calling the service', async () => {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({ query: 'query { getMyNotification(notificationId: "not-an-id") { _id } }' });
		expect(response.body.errors?.[0].message).toContain('Invalid notification ID');
		expect(notificationService.getMyNotification).not.toHaveBeenCalled();
	});

	it('requires a valid page and limit for the notification inbox', async () => {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({ query: 'query { getMyNotifications(input: { page: 0, limit: 101 }) { metaCounter { total } } }' });
		expect(response.body.errors).toBeDefined();
		expect(notificationService.getMyNotifications).not.toHaveBeenCalled();
	});

	it('allows an admin to create a draft notice with profile ownership', async () => {
		noticeService.createNotice.mockResolvedValue({
			_id: noticeId,
			noticeCategory: 'SYSTEM',
			noticeStatus: NoticeStatus.DRAFT,
			noticeTitle: 'Maintenance notice',
			noticeContent: 'System maintenance is scheduled',
			authorId: adminId,
			authorType: MemberType.ADMIN,
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(adminId, MemberType.ADMIN)}`)
			.send({
				query: `mutation CreateNotice($input: NoticeInput!) {
					createNotice(input: $input) { _id noticeStatus noticeTitle authorType }
				}`,
				variables: {
					input: {
						noticeCategory: 'SYSTEM',
						noticeTitle: 'Maintenance notice',
						noticeContent: 'System maintenance is scheduled',
					},
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.createNotice.noticeStatus).toBe(NoticeStatus.DRAFT);
		expect(noticeService.createNotice).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ noticeTitle: 'Maintenance notice' }),
		);
	});

	it('exposes only published notices without authentication', async () => {
		noticeService.getPublishedNotices.mockResolvedValue({
			list: [
				{
					_id: noticeId,
					noticeCategory: 'GENERAL',
					noticeStatus: NoticeStatus.PUBLISHED,
					noticeTitle: 'Hospital notice',
					noticeContent: 'Welcome to MNHospital',
				},
			],
			metaCounter: [{ total: 1 }],
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: `query GetPublishedNotices($input: NoticeInquiry!) {
					getPublishedNotices(input: $input) { list { _id noticeStatus noticeTitle } }
				}`,
				variables: { input: { page: 1, limit: 10 } },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getPublishedNotices.list[0].noticeStatus).toBe(NoticeStatus.PUBLISHED);
	});

	it('rejects a patient from the admin notice list', async () => {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({
				query: `query GetNoticesByAdmin($input: NoticeInquiry!) {
					getNoticesByAdmin(input: $input) { list { _id } }
				}`,
				variables: { input: { page: 1, limit: 10 } },
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(noticeService.getNoticesByAdmin).not.toHaveBeenCalled();
	});
});
