import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { TestAuthModule as AuthModule } from './test-auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { MemberType } from '../src/components/member/enums/member.enum';
import { ReceptionistResolver } from '../src/components/receptionist/receptionist.resolver';
import { ReceptionistService } from '../src/components/receptionist/receptionist.service';
import { AppointmentStatus } from '../src/libs/enums/appointment.enum';

const receptionistId = new ObjectId();
const adminId = new ObjectId();
const appointmentId = new ObjectId();

describe('Receptionist appointment queue GraphQL integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const receptionistService = {
		getMyAppointmentQueue: jest.fn(),
		checkInAppointment: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'receptionist-queue-integration-test-secret';
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					context: ({ req, res }) => ({ req, res }),
					autoSchemaFile: true,
				}),
			],
			providers: [ReceptionistResolver, RolesGuard, { provide: ReceptionistService, useValue: receptionistService }],
		}).compile();

		app = moduleFixture.createNestApplication();
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

	it('reads the receptionist-owned appointment queue with variables', async () => {
		receptionistService.getMyAppointmentQueue.mockResolvedValue({
			list: [
				{
					_id: appointmentId,
					appointmentCode: 'APT-QUEUE-001',
					appointmentStatus: AppointmentStatus.CONFIRMED,
				},
			],
			metaCounter: [{ total: 1 }],
		});
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `query ReceptionistQueue($input: ReceptionistAppointmentQueueInquiry!) {
					getMyReceptionistAppointmentQueue(input: $input) {
						list { _id appointmentCode appointmentStatus }
						metaCounter { total }
					}
				}`,
				variables: {
					input: { page: 1, limit: 10, status: AppointmentStatus.CONFIRMED },
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getMyReceptionistAppointmentQueue.list[0].appointmentCode).toBe('APT-QUEUE-001');
		expect(receptionistService.getMyAppointmentQueue).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ page: 1, limit: 10, status: AppointmentStatus.CONFIRMED }),
		);
	});

	it('checks in an appointment using the authenticated receptionist context', async () => {
		receptionistService.checkInAppointment.mockResolvedValue({
			_id: appointmentId,
			appointmentCode: 'APT-QUEUE-001',
			appointmentStatus: AppointmentStatus.IN_PROGRESS,
		});
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `mutation CheckIn($input: ReceptionistCheckInInput!) {
					checkInReceptionistAppointment(input: $input) { _id appointmentCode appointmentStatus }
				}`,
				variables: {
					input: { appointmentId: appointmentId.toString(), reason: 'Patient arrived at reception' },
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.checkInReceptionistAppointment.appointmentStatus).toBe(AppointmentStatus.IN_PROGRESS);
		expect(receptionistService.checkInAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ toString: expect.any(Function) }),
			'Patient arrived at reception',
		);
	});

	it('rejects appointment check-in for a non-receptionist role', async () => {
		const token = await tokenFor(adminId, MemberType.ADMIN);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `mutation CheckIn($input: ReceptionistCheckInInput!) {
					checkInReceptionistAppointment(input: $input) { _id }
				}`,
				variables: { input: { appointmentId: appointmentId.toString() } },
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(receptionistService.checkInAppointment).not.toHaveBeenCalled();
	});
});
