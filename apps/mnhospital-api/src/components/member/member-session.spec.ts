import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { MemberService } from './member.service';
import { LoginInput } from './dto/member.input';
import { MemberType, MemberAuthType } from './enums/member.enum';

describe('Patient account session boundaries', () => {
	it('allows login for the nickname/password lengths supported by registration, including existing short passwords', async () => {
		for (const password of ['old12', 'FixturePass123', 'x'.repeat(32)])
			expect(
				await validate(plainToInstance(LoginInput, { memberNick: 'a'.repeat(30), memberPassword: password })),
			).toHaveLength(0);
		expect(
			(await validate(plainToInstance(LoginInput, { memberNick: 'a'.repeat(31), memberPassword: 'FixturePass123' })))
				.length,
		).toBeGreaterThan(0);
	});
	it('projects own profile fields, hashes changed passwords and revokes all old patient sessions', async () => {
		const id = new Types.ObjectId();
		const model = { findOneAndUpdate: jest.fn(() => ({ exec: async () => ({ _id: id }) })) };
		const auth = { hashPassword: jest.fn(async () => 'new-hash'), revokeOwnerSessions: jest.fn() };
		const service = new MemberService(model as any, null, auth as any, null, null, null);
		await service.updateMember(id, {
			_id: new Types.ObjectId(),
			memberType: MemberType.ADMIN,
			memberAuthType: MemberAuthType.GOOGLE,
			memberStatus: 'BLOCK',
			memberPassword: 'FixturePass123',
			memberFullName: 'Updated',
			sessionVersion: 999,
		} as any);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: id, memberType: MemberType.PATIENT, memberStatus: 'ACTIVE', deletedAt: { $exists: false } },
			{ $set: { memberFullName: 'Updated', memberPassword: 'new-hash' }, $inc: { sessionVersion: 1 } },
			{ new: true, runValidators: true },
		);
		expect(auth.revokeOwnerSessions).toHaveBeenCalledWith(id, MemberType.PATIENT);
	});
	it.each([MemberType.ADMIN, MemberType.DOCTOR, MemberType.RECEPTIONIST])(
		'never creates %s through public patient signup',
		async (role) => {
			const model = { create: jest.fn() };
			const auth = { hashPassword: jest.fn() };
			const service = new MemberService(model as any, null, auth as any, null, null, null);
			await expect(service.signup({ memberType: role } as any)).rejects.toMatchObject({ status: 400 });
			expect(model.create).not.toHaveBeenCalled();
		},
	);
});
