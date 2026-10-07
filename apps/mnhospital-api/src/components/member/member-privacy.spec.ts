import { Types } from 'mongoose';
import { MemberResolver } from './member.resolver';
import { MemberType } from './enums/member.enum';

describe('Account contact field ownership', () => {
	const id = new Types.ObjectId();
	const profile: any = {
		_id: id,
		memberPhone: '+82100000011',
		memberMail: 'fixture@example.test',
		memberIdNumber: 'private-identifier',
		memberAddress: 123,
	};
	const resolver = new MemberResolver(null);
	it.each([MemberType.DOCTOR, MemberType.RECEPTIONIST])(
		'does not confuse %s profiles with a patient account sharing the same ID',
		(role) => {
			const context = { req: { body: { authMember: { _id: id, memberType: role } } } };
			expect(resolver.memberPhone(profile, context)).toBeNull();
			expect(resolver.memberMail(profile, context)).toBeNull();
			expect(resolver.memberIdNumber(profile, context)).toBeNull();
			expect(resolver.memberAddress(profile, context)).toBeNull();
		},
	);
	it('keeps guest and other-patient contact fields private', () => {
		for (const actor of [null, { _id: new Types.ObjectId(), memberType: MemberType.PATIENT }])
			expect(resolver.memberPhone(profile, { req: { body: { authMember: actor } } })).toBeNull();
	});
	it('allows the patient owner and administrative account management to read contact fields', () => {
		for (const actor of [
			{ _id: id, memberType: MemberType.PATIENT },
			{ _id: new Types.ObjectId(), memberType: MemberType.ADMIN },
		])
			expect(resolver.memberPhone(profile, { req: { body: { authMember: actor } } })).toBe(profile.memberPhone);
	});
});
