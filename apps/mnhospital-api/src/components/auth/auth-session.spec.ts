import { Types, model } from 'mongoose';
import { createAuthFixture } from '../../../test/auth-fixture';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import RefreshTokenSchema from '../member/schema/RefreshToken.model';
import { SESSION_IDLE_MS } from './auth.service';

const Refresh = model('RefreshSessionValidationTest', RefreshTokenSchema);
describe('Owned refresh sessions and access tokens', () => {
	let fixture: ReturnType<typeof createAuthFixture>;
	beforeEach(() => {
		fixture = createAuthFixture();
	});

	it.each(Object.values(MemberType))(
		'issues, rotates and verifies a %s session using its own profile collection',
		async (role) => {
			const owner = fixture.profile(role);
			const first = await fixture.auth.startSession(owner);
			const claims = await fixture.jwt.verifyAsync(first.accessToken);
			expect(claims.exp - claims.iat).toBe(900);
			expect(claims).toMatchObject({ _id: String(owner._id), memberType: role, tokenType: 'access' });
			expect(claims).not.toHaveProperty('memberPassword');
			expect(claims).not.toHaveProperty('docPhone');
			expect(claims).not.toHaveProperty('docDesc');
			const row = [...fixture.records.values()][0];
			expect(row).toMatchObject({ ownerId: owner._id, ownerType: role, profileVersion: 0 });
			expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
			expect(JSON.stringify(row)).not.toContain(first.refreshToken);
			await expect(fixture.auth.verifyToken(first.accessToken)).resolves.toMatchObject({
				_id: owner._id,
				memberType: role,
			});
			const rotated = await fixture.auth.refreshSession(first.refreshToken);
			expect(rotated.refreshToken).not.toBe(first.refreshToken);
			expect(rotated.expiresAt).toEqual(first.expiresAt);
			expect(row.usedTokenHashes).toHaveLength(1);
			await expect(fixture.auth.verifyToken(rotated.accessToken)).resolves.toMatchObject({ memberType: role });
		},
	);

	it('rejects replay of any earlier credential and revokes the current access and refresh credentials', async () => {
		const initial = await fixture.auth.startSession(fixture.profile(MemberType.DOCTOR));
		const second = await fixture.auth.refreshSession(initial.refreshToken);
		const third = await fixture.auth.refreshSession(second.refreshToken);
		await expect(fixture.auth.refreshSession(initial.refreshToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.verifyToken(third.accessToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.refreshSession(third.refreshToken)).rejects.toMatchObject({ status: 401 });
	});

	it('atomically consumes credentials even when two refresh requests race', async () => {
		const first = await fixture.auth.startSession(fixture.profile(MemberType.PATIENT));
		const results = await Promise.allSettled([
			fixture.auth.refreshSession(first.refreshToken),
			fixture.auth.refreshSession(first.refreshToken),
		]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect([...fixture.records.values()][0].revokedAt).toBeInstanceOf(Date);
	});

	it('does not let guessing a session ID revoke another user', async () => {
		const first = await fixture.auth.startSession(fixture.profile(MemberType.ADMIN));
		const guessed = first.refreshToken.slice(0, 25) + 'x'.repeat(43);
		await expect(fixture.auth.refreshSession(guessed)).rejects.toMatchObject({ status: 401 });
		await fixture.auth.logoutCredential(guessed);
		expect([...fixture.records.values()][0].revokedAt).toBeUndefined();
	});

	it.each(Object.values(MemberType))(
		'rejects blocked/deleted %s accounts at access and refresh boundaries',
		async (role) => {
			for (const status of [MemberStatus.BLOCK, MemberStatus.DELETE]) {
				const owner = fixture.profile(role);
				const first = await fixture.auth.startSession(owner);
				owner.memberStatus = status;
				await expect(fixture.auth.verifyToken(first.accessToken)).rejects.toMatchObject({ status: 401 });
				await expect(fixture.auth.refreshSession(first.refreshToken)).rejects.toMatchObject({ status: 401 });
			}
		},
	);

	it('keeps a pre-block session invalid after reactivation through the profile version', async () => {
		const owner = fixture.profile(MemberType.RECEPTIONIST);
		const first = await fixture.auth.startSession(owner);
		owner.sessionVersion++;
		await expect(fixture.auth.verifyToken(first.accessToken)).rejects.toMatchObject({ status: 401 });
	});

	it('revokes only the requested role and profile even when role collections share the same ID', async () => {
		const id = new Types.ObjectId();
		const doctor = await fixture.auth.startSession(fixture.profile(MemberType.DOCTOR, id));
		const patient = await fixture.auth.startSession(fixture.profile(MemberType.PATIENT, id));
		await fixture.auth.revokeOwnerSessions(id, MemberType.DOCTOR);
		await expect(fixture.auth.verifyToken(doctor.accessToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.verifyToken(patient.accessToken)).resolves.toMatchObject({
			memberType: MemberType.PATIENT,
		});
	});

	it('rejects cross-profile/cross-role session claims, legacy tokens, malformed IDs and expired JWTs', async () => {
		const owner = fixture.profile(MemberType.PATIENT);
		const first = await fixture.auth.startSession(owner);
		const valid = await fixture.jwt.verifyAsync(first.accessToken);
		for (const claims of [
			{ _id: String(owner._id), memberType: owner.memberType },
			{ ...valid, _id: String(new Types.ObjectId()) },
			{ ...valid, memberType: MemberType.DOCTOR },
			{ ...valid, _id: 'bad-id' },
			{ ...valid, tokenType: 'refresh' },
			{ ...valid, exp: 1 },
			Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'exp')),
		])
			await expect(fixture.auth.verifyToken(await fixture.jwt.signAsync(claims))).rejects.toMatchObject({
				status: 401,
			});
	});

	it('expires refresh sessions independently of the JWT lifetime', async () => {
		const first = await fixture.auth.startSession(fixture.profile(MemberType.ADMIN));
		[...fixture.records.values()][0].expiresAt = new Date(0);
		await expect(fixture.auth.refreshSession(first.refreshToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.verifyToken(first.accessToken)).rejects.toMatchObject({ status: 401 });
	});

	it('expires both access and refresh after 15 minutes without a refresh', async () => {
		const first = await fixture.auth.startSession(fixture.profile(MemberType.PATIENT));
		const row = [...fixture.records.values()][0];
		row.updatedAt = new Date(Date.now() - SESSION_IDLE_MS - 1000);
		await expect(fixture.auth.verifyToken(first.accessToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.refreshSession(first.refreshToken)).rejects.toMatchObject({ status: 401 });
	});

	it('refresh activity renews the idle window without extending the 30-day limit', async () => {
		const first = await fixture.auth.startSession(fixture.profile(MemberType.DOCTOR));
		const row = [...fixture.records.values()][0];
		row.updatedAt = new Date(Date.now() - SESSION_IDLE_MS + 60_000);
		const renewed = await fixture.auth.refreshSession(first.refreshToken);
		expect(row.updatedAt.getTime()).toBeGreaterThan(Date.now() - 5_000);
		expect(renewed.expiresAt).toEqual(first.expiresAt);
		expect(renewed.cookieExpiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_IDLE_MS - 5_000);
		await expect(fixture.auth.verifyToken(renewed.accessToken)).resolves.toMatchObject({ memberType: MemberType.DOCTOR });
	});

	it('logout revokes the session, including when a consumed cookie was sent, and leaves other sessions active', async () => {
		const owner = fixture.profile(MemberType.DOCTOR);
		const first = await fixture.auth.startSession(owner);
		const other = await fixture.auth.startSession(owner);
		const rotated = await fixture.auth.refreshSession(first.refreshToken);
		const revoked = jest.fn();
		fixture.auth.onRevoked(revoked);
		await fixture.auth.logoutCredential(first.refreshToken);
		await expect(fixture.auth.verifyToken(rotated.accessToken)).rejects.toMatchObject({ status: 401 });
		await expect(fixture.auth.verifyToken(other.accessToken)).resolves.toMatchObject({ memberType: MemberType.DOCTOR });
		expect(revoked).toHaveBeenCalledWith({ sessionId: first.refreshToken.slice(0, 24) });
		await expect(fixture.auth.logoutCredential('malformed')).resolves.toBeUndefined();
	});

	it('supports existing admin records without adding public signup or moving staff into Member', async () => {
		const owner = fixture.profile(MemberType.ADMIN);
		delete (owner as any).memberStatus;
		await expect(fixture.auth.startSession(owner)).resolves.toHaveProperty('accessToken');
		expect(fixture.models.PATIENT.findOne).not.toHaveBeenCalled();
	});

	it('sanitizes persistence failures without treating an outage as session revocation', async () => {
		fixture.sessions.findOne.mockReturnValue(queryFailure());
		await expect(
			fixture.auth.refreshSession(String(new Types.ObjectId()) + '.' + 'a'.repeat(43)),
		).rejects.toMatchObject({ status: 500, message: 'Session service is unavailable' });
	});

	it('validates role ownership and keeps token hashes excluded from default reads', async () => {
		const record = new Refresh({
			ownerId: new Types.ObjectId(),
			ownerType: 'DOCTOR',
			tokenHash: 'hash',
			expiresAt: new Date(),
		});
		await expect(record.validate()).resolves.toBeUndefined();
		expect(RefreshTokenSchema.path('tokenHash').options.select).toBe(false);
		expect(RefreshTokenSchema.path('usedTokenHashes').options.select).toBe(false);
		await expect(
			new Refresh({
				ownerId: new Types.ObjectId(),
				ownerType: 'OTHER',
				tokenHash: 'hash',
				expiresAt: new Date(),
			}).validate(),
		).rejects.toThrow();
	});
});
function queryFailure(): any {
	const q = {
		select: () => q,
		lean: () => q,
		exec: async () => {
			throw new Error('private database details');
		},
	};
	return q;
}
