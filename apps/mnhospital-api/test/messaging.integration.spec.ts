import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import { TestAuthModule as AuthModule } from './test-auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { ConversationType, MemberType } from '../src/components/member/enums/member.enum';
import { MessagingResolver } from '../src/components/messaging/messaging.resolver';
import { MessagingService } from '../src/components/messaging/messaging.service';

describe('Messaging GraphQL access', () => {
	let app: INestApplication;
	let auth: AuthService;
	const patientId = new Types.ObjectId();
	const doctorId = new Types.ObjectId();
	const conversationId = new Types.ObjectId();
	const service = {
		startDirectConversation: jest.fn(),
        getUnreadCount: jest.fn(),
		getMyConversations: jest.fn(),
		getMyConversation: jest.fn(),
		getMyMessages: jest.fn(),
		sendDirectMessage: jest.fn(),
		markMyMessagesRead: jest.fn(),
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'messaging-integration-test-secret';
		const module = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					context: ({ req, res }) => ({ req, res }),
					autoSchemaFile: true,
				}),
			],
			providers: [MessagingResolver, RolesGuard, { provide: MessagingService, useValue: service }],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe());
		await app.init();
		auth = app.get(AuthService);
	});

	afterAll(async () => app.close());
	beforeEach(() => jest.clearAllMocks());

	const tokenFor = (id: Types.ObjectId, memberType: MemberType) => auth.createToken({ _id: id, memberType });

    it('returns unread counts only for the verified role/profile and rejects anonymous requests', async () => {
        service.getUnreadCount.mockResolvedValue(3);
        const query = '{getMyUnreadMessageCount}';
        const guest = await request(app.getHttpServer()).post('/graphql').set('Apollo-Require-Preflight','true').send({query});
        expect(guest.body.errors).toBeDefined();
        expect(service.getUnreadCount).not.toHaveBeenCalled();
        const result = await request(app.getHttpServer()).post('/graphql').set('Apollo-Require-Preflight','true')
            .set('Authorization', `Bearer ${await tokenFor(doctorId, MemberType.DOCTOR)}`).send({query});
        expect(result.body.errors).toBeUndefined();
        expect(result.body.data.getMyUnreadMessageCount).toBe(3);
        const actor = service.getUnreadCount.mock.calls[0][0];
        expect(String(actor._id)).toBe(String(doctorId)); expect(actor.memberType).toBe(MemberType.DOCTOR);
    });

	it('starts a direct conversation using the authenticated role and ID', async () => {
		service.startDirectConversation.mockResolvedValue({
			_id: conversationId,
			conversationType: ConversationType.DIRECT,
			participants: [
				{ participantId: patientId, participantType: MemberType.PATIENT },
				{ participantId: doctorId, participantType: MemberType.DOCTOR },
			],
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(patientId, MemberType.PATIENT)}`)
			.send({
				query:
					'mutation($input: StartDirectConversationInput!) { startDirectConversation(input: $input) { _id participants { participantId participantType } } }',
				variables: { input: { targetType: MemberType.DOCTOR, targetId: doctorId.toString() } },
			});
		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.startDirectConversation.participants).toHaveLength(2);
		expect(service.startDirectConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				_id: expect.objectContaining({ toString: expect.any(Function) }),
				memberType: MemberType.PATIENT,
			}),
			expect.objectContaining({ targetType: MemberType.DOCTOR, targetId: doctorId.toString() }),
		);
	});

	it('rejects guests and malformed conversation IDs before reading messages', async () => {
		const guest = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.send({ query: 'query { getMyConversations(input: {}) { total } }' });
		expect(guest.body.errors).toBeDefined();

		const malformed = await request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Authorization', `Bearer ${await tokenFor(doctorId, MemberType.DOCTOR)}`)
			.send({ query: 'query { getMyMessages(conversationId: "bad", input: {}) { total } }' });
		expect(malformed.body.errors?.[0].message).toContain('Invalid conversation ID');
		expect(service.getMyMessages).not.toHaveBeenCalled();
	});
});
