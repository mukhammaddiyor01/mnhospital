import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AuthModule } from '../src/components/auth/auth.module';
import { AuthService } from '../src/components/auth/auth.service';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { MemberType } from '../src/components/member/enums/member.enum';
import { PreferenceLanguage, PreferenceTheme } from '../src/components/preference/enums/preference.enum';
import { PreferenceResolver } from '../src/components/preference/preference.resolver';
import { PreferenceService } from '../src/components/preference/preference.service';

describe('Preference GraphQL access', () => {
	let app: INestApplication;
	let auth: AuthService;
	const patientId = new Types.ObjectId();
	const service = { getMyPreferences: jest.fn(), updateMyPreferences: jest.fn() };

	beforeAll(async () => {
		process.env.SECRET_TOKEN = 'preference-integration-test-secret';
		const module = await Test.createTestingModule({
			imports: [AuthModule, GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true })],
			providers: [PreferenceResolver, RolesGuard, { provide: PreferenceService, useValue: service }],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe());
		await app.init();
		auth = app.get(AuthService);
	});

	afterAll(async () => app.close());
	beforeEach(() => jest.clearAllMocks());

	it('reads and updates preferences using only the authenticated profile identity', async () => {
		const token = await auth.createToken({ _id: patientId, memberType: MemberType.PATIENT });
		service.getMyPreferences.mockResolvedValue({ theme: PreferenceTheme.LIGHT, language: PreferenceLanguage.EN });
		service.updateMyPreferences.mockResolvedValue({ theme: PreferenceTheme.DARK, language: PreferenceLanguage.EN });
		const read = await request(app.getHttpServer()).post('/graphql').set('Authorization', `Bearer ${token}`)
			.send({ query: 'query { getMyPreferences { theme language } }' });
		expect(read.body.errors).toBeUndefined();
		expect(read.body.data.getMyPreferences).toEqual({ theme: 'LIGHT', language: 'EN' });
		const update = await request(app.getHttpServer()).post('/graphql').set('Authorization', `Bearer ${token}`)
			.send({
				query: 'mutation($input: UpdateMyPreferencesInput!) { updateMyPreferences(input: $input) { theme language } }',
				variables: { input: { theme: 'DARK' } },
			});
		expect(update.body.errors).toBeUndefined();
		expect(service.updateMyPreferences).toHaveBeenCalledWith(
			expect.objectContaining({ _id: expect.objectContaining({ toString: expect.any(Function) }), memberType: MemberType.PATIENT }),
			expect.objectContaining({ theme: PreferenceTheme.DARK }),
		);
	});

	it('rejects guests and invalid language before reaching the service', async () => {
		const guest = await request(app.getHttpServer()).post('/graphql').send({ query: 'query { getMyPreferences { theme } }' });
		expect(guest.body.errors).toBeDefined();
		const token = await auth.createToken({ _id: patientId, memberType: MemberType.PATIENT });
		const invalid = await request(app.getHttpServer()).post('/graphql').set('Authorization', `Bearer ${token}`)
			.send({
				query: 'mutation($input: UpdateMyPreferencesInput!) { updateMyPreferences(input: $input) { language } }',
				variables: { input: { language: 'UNKNOWN' } },
			});
		expect(invalid.body.errors).toBeDefined();
		expect(service.updateMyPreferences).not.toHaveBeenCalled();
	});
});
