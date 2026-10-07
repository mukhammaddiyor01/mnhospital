import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { TestAuthModule as AuthModule } from './test-auth.module';
import { WithoutGuard } from '../src/components/auth/guards/without.guard';
import { ServiceResolver } from '../src/components/service/service.resolver';
import { ServiceService } from '../src/components/service/service.service';

const currentServiceId = new ObjectId();
const recommendedServiceId = new ObjectId();
const departmentId = new ObjectId();

describe('Recommended services GraphQL integration', () => {
	let app: INestApplication;
	const serviceService = {
		getRecommendedServices: jest.fn(),
	};

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					context: ({ req, res }) => ({ req, res }),
					autoSchemaFile: true,
				}),
			],
			providers: [ServiceResolver, WithoutGuard, { provide: ServiceService, useValue: serviceService }],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns recommended services with GraphQL variables without authentication', async () => {
		serviceService.getRecommendedServices.mockResolvedValue({
			list: [
				{
					_id: recommendedServiceId,
					departmentId,
					serviceType: 'CONSULTATION',
					serviceName: 'Recommended Consultation',
					serviceStatus: 'ACTIVE',
					serviceRoomName: 'CLINIC',
					serviceRoom: 'ROOM101',
					serviceTitle: 'Recommended service',
					servicePrice: 100,
					serviceViews: 10,
					serviceLikes: 5,
					serviceComments: 1,
					serviceRank: 3,
					serviceImages: [],
					serviceDesc: 'Recommended service',
					serviceDuration: '30',
					memberId: new ObjectId(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
			metaCounter: [{ total: 1 }],
		});

		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.send({
				query: `query GetRecommendedServices($serviceId: String!, $limit: Int) {
					getRecommendedServices(serviceId: $serviceId, limit: $limit) {
						list { _id serviceName departmentId serviceType servicePrice }
					}
				}`,
				variables: { serviceId: currentServiceId.toString(), limit: 4 },
			});

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.getRecommendedServices.list[0].serviceName).toBe('Recommended Consultation');
		expect(serviceService.getRecommendedServices).toHaveBeenCalledWith(
			expect.objectContaining({ toString: expect.any(Function) }),
			4,
		);
	});
});
