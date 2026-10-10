import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { DoctorService } from './doctor.service';
import { DoctorProfileUpdateInput } from './dto/doctor-profile.input';
import { MemberStatus, MemberType } from '../member/enums/member.enum';

describe('Doctor own profile', () => {
	const doctorId = new Types.ObjectId();
	const scope = {
		_id: doctorId,
		memberType: MemberType.DOCTOR,
		memberStatus: MemberStatus.ACTIVE,
		deletedAt: { $exists: false },
	};
	let model: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };
	let auth: { createToken: jest.Mock };
	let service: DoctorService;

	beforeEach(() => {
		model = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
		auth = { createToken: jest.fn().mockResolvedValue('updated-session') };
		service = new DoctorService(model as any, null, null, null, null, null, auth as any, null, null, null);
	});

	it('loads only the authenticated active doctor', async () => {
		model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: doctorId }) });
		await service.getMyProfile(doctorId);
		expect(model.findOne).toHaveBeenCalledWith(scope);
	});

	it('updates contact fields without changing role, status or operational fields', async () => {
		model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: doctorId }) });
		const result = await service.updateMyProfile(doctorId, {
			docFullName: 'Updated Doctor',
			memberStatus: 'BLOCK',
			docRoom: '999',
		} as any);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			scope,
			{ $set: { docFullName: 'Updated Doctor' } },
			{ new: true, runValidators: true },
		);
		expect(result.accessToken).toBeUndefined();
		expect(auth.createToken).not.toHaveBeenCalled();
	});

	it('unsets a cleared optional email to preserve the sparse unique index', async () => {
		model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: doctorId }) });
		await service.updateMyProfile(doctorId, { docMail: '' });
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			scope,
			{ $set: {}, $unset: { docMail: 1 } },
			{ new: true, runValidators: true },
		);
	});

	it('does not return a refreshed session for a missing or inactive profile', async () => {
		model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
		await expect(service.updateMyProfile(doctorId, { docPhone: '+821012345678' })).rejects.toThrow(
			'Doctor profile update failed',
		);
		expect(auth.createToken).not.toHaveBeenCalled();
	});

	it('reports duplicate contact details as a request error', async () => {
		model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockRejectedValue({ code: 11000 }) });
		await expect(service.updateMyProfile(doctorId, { docMail: 'used@example.com' })).rejects.toMatchObject({
			status: 400,
		});
	});

	it('validates null and invalid contact values while allowing partial updates', async () => {
		for (const input of [{ docPhone: null }, { docPhone: '123' }, { docMail: 'invalid' }, { docFullName: '' }]) {
			expect((await validate(plainToInstance(DoctorProfileUpdateInput, input))).length).toBeGreaterThan(0);
		}
		expect(await validate(plainToInstance(DoctorProfileUpdateInput, { docMail: '' }))).toHaveLength(0);
		const input = plainToInstance(DoctorProfileUpdateInput, { docMail: ' Doctor@Example.com ', docAddress: ' Seoul ' });
		expect(await validate(input)).toHaveLength(0);
		expect(input).toMatchObject({ docMail: 'doctor@example.com', docAddress: 'Seoul' });
	});
});
