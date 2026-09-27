import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthModule } from '../src/components/auth/auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { MemberType } from '../src/components/member/enums/member.enum';
import { DoctorResolver } from '../src/components/doctor/doctor.resolver';
import { DoctorService } from '../src/components/doctor/doctor.service';
import { PatientResolver } from '../src/components/patient/patient.resolver';
import { PatientService } from '../src/components/patient/patient.service';
import { ReceptionistResolver } from '../src/components/receptionist/receptionist.resolver';
import { ReceptionistService } from '../src/components/receptionist/receptionist.service';

const adminId = new ObjectId();
const doctorId = new ObjectId();
const patientId = new ObjectId();
const receptionistId = new ObjectId();

describe('Admin profile GraphQL integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const doctorService = {
		getDoctorsByAdmin: jest.fn(),
		getDoctorByAdmin: jest.fn(),
		updateStatusByAdmin: jest.fn(),
	};
	const patientService = {
		getPatientsByAdmin: jest.fn(),
		getPatientByAdmin: jest.fn(),
		updateStatusByAdmin: jest.fn(),
	};
	const receptionistService = {
		getReceptionistByAdmin: jest.fn(),
		updateStatusByAdmin: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'admin-profile-integration-test-secret';
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
			],
			providers: [
				DoctorResolver,
				PatientResolver,
				ReceptionistResolver,
				RolesGuard,
				{ provide: DoctorService, useValue: doctorService },
				{ provide: PatientService, useValue: patientService },
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

	async function adminToken(): Promise<string> {
		return authService.createToken({ _id: adminId, memberType: MemberType.ADMIN });
	}

	async function receptionistToken(): Promise<string> {
		return authService.createToken({ _id: receptionistId, memberType: MemberType.RECEPTIONIST });
	}

	it('queries doctors by admin with GraphQL variables', async () => {
		doctorService.getDoctorsByAdmin.mockResolvedValue({
			list: [{ _id: doctorId, memberType: MemberType.DOCTOR, memberStatus: 'ACTIVE', docNick: 'doctor01' }],
			metaCounter: [{ total: 1 }],
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await adminToken()}`)
			.send({
				query: `query GetDoctorsByAdmin($input: AdminDoctorInquiry!) {
					getDoctorsByAdmin(input: $input) { list { _id memberType memberStatus docNick } }
				}`,
				variables: { input: { page: 1, limit: 10, text: 'doctor', memberStatus: 'ACTIVE' } },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getDoctorsByAdmin.list[0].docNick).toBe('doctor01');
		expect(doctorService.getDoctorsByAdmin).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, limit: 10, text: 'doctor' }),
		);
	});

	it('updates patient status only through the admin role', async () => {
		patientService.updateStatusByAdmin.mockResolvedValue({
			_id: patientId,
			memberId: new ObjectId(),
			memberType: MemberType.PATIENT,
			memberStatus: 'BLOCK',
			patientFullName: 'Test Patient',
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await adminToken()}`)
			.send({
				query: `mutation UpdatePatientStatus($input: PatientStatusUpdateInput!) {
					updatePatientStatusByAdmin(input: $input) { _id memberStatus patientFullName }
				}`,
				variables: { input: { _id: patientId.toString(), memberStatus: 'BLOCK' } },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.updatePatientStatusByAdmin.memberStatus).toBe('BLOCK');
		expect(patientService.updateStatusByAdmin).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			'BLOCK',
		);
	});

	it('reads receptionist detail through the admin profile query', async () => {
		receptionistService.getReceptionistByAdmin.mockResolvedValue({
			_id: receptionistId,
			memberType: MemberType.RECEPTIONIST,
			memberStatus: 'ACTIVE',
			receptionistNick: 'frontdesk01',
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await adminToken()}`)
			.send({
				query: `query GetReceptionistByAdmin($receptionistId: String!) {
					getReceptionistByAdmin(receptionistId: $receptionistId) { _id memberType memberStatus receptionistNick }
				}`,
				variables: { receptionistId: receptionistId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getReceptionistByAdmin.receptionistNick).toBe('frontdesk01');
	});

	it('rejects a receptionist from admin doctor queries', async () => {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', `Bearer ${await receptionistToken()}`)
			.send({
				query: `query GetDoctorsByAdmin($input: AdminDoctorInquiry!) {
					getDoctorsByAdmin(input: $input) { list { _id } }
				}`,
				variables: { input: { page: 1, limit: 10 } },
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(doctorService.getDoctorsByAdmin).not.toHaveBeenCalled();
	});
});
