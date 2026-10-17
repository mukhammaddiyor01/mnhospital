import {
	checkSessionRequest,
	cookieOptions,
	readRefreshCookie,
	writeRefreshCookie,
	clearRefreshCookie,
} from './session-cookie';
import { AuthResolver } from './auth.resolver';
describe('Session cookie/origin configuration', () => {
	const original = {
		node: process.env.NODE_ENV,
		origins: process.env.AUTH_ALLOWED_ORIGINS,
		client: process.env.CLIENT_URL,
		sameSite: process.env.AUTH_COOKIE_SAMESITE,
	};
	afterEach(() => {
		for (const [name, value] of Object.entries({
			NODE_ENV: original.node,
			AUTH_ALLOWED_ORIGINS: original.origins,
			CLIENT_URL: original.client,
			AUTH_COOKIE_SAMESITE: original.sameSite,
		}))
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
	});
	it('uses the existing client URL as origin fallback and requires the preflight header', () => {
		delete process.env.AUTH_ALLOWED_ORIGINS;
		process.env.CLIENT_URL = 'https://hospital.example/';
		expect(() =>
			checkSessionRequest({
				req: { headers: { origin: 'https://hospital.example', 'apollo-require-preflight': 'true' } },
			} as any),
		).not.toThrow();
		expect(() =>
			checkSessionRequest({
				req: { headers: { origin: 'https://untrusted.example', 'apollo-require-preflight': 'true' } },
			} as any),
		).toThrow();
		expect(() => checkSessionRequest({ req: { headers: { origin: 'https://hospital.example' } } } as any)).toThrow();
	});
	it('keeps Secure/HttpOnly on production cookies including explicitly configured cross-site deployment', () => {
		process.env.NODE_ENV = 'production';
		process.env.AUTH_COOKIE_SAMESITE = 'none';
		expect(cookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none', path: '/graphql' });
		delete process.env.AUTH_COOKIE_SAMESITE;
		expect(cookieOptions().sameSite).toBe('lax');
	});
	it('rejects duplicate or malformed refresh cookies', () => {
		expect(readRefreshCookie({ headers: { cookie: 'mn-hospital-refresh=one; mn-hospital-refresh=two' } } as any)).toBe(
			'',
		);
		expect(readRefreshCookie({ headers: { cookie: 'mn-hospital-refresh=%ZZ' } } as any)).toBe('');
	});
	it('requires a tab access token for role-scoped refresh without clearing another tab cookie', async () => {
		process.env.AUTH_ALLOWED_ORIGINS = 'https://hospital.example';
		const cookieExpiresAt = new Date(Date.now() + 15 * 60_000);
		const refreshSession = jest.fn().mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: new Date(Date.now() + 30 * 86400_000), cookieExpiresAt });
		const resolver = new AuthResolver({ refreshSession } as any);
		const res = { cookie: jest.fn(), clearCookie: jest.fn() };
		const req: any = { headers: {
			origin: 'https://hospital.example',
			'apollo-require-preflight': 'true',
			'x-mn-session-role': 'PATIENT',
			cookie: 'mn-hospital-refresh-patient=stored-refresh',
		} };
		await expect(resolver.refreshSession({ req, res } as any)).rejects.toMatchObject({ status: 403 });
		expect(refreshSession).not.toHaveBeenCalled();
		expect(res.cookie).not.toHaveBeenCalled();
		expect(res.clearCookie).not.toHaveBeenCalled();
		req.headers['authorization'] = 'Bearer old-access';
		await expect(resolver.refreshSession({ req, res } as any)).resolves.toEqual({ accessToken: 'new-access' });
		expect(refreshSession).toHaveBeenLastCalledWith('stored-refresh', 'old-access');
		expect(res.cookie).toHaveBeenCalledWith('mn-hospital-refresh-patient', 'new-refresh', expect.any(Object));
		expect(res.cookie.mock.calls[0][2].expires).toEqual(cookieExpiresAt);
		req.headers['authorization'] = 'invalid';
		await expect(resolver.refreshSession({ req, res } as any)).rejects.toMatchObject({ status: 403 });
		delete req.headers['x-mn-session-role'];
		delete req.headers.authorization;
		req.headers.cookie = 'mn-hospital-refresh=legacy-refresh';
		await expect(resolver.refreshSession({ req, res } as any)).resolves.toEqual({ accessToken: 'new-access' });
		expect(refreshSession).toHaveBeenLastCalledWith('legacy-refresh', undefined);
	});
	it('selects only the requested role cookie from a shared browser cookie jar', () => {
		const cookie =
			'mn-hospital-refresh=legacy; ' +
			['patient', 'doctor', 'receptionist', 'admin']
				.map((role) => `mn-hospital-refresh-${role}=${role}-secret`)
				.join('; ');
		for (const role of ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN']) {
			const req = { headers: { cookie, 'x-mn-session-role': role } } as any;
			expect(readRefreshCookie(req)).toBe(`${role.toLowerCase()}-secret`);
			const res = { cookie: jest.fn(), clearCookie: jest.fn() } as any;
			writeRefreshCookie(res, 'rotated', new Date(), req);
			clearRefreshCookie(res, req);
			expect(res.cookie.mock.calls[0][0]).toBe(`mn-hospital-refresh-${role.toLowerCase()}`);
			expect(res.cookie.mock.calls[0][2].httpOnly).toBe(true);
			expect(res.clearCookie.mock.calls[0][0]).toBe(`mn-hospital-refresh-${role.toLowerCase()}`);
		}
		expect(readRefreshCookie({ headers: { cookie } } as any)).toBe('legacy');
		expect(
			readRefreshCookie({ headers: { cookie: 'mn-hospital-refresh=legacy', 'x-mn-session-role': 'PATIENT' } } as any),
		).toBe('');
	});
	it('rejects arbitrary cookie selectors and duplicate selected cookies', () => {
		for (const role of ['admin', 'OTHER', ['PATIENT'], '../admin', ''])
			expect(() => readRefreshCookie({ headers: { 'x-mn-session-role': role } } as any)).toThrow();
		expect(
			readRefreshCookie({
				headers: {
					'x-mn-session-role': 'PATIENT',
					cookie: 'mn-hospital-refresh-patient=a; mn-hospital-refresh-patient=b',
				},
			} as any),
		).toBe('');
	});
});
