import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { createAuthFixture, matches, query } from '../../../test/auth-fixture';
import { MemberType } from '../member/enums/member.enum';
import { AccountPasswordInput, AccountProfileInput } from './dto/account-profile.input';
import { AuthResolver } from './auth.resolver';

const prefixes = { PATIENT: 'member', DOCTOR: 'doc', RECEPTIONIST: 'receptionist', ADMIN: 'admin' };

describe('Owned account profiles and password changes', () => {
	let fixture: ReturnType<typeof createAuthFixture>;
	beforeEach(() => {
		fixture = createAuthFixture();
		for (const role of Object.values(MemberType)) {
			(fixture.models[role] as any).findOneAndUpdate = jest.fn((filter, update) =>
				query(() => {
					const row = [...fixture.profiles[role].values()].find((value) => matches(value, filter));
					if (!row) return null;
					Object.assign(row, update.$set);
					for (const key of Object.keys(update.$unset ?? {})) delete row[key];
					for (const [key, amount] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + Number(amount);
					return { ...row };
				}),
			);
		}
	});

	it.each(Object.values(MemberType))(
		'%s updates only its owned contact/image fields and preserves its session',
		async (role) => {
			const owner = fixture.profile(role);
			const other = fixture.profile(role);
			const otherNickname = other[prefixes[role] + 'Nick'];
			const session = await fixture.auth.startSession(owner);
			const token = await fixture.auth.updateAccountProfile(
				owner._id,
				role,
				{
					nickname: 'changed-owner',
					image: `uploads/${role.toLowerCase()}/fixture.png`,
					description: 'Changed profile',
				},
				session.refreshToken.slice(0, 24),
			);
			expect(owner[prefixes[role] + 'Nick']).toBe('changed-owner');
			expect(other[prefixes[role] + 'Nick']).toBe(otherNickname);
			expect(owner.sessionVersion).toBe(0);
			await expect(fixture.auth.verifyToken(session.accessToken)).resolves.toBeTruthy();
			expect((await fixture.auth.verifyToken(token)).sid).toBe(session.refreshToken.slice(0, 24));
		},
	);

	it.each(Object.values(MemberType))(
		'%s changes its password, revokes old sessions, and leaves another role with the same ID untouched',
		async (role) => {
			const owner = fixture.profile(role);
			const otherRole = Object.values(MemberType).find((value) => value !== role);
			const collision = fixture.profile(otherRole, owner._id);
			const hash = await fixture.auth.hashPassword('OldPassword123');
			owner[prefixes[role] + 'Password'] = hash;
			const first = await fixture.auth.startSession(owner);
			const second = await fixture.auth.startSession(owner);
			const otherSession = await fixture.auth.startSession(collision);
			const changed = await fixture.auth.changeAccountPassword(owner._id, role, {
				currentPassword: 'OldPassword123',
				newPassword: 'NewPassword123',
			});
			expect(owner[prefixes[role] + 'Password']).not.toBe('NewPassword123');
			expect(await fixture.auth.comparePassword('NewPassword123', owner[prefixes[role] + 'Password'])).toBe(true);
			expect(await fixture.auth.comparePassword('OldPassword123', owner[prefixes[role] + 'Password'])).toBe(false);
			await expect(fixture.auth.verifyToken(first.accessToken)).rejects.toThrow();
			await expect(fixture.auth.verifyToken(second.accessToken)).rejects.toThrow();
			await expect(fixture.auth.refreshSession(first.refreshToken)).rejects.toThrow();
			await expect(fixture.auth.verifyToken(changed.accessToken)).resolves.toBeTruthy();
			await expect(fixture.auth.verifyToken(otherSession.accessToken)).resolves.toBeTruthy();
		},
	);

	it('rejects the wrong current password without changing credentials or sessions', async () => {
		const owner = fixture.profile(MemberType.DOCTOR);
		(owner as any).docPassword = await fixture.auth.hashPassword('OldPassword123');
		const session = await fixture.auth.startSession(owner);
		await expect(
			fixture.auth.changeAccountPassword(owner._id, MemberType.DOCTOR, {
				currentPassword: 'WrongPassword123',
				newPassword: 'NewPassword123',
			}),
		).rejects.toThrow('incorrect');
		expect(owner.sessionVersion).toBe(0);
		await expect(fixture.auth.verifyToken(session.accessToken)).resolves.toBeTruthy();
	});

	it('rejects privilege fields and fields belonging to another role', async () => {
		const owner = fixture.profile(MemberType.PATIENT);
		const session = await fixture.auth.startSession(owner);
		for (const input of [
			{ memberStatus: 'BLOCK' },
			{ _id: new Types.ObjectId() },
			{ experience: 10 },
			{ docRoom: '999' },
		]) {
			await expect(
				fixture.auth.updateAccountProfile(
					owner._id,
					MemberType.PATIENT,
					input as any,
					session.refreshToken.slice(0, 24),
				),
			).rejects.toThrow('cannot be changed');
		}
		expect((fixture.models.PATIENT as any).findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('validates profile and password values without trimming passwords', async () => {
		expect(
			await validate(plainToInstance(AccountProfileInput, { phone: 'invalid', email: 'invalid', experience: -1 })),
		).toHaveLength(3);
		expect(
			await validate(plainToInstance(AccountPasswordInput, { currentPassword: '', newPassword: 'short' })),
		).toHaveLength(2);
		expect(
			plainToInstance(AccountPasswordInput, { currentPassword: ' old ', newPassword: ' newPassword ' }).newPassword,
		).toBe(' newPassword ');
	});

	it('rejects cross-origin password changes before changing credentials', async () => {
		const change = jest.spyOn(fixture.auth, 'changeAccountPassword');
		const resolver = new AuthResolver(fixture.auth);
		await expect(
			resolver.changeMyAccountPassword(
				{ currentPassword: 'old', newPassword: 'newPassword' },
				{} as any,
				{ req: { headers: { origin: 'https://untrusted.example' } }, res: {} } as any,
			),
		).rejects.toThrow();
		expect(change).not.toHaveBeenCalled();
	});
});
