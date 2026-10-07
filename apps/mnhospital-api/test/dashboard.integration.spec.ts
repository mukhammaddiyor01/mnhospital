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
import { AdminResolver } from '../src/components/admin/admin.resolver';
import { AdminService } from '../src/components/admin/admin.service';
import { DoctorResolver } from '../src/components/doctor/doctor.resolver';
import { DoctorService } from '../src/components/doctor/doctor.service';
import { ReceptionistResolver } from '../src/components/receptionist/receptionist.resolver';
import { ReceptionistService } from '../src/components/receptionist/receptionist.service';

const adminId = new ObjectId();
const doctorId = new ObjectId();
const receptionistId = new ObjectId();
const patientId = new ObjectId();

describe('Dashboard GraphQL integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const adminService = {
		getDashboardStats: jest.fn(),
		getPatientActivityByAdmin: jest.fn(),
	};
	const doctorService = {
		getDashboardStats: jest.fn(),
	};
	const receptionistService = {
		getDashboardStats: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'dashboard-integration-test-secret';
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					context: ({ req, res }) => ({ req, res }),
					autoSchemaFile: true,
				}),
			],
			providers: [
				AdminResolver,
				DoctorResolver,
				ReceptionistResolver,
				RolesGuard,
				{ provide: AdminService, useValue: adminService },
				{ provide: DoctorService, useValue: doctorService },
				{ provide: ReceptionistService, useValue: receptionistService },
			],
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

	it('returns the admin overview dashboard', async () => {
		adminService.getDashboardStats.mockResolvedValue({
			totalPatients: 20,
			activePatients: 18,
			totalDoctors: 4,
			activeDoctors: 3,
			totalReceptionists: 2,
			activeReceptionists: 2,
			totalBookings: 31,
			totalAppointments: 27,
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(adminId, MemberType.ADMIN)}`)
			.send({
				query: `query {
					getAdminDashboardStats { totalPatients activePatients totalDoctors totalAppointments }
				}`,
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getAdminDashboardStats.totalPatients).toBe(20);
	});

	it('returns patient activity through the admin dashboard flow', async () => {
		adminService.getPatientActivityByAdmin.mockResolvedValue({
			patient: { _id: patientId, memberStatus: 'ACTIVE' },
			bookingOrders: [],
			services: [],
			appointments: [],
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(adminId, MemberType.ADMIN)}`)
			.send({
				query: `query GetPatientActivity($patientId: String!) {
					getPatientActivityByAdmin(patientId: $patientId) {
						patient { _id memberStatus }
						bookingOrders { _id }
						services { _id }
						appointments { _id }
					}
				}`,
				variables: { patientId: patientId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getPatientActivityByAdmin.patient._id).toBe(patientId.toString());
	});

	it('returns doctor dashboard statistics for an admin', async () => {
		doctorService.getDashboardStats.mockResolvedValue({
			doctorId,
			memberStatus: 'ACTIVE',
			serviceCount: 4,
			patientCount: 12,
			appointmentCount: 22,
			completedAppointmentCount: 16,
			reportCount: 10,
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(adminId, MemberType.ADMIN)}`)
			.send({
				query: `query GetDoctorDashboard($doctorId: String!) {
					getDoctorDashboardStatsByAdmin(doctorId: $doctorId) { doctorId serviceCount patientCount reportCount }
				}`,
				variables: { doctorId: doctorId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getDoctorDashboardStatsByAdmin.serviceCount).toBe(4);
	});

	it('returns receptionist workload statistics for an admin', async () => {
		receptionistService.getDashboardStats.mockResolvedValue({
			receptionistId,
			memberStatus: 'ACTIVE',
			taskCount: 8,
			pendingTaskCount: 2,
			acceptedTaskCount: 1,
			inProgressTaskCount: 2,
			completedTaskCount: 3,
			cancelledTaskCount: 0,
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(adminId, MemberType.ADMIN)}`)
			.send({
				query: `query GetReceptionistDashboard($receptionistId: String!) {
					getReceptionistDashboardStatsByAdmin(receptionistId: $receptionistId) { receptionistId taskCount completedTaskCount }
				}`,
				variables: { receptionistId: receptionistId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getReceptionistDashboardStatsByAdmin.taskCount).toBe(8);
	});

	it('rejects a doctor from the admin overview dashboard', async () => {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(doctorId, MemberType.DOCTOR)}`)
			.send({ query: `query { getAdminDashboardStats { totalPatients } }` });

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(adminService.getDashboardStats).not.toHaveBeenCalled();
	});
});
