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
import { DoctorReportsResolver } from '../src/components/doctor/doctor-reports/doctorReports.resolver';
import { DoctorReportsService } from '../src/components/doctor/doctor-reports/doctorReports.service';
import { ReceptionistResolver } from '../src/components/receptionist/receptionist.resolver';
import { ReceptionistService } from '../src/components/receptionist/receptionist.service';
import { DoctorReportFollowUp } from '../src/components/doctor/doctor-reports/enums/doctor-report.enum';

const doctorId = new ObjectId();
const patientId = new ObjectId();
const receptionistId = new ObjectId();
const appointmentId = new ObjectId();
const reportId = new ObjectId();

const report = {
	_id: reportId,
	doctorId,
	patientId,
	appointmentId,
	serviceId: new ObjectId(),
	docReportSymptoms: 'Headache',
	docReportObservations: 'Stable',
	docReportDiagnosis: 'Routine diagnosis',
	docReportRecommendation: 'Follow the treatment plan',
	docReportMedication: 'Medication',
	docReportFollowUp: DoctorReportFollowUp.NONE,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe('Doctor report security integration', () => {
	let app: INestApplication;
	let authService: AuthService;
	const doctorReportsService = {
		createReport: jest.fn(),
		getMyPatientReport: jest.fn(),
	};
	const receptionistService = {
		getMyReports: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'report-security-integration-test-secret';
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
				DoctorReportsResolver,
				ReceptionistResolver,
				RolesGuard,
				{ provide: DoctorReportsService, useValue: doctorReportsService },
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

	it('allows a doctor to create a report through the report mutation', async () => {
		doctorReportsService.createReport.mockResolvedValue(report);
		const token = await tokenFor(doctorId, MemberType.DOCTOR);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation CreateDoctorReport($input: DoctorReportInput!) {
						createDoctorReport(input: $input) { _id doctorId patientId appointmentId }
					}
				`,
				variables: {
					input: {
						appointmentId: appointmentId.toString(),
						docReportSymptoms: 'Headache',
						docReportDiagnosis: 'Routine diagnosis',
						docReportMedication: 'Medication',
						docReportFollowUp: 'NONE',
					},
				},
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.createDoctorReport.appointmentId).toBe(appointmentId.toString());
		expect(doctorReportsService.createReport).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ appointmentId: expect.objectContaining({ toString: expect.any(Function) }) }),
		);
	});

	it('rejects a patient from creating a doctor report', async () => {
		const token = await tokenFor(patientId, MemberType.PATIENT);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `
					mutation CreateDoctorReport($input: DoctorReportInput!) {
						createDoctorReport(input: $input) { _id }
					}
				`,
				variables: {
					input: {
						appointmentId: appointmentId.toString(),
						docReportSymptoms: 'Headache',
						docReportDiagnosis: 'Routine diagnosis',
						docReportMedication: 'Medication',
						docReportFollowUp: 'NONE',
					},
				},
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(doctorReportsService.createReport).not.toHaveBeenCalled();
	});

	it('allows a patient to read only through the patient report query', async () => {
		doctorReportsService.getMyPatientReport.mockResolvedValue(report);
		const token = await tokenFor(patientId, MemberType.PATIENT);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `query GetMyPatientReport($reportId: String!) {
					getMyPatientReport(reportId: $reportId) { _id patientId appointmentId }
				}`,
				variables: { reportId: reportId.toString() },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getMyPatientReport.patientId).toBe(patientId.toString());
		expect(doctorReportsService.getMyPatientReport).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ toString: expect.any(Function) }),
		);
	});

	it('allows a receptionist to read reports through assigned task scope', async () => {
		receptionistService.getMyReports.mockResolvedValue({ list: [report], metaCounter: [{ total: 1 }] });
		const token = await tokenFor(receptionistId, MemberType.RECEPTIONIST);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `query GetMyReceptionistReports($input: ReceptionistReportInquiry!) {
					getMyReceptionistReports(input: $input) { list { _id patientId appointmentId } }
				}`,
				variables: { input: { page: 1, limit: 10, patientId: patientId.toString() } },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getMyReceptionistReports.list).toHaveLength(1);
		expect(receptionistService.getMyReports).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			expect.objectContaining({ patientId: expect.objectContaining({ toString: expect.any(Function) }) }),
		);
	});

	it('rejects a doctor from the receptionist report query', async () => {
		const token = await tokenFor(doctorId, MemberType.DOCTOR);

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${token}`)
			.send({
				query: `query GetMyReceptionistReports($input: ReceptionistReportInquiry!) {
					getMyReceptionistReports(input: $input) { list { _id } }
				}`,
				variables: { input: { page: 1, limit: 10 } },
			});

		expect(response.body.data).toBeNull();
		expect(response.body.errors?.[0].message).toContain('specific roles');
		expect(receptionistService.getMyReports).not.toHaveBeenCalled();
	});
});
