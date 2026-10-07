import { checkSessionRequest, cookieOptions, readRefreshCookie } from './session-cookie';
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
});
