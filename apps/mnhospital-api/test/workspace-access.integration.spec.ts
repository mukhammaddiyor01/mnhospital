import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import * as request from 'supertest';
import { Types } from 'mongoose';
import { TestAuthModule as AuthModule } from './test-auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { MemberType } from '../src/components/member/enums/member.enum';
import { RoomResolver } from '../src/components/appointment/room.resolver';
import { RoomService } from '../src/components/appointment/room.service';
import { BookingResolver } from '../src/components/booking/booking.resolver';
import { BookingService } from '../src/components/booking/booking.service';
import { ArticleResolver } from '../src/components/article/article.resolver';
import { ArticleService } from '../src/components/article/article.service';
import { AdminResolver } from '../src/components/admin/admin.resolver';
import { AdminService } from '../src/components/admin/admin.service';

describe('Workspace GraphQL role and validation integration', () => {
	let app: INestApplication;
	const actorId = new Types.ObjectId();
	const room = { _id: new Types.ObjectId(), roomNumber: 'A-101', roomType: 'CONSULTATION', roomStatus: 'AVAILABLE' };
	const rooms = { getRooms: jest.fn().mockResolvedValue([room]), createRoom: jest.fn().mockResolvedValue(room) };
	const bookings = { getStaffPayments: jest.fn().mockResolvedValue({ list: [], metaCounter: [] }) };
	const articles = { createArticle: jest.fn() };
	const admins = { getCommentsByAdmin: jest.fn().mockResolvedValue({ list: [], metaCounter: [] }) };
	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'workspace-access-test-secret';
		const module = await Test.createTestingModule({
			imports: [
				AuthModule,
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					context: ({ req, res }) => ({ req, res }),
					autoSchemaFile: true,
				}),
			],
			providers: [
				RoomResolver,
				BookingResolver,
				ArticleResolver,
				AdminResolver,
				RolesGuard,
				{ provide: RoomService, useValue: rooms },
				{ provide: BookingService, useValue: bookings },
				{ provide: ArticleService, useValue: articles },
				{ provide: AdminService, useValue: admins },
			],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();
	});
	afterAll(async () => await app.close());
	beforeEach(() => jest.clearAllMocks());
	async function query(role: MemberType | null, query: string, variables?: unknown) {
		const req = request(app.getHttpServer()).post('/graphql').set('Apollo-Require-Preflight', 'true');
		if (role)
			req.set('Authorization', `Bearer ${await app.get(AuthService).createToken({ _id: actorId, memberType: role })}`);
		return req.send({ query, variables });
	}
	it('allows patient room selection but forbids guest reads and patient writes', async () => {
		expect((await query(MemberType.PATIENT, '{ getRooms { roomNumber } }')).body.data.getRooms[0].roomNumber).toBe(
			'A-101',
		);
		expect((await query(null, '{ getRooms { roomNumber } }')).body.errors).toBeDefined();
		expect(
			(
				await query(MemberType.PATIENT, 'mutation($input:HospitalRoomInput!){createRoom(input:$input){_id}}', {
					input: { roomNumber: 'B-1', roomType: 'CONSULTATION' },
				})
			).body.errors,
		).toBeDefined();
		expect(rooms.createRoom).not.toHaveBeenCalled();
	});
	it('validates admin room input before calling persistence', async () => {
		const response = await query(
			MemberType.ADMIN,
			'mutation($input:HospitalRoomInput!){createRoom(input:$input){_id}}',
			{ input: { roomNumber: 'B-1', roomType: 'CONSULTATION', floor: -1 } },
		);
		expect(response.body.errors).toBeDefined();
		expect(rooms.createRoom).not.toHaveBeenCalled();
	});
	it('allows reception payments and rejects doctor or patient clinic-wide access', async () => {
		const doc = 'query($input:PaymentInquiry!){getPayments(input:$input){list{_id}metaCounter{total}}}';
		expect((await query(MemberType.RECEPTIONIST, doc, { input: { page: 1, limit: 10 } })).body.errors).toBeUndefined();
		expect(bookings.getStaffPayments).toHaveBeenCalledWith(
			MemberType.RECEPTIONIST,
			expect.objectContaining({ page: 1, limit: 10 }),
		);
		bookings.getStaffPayments.mockClear();
		for (const role of [MemberType.DOCTOR, MemberType.PATIENT])
			expect((await query(role, doc, { input: { page: 1, limit: 10 } })).body.errors).toBeDefined();
		expect(bookings.getStaffPayments).not.toHaveBeenCalled();
	});
	it('requires doctor role for article creation', async () => {
		const response = await query(
			MemberType.PATIENT,
			'mutation($input:ArticleInput!){createArticle(input:$input){_id}}',
			{
				input: { articleTitle: 'Routine care', articleCategory: 'HEALTH', articleContent: 'Routine care information' },
			},
		);
		expect(response.body.errors).toBeDefined();
		expect(articles.createArticle).not.toHaveBeenCalled();
	});
	it('allows only admin to read global comments', async () => {
		const doc = 'query($input:OrdinaryInquiry!){getCommentsByAdmin(input:$input){list{_id}metaCounter{total}}}';
		expect((await query(MemberType.ADMIN, doc, { input: { page: 1, limit: 10 } })).body.errors).toBeUndefined();
		admins.getCommentsByAdmin.mockClear();
		expect((await query(MemberType.DOCTOR, doc, { input: { page: 1, limit: 10 } })).body.errors).toBeDefined();
		expect(admins.getCommentsByAdmin).not.toHaveBeenCalled();
	});
});
