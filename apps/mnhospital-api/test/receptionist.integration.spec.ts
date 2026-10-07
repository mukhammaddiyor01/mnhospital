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
import {
	ReceptionTaskStatus,
	ReceptionTaskType,
	ReceptionTaskPriority,
} from '../src/components/receptionist/enums/receptionist.enum';

const receptionistId = new ObjectId();
const adminId = new ObjectId();
const appointmentId = new ObjectId();
const patientId = new ObjectId();
const doctorId = new ObjectId();

const receptionist = {
	_id: receptionistId,
	memberType: MemberType.RECEPTIONIST,
	memberStatus: 'ACTIVE',
	memberAuthType: 'PHONE',
	receptionistNick: 'frontdesk01',
	receptionistPhone: '+821012345678',
	receptionistMail: 'frontdesk01@mnhospital.test',
	receptionistFullName: 'Front Desk',
	receptionistImage: '',
	createdAt: new Date(),
	updatedAt: new Date(),
};

const receptionTask = {
	_id: new ObjectId(),
	appointmentId,
	patientId,
	doctorId,
	receptionistId,
	createdByMemberId: receptionistId,
	taskType: ReceptionTaskType.CHECK_IN,
	taskPriority: ReceptionTaskPriority.MEDIUM,
	taskStatus: ReceptionTaskStatus.PENDING,
	taskInstruction: 'Confirm the appointment details',
	statusHistory: [],
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe('Receptionist GraphQL integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const receptionistService = {
		loginReceptionist: jest.fn(),
		getMyProfile: jest.fn(),
		createReceptionist: jest.fn(),
		createTask: jest.fn(),
		updateTask: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'receptionist-integration-test-secret';
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

	it('logs in a receptionist with GraphQL variables', async () => {
		receptionistService.loginReceptionist.mockResolvedValue({ ...receptionist, accessToken: 'receptionist-token' });

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.send({
				query: `
					mutation LoginReceptionist($input: ReceptionistLoginInput!) {
						loginReceptionist(input: $input) { _id memberType receptionistNick accessToken }
					}
				`,
				variables: {
					input: { receptionistNick: 'frontdesk01', receptionistPassword: 'password123' },
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.loginReceptionist.receptionistNick).toBe('frontdesk01');
		expect(receptionistService.loginReceptionist).toHaveBeenCalledWith({
			receptionistNick: 'frontdesk01',
			receptionistPassword: 'password123',
		});
	});

	it('allows an authenticated receptionist to read only their profile', async () => {
		receptionistService.getMyProfile.mockResolvedValue(receptionist);
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `query { getMyReceptionistProfile { _id memberType receptionistNick } }`,
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getMyReceptionistProfile._id).toBe(receptionistId.toString());
		expect(receptionistService.getMyProfile).toHaveBeenCalledWith(
			expect.objectContaining({
				toString: expect.any(Function),
			}),
		);
	});

	it('allows only an admin token to create a receptionist', async () => {
		receptionistService.createReceptionist.mockResolvedValue(receptionist);
		const token = await tokenFor(adminId, MemberType.ADMIN);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation CreateReceptionist($input: ReceptionistInput!) {
						createReceptionist(input: $input) { _id memberType receptionistNick }
					}
				`,
				variables: {
					input: {
						receptionistNick: 'frontdesk01',
						receptionistPassword: 'password123',
						receptionistPhone: '+821012345678',
						receptionistMail: 'frontdesk01@mnhospital.test',
						receptionistFullName: 'Front Desk',
					},
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.createReceptionist.memberType).toBe(MemberType.RECEPTIONIST);
		expect(receptionistService.createReceptionist).toHaveBeenCalled();
	});

	it('rejects receptionist access to the admin-only create mutation', async () => {
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation CreateReceptionist($input: ReceptionistInput!) {
						createReceptionist(input: $input) { _id }
					}
				`,
				variables: {
					input: {
						receptionistNick: 'frontdesk02',
						receptionistPassword: 'password123',
						receptionistPhone: '+821012345679',
						receptionistMail: 'frontdesk02@mnhospital.test',
						receptionistFullName: 'Second Front Desk',
					},
				},
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(receptionistService.createReceptionist).not.toHaveBeenCalled();
	});

	it('creates and updates a reception task with ownership context', async () => {
		receptionistService.createTask.mockResolvedValue(receptionTask);
		receptionistService.updateTask.mockResolvedValue({
			...receptionTask,
			taskStatus: ReceptionTaskStatus.ACCEPTED,
		});
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const createResponse = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation CreateReceptionTask($input: ReceptionTaskInput!) {
						createReceptionTask(input: $input) { _id appointmentId receptionistId taskStatus }
					}
				`,
				variables: {
					input: {
						appointmentId: appointmentId.toString(),
						taskType: ReceptionTaskType.CHECK_IN,
						taskPriority: ReceptionTaskPriority.MEDIUM,
						taskInstruction: 'Confirm the appointment details',
					},
				},
			});

		expect(createResponse.body.errors).toBeUndefined();
		expect(createResponse.body.data.createReceptionTask.taskStatus).toBe(ReceptionTaskStatus.PENDING);
		expect(receptionistService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			MemberType.RECEPTIONIST,
			expect.objectContaining({ appointmentId: expect.objectContaining({ toString: expect.any(Function) }) }),
		);

		const updateResponse = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation UpdateReceptionTask($input: ReceptionTaskStatusInput!) {
						updateReceptionTaskStatus(input: $input) { _id taskStatus }
					}
				`,
				variables: {
					input: { taskId: receptionTask._id.toString(), taskStatus: ReceptionTaskStatus.ACCEPTED },
				},
			});

		expect(updateResponse.body.errors).toBeUndefined();
		expect(updateResponse.body.data.updateReceptionTaskStatus.taskStatus).toBe(ReceptionTaskStatus.ACCEPTED);
		expect(receptionistService.updateTask).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			MemberType.RECEPTIONIST,
			expect.objectContaining({ taskId: expect.objectContaining({ toString: expect.any(Function) }) }),
		);
	});
});
