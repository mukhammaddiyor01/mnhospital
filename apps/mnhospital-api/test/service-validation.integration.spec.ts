import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { TestAuthModule } from './test-auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { MemberType } from '../src/components/member/enums/member.enum';
import { ServiceResolver } from '../src/components/service/service.resolver';
import { ServiceService } from '../src/components/service/service.service';
import { formatGraphQLError } from '../src/libs/graphql/format-error';

describe('Service creation GraphQL validation', () => {
	let app: INestApplication;
	let token: string;
	const doctorId = new Types.ObjectId();
	const serviceId = new Types.ObjectId();
	const service = { createService: jest.fn() };
	const input = {
		departmentId: String(new Types.ObjectId()),
		serviceType: 'CONSULTATION',
		serviceName: 'Consultation',
		serviceRoomName: 'CLINIC',
		serviceRoom: 'ROOM101',
		serviceTitle: 'Doctor consultation',
		servicePrice: 30,
		serviceImages: ['service/photo.jpg'],
		serviceDesc: 'Doctor consultation description',
		serviceDuration: '90',
		availabilityDates: [],
	};

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [
				TestAuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					autoSchemaFile: true,
					context: ({ req, res }) => ({ req, res }),
					formatError: formatGraphQLError,
				}),
			],
			providers: [ServiceResolver, { provide: ServiceService, useValue: service }],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe());
		await app.init();
		token = await app.get(AuthService).createToken({ _id: doctorId, memberType: MemberType.DOCTOR });
	});
	afterAll(async () => app?.close());
	beforeEach(() => {
		jest.clearAllMocks();
		service.createService.mockResolvedValue({ _id: serviceId });
	});

	const create = (values: Record<string, unknown>, authToken = token) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${authToken}`)
			.send({
				query: 'mutation($input: ServiceInput!) { createService(input: $input) { _id } }',
				variables: { input: values },
			});

	it.each(['60', '90', '1', '1440'])('accepts an exact duration of %s minutes for the authenticated doctor', async (duration) => {
		const result = await create({ ...input, serviceDuration: duration });
		expect(result.body.errors).toBeUndefined();
		expect(result.body.data.createService._id).toBe(String(serviceId));
		expect(service.createService).toHaveBeenCalledWith(expect.objectContaining({ memberId: doctorId, serviceDuration: duration }));
	});

	it.each(['1~1.30 hours', '0', '1441', '1.5'])('explains invalid duration %s without reaching persistence', async (duration) => {
		const result = await create({ ...input, serviceDuration: duration });
		expect(result.body.errors[0]).toEqual({ code: 'BAD_REQUEST', message: 'Duration must be 1 to 1440 whole minutes' });
		expect(service.createService).not.toHaveBeenCalled();
	});

	it('returns multiple field errors as a readable GraphQL message', async () => {
		const result = await create({ ...input, serviceDuration: '1~1.30 hours', serviceImages: [] });
		expect(result.body.errors[0].message).toContain('Duration must be 1 to 1440 whole minutes');
		expect(result.body.errors[0].message).toContain('serviceImages');
		expect(typeof result.body.errors[0].message).toBe('string');
		expect(service.createService).not.toHaveBeenCalled();
	});

	it('keeps creation restricted to doctors', async () => {
		const patientToken = await app.get(AuthService).createToken({ _id: new Types.ObjectId(), memberType: MemberType.PATIENT });
		const result = await create(input, patientToken);
		expect(result.body.errors[0].code).toBe('FORBIDDEN');
		expect(service.createService).not.toHaveBeenCalled();
	});
});
