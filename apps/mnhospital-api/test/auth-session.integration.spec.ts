import { INestApplication, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Context, GraphQLModule, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { createAuthFixture } from './auth-fixture';
import { AuthService } from '../src/components/auth/auth.service';
import { AuthResolver } from '../src/components/auth/auth.resolver';
import { AuthSession } from '../src/components/auth/dto/auth-session';
import { SessionAccessInterceptor, SessionLoginInterceptor } from '../src/components/auth/session.interceptor';
import { RolesGuard } from '../src/components/auth/guards/roles.guard';
import { Roles } from '../src/components/auth/decorators/roles.decorator';
import { AuthMember } from '../src/components/auth/decorators/authMember.decorator';
import { MemberType } from '../src/components/member/enums/member.enum';
import { REFRESH_COOKIE } from '../src/components/auth/session-cookie';

let fixture = createAuthFixture();
@Resolver()
class SessionFixtureResolver {
	@Mutation(() => AuthSession)
	@UseInterceptors(SessionLoginInterceptor)
	async fixtureLogin(@Args('role', { type: () => MemberType }) role: MemberType) {
		return fixture.profile(role);
	}
	@Query(() => String)
	@Roles(...Object.values(MemberType))
	@UseGuards(RolesGuard)
	async fixturePrivate(@AuthMember() actor: any) {
		return actor.memberType;
	}
	@Mutation(() => AuthSession)
	@Roles(...Object.values(MemberType))
	@UseGuards(RolesGuard)
	@UseInterceptors(SessionAccessInterceptor)
	async fixtureProfileUpdate(@AuthMember() actor: any) {
		const profile = fixture.profiles[actor.memberType].get(String(actor._id));
		profile.memberNick = 'updated-name';
		return profile;
	}
}

describe('Session GraphQL/cookie integration with production auth service', () => {
	let app: INestApplication;
	beforeEach(() => {
		fixture = createAuthFixture();
	});
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [
				GraphQLModule.forRoot({
					driver: ApolloDriver,
					autoSchemaFile: true,
					context: ({ req, res }) => ({ req, res }),
				}),
			],
			providers: [
				AuthResolver,
				SessionFixtureResolver,
				RolesGuard,
				SessionLoginInterceptor,
				SessionAccessInterceptor,
				{
					provide: AuthService,
					useFactory: () =>
						new Proxy(
							{},
							{
								get: (_, name) =>
									typeof fixture.auth[name] === 'function' ? fixture.auth[name].bind(fixture.auth) : fixture.auth[name],
							},
						),
				},
			],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	});
	afterAll(async () => app.close());
	const post = (query: string, token?: string, cookie?: string, origin = 'http://localhost:2002') => {
		const req = request(app.getHttpServer())
			.post('/graphql')
			.set('Apollo-Require-Preflight', 'true')
			.set('Origin', origin);
		if (token) req.set('Authorization', 'Bearer ' + token);
		if (cookie) req.set('Cookie', cookie);
		return req.send({ query });
	};
	async function login(role: MemberType) {
		const response = await post(`mutation { fixtureLogin(role:${role}) { accessToken } }`);
		expect(response.body.errors).toBeUndefined();
		const cookie = response.headers['set-cookie'][0];
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).toContain('Path=/graphql');
		return { token: response.body.data.fixtureLogin.accessToken as string, cookie: cookie.split(';')[0] as string };
	}
	it.each(Object.values(MemberType))(
		'logs in, refreshes and logs out %s without exposing a refresh token field',
		async (role) => {
			const first = await login(role);
			expect((await post('{ fixturePrivate }', first.token)).body.data.fixturePrivate).toBe(role);
			const refreshed = await post('mutation { refreshSession { accessToken } }', undefined, first.cookie);
			expect(refreshed.body.errors).toBeUndefined();
			const cookie = refreshed.headers['set-cookie'][0].split(';')[0];
			expect(cookie).not.toBe(first.cookie);
			const token = refreshed.body.data.refreshSession.accessToken;
			expect((await post('mutation { logoutSession }', token, cookie)).body.data.logoutSession).toBe(true);
			expect((await post('{ fixturePrivate }', token)).body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
			expect(
				(await post('mutation { refreshSession { accessToken } }', undefined, cookie)).body.errors[0].extensions.code,
			).toBe('UNAUTHENTICATED');
		},
	);
	it('renews profile display claims in the same session without replacing the cookie', async () => {
		const first = await login(MemberType.DOCTOR);
		const before = await fixture.jwt.verifyAsync(first.token);
		const response = await post('mutation { fixtureProfileUpdate { accessToken } }', first.token, first.cookie);
		expect(response.body.errors).toBeUndefined();
		expect(response.headers['set-cookie']).toBeUndefined();
		const after = await fixture.jwt.verifyAsync(response.body.data.fixtureProfileUpdate.accessToken);
		expect(after.sid).toBe(before.sid);
		expect(after.memberNick).toBe('updated-name');
		expect(fixture.records.size).toBe(1);
	});
	it('rejects cookie mutations from untrusted origins or without the preflight header', async () => {
		const first = await login(MemberType.PATIENT);
		const hostile = await post(
			'mutation { refreshSession { accessToken } }',
			undefined,
			first.cookie,
			'https://untrusted.example',
		);
		expect(hostile.body.errors[0].extensions.code).toBe('FORBIDDEN');
		expect(hostile.headers['set-cookie']).toBeUndefined();
		const missing = await request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', first.cookie)
			.send({ query: 'mutation { logoutSession }' });
		expect(missing.body.errors[0].extensions.code).toBe('FORBIDDEN');
		await expect(fixture.auth.verifyToken(first.token)).resolves.toBeDefined();
	});
	it('revokes a bearer session when the cookie is absent and tolerates repeated logout', async () => {
		const first = await login(MemberType.ADMIN);
		expect((await post('mutation { logoutSession }', first.token)).body.data.logoutSession).toBe(true);
		await expect(fixture.auth.verifyToken(first.token)).rejects.toMatchObject({ status: 401 });
		expect((await post('mutation { logoutSession }', first.token)).body.data.logoutSession).toBe(true);
	});
	it('rejects cookie replay and clears the cookie instead of returning access', async () => {
		const first = await login(MemberType.RECEPTIONIST);
		const fresh = await post('mutation { refreshSession { accessToken } }', undefined, first.cookie);
		const replay = await post('mutation { refreshSession { accessToken } }', undefined, first.cookie);
		expect(replay.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
		expect(replay.headers['set-cookie'][0]).toContain(`${REFRESH_COOKIE}=;`);
		await expect(fixture.auth.verifyToken(fresh.body.data.refreshSession.accessToken)).rejects.toMatchObject({
			status: 401,
		});
	});
	it('publishes accessToken only in the session GraphQL result', async () => {
		const result = await post('{ __type(name:"AuthSession") { fields { name } } }');
		expect(result.body.data.__type.fields.map((field) => field.name)).toEqual(['accessToken']);
	});
});
