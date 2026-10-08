import { Types } from 'mongoose';
import { PatientService } from './patient.service';
import { MemberStatus } from '../member/enums/member.enum';

describe('Minimal patient profile for booking', () => {
	const memberId = new Types.ObjectId(), profileId = new Types.ObjectId();
	it('creates an account-owned minimal profile without inventing medical facts', async () => {
		const upsert = jest.fn((..._args: any[]) => ({ exec: async () => ({ _id: profileId, memberStatus: MemberStatus.ACTIVE }) }));
		const service = new PatientService({ findOne: () => ({ exec: async () => null }), findOneAndUpdate: upsert } as never,
			{ findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => ({ memberFullName: 'Test Patient' }) }) }) }) } as never);
		expect(await service.resolveProfileId(memberId)).toEqual(profileId);
		const insert = upsert.mock.calls[0][1].$setOnInsert;
		expect(insert.memberId).toEqual(memberId);
		for (const field of ['patientBloodType', 'patientGender', 'patientBirthDate', 'patientIdNumber', 'patientPassword']) expect(insert).not.toHaveProperty(field);
	});
	it('does not recreate an archived or blocked medical profile', async () => {
		const upsert = jest.fn();
		const service = new PatientService({ findOne: () => ({ exec: async () => ({ _id: profileId, memberStatus: MemberStatus.BLOCK }) }), findOneAndUpdate: upsert } as never);
		await expect(service.resolveProfileId(memberId)).rejects.toThrow('unavailable');
		expect(upsert).not.toHaveBeenCalled();
	});
});
