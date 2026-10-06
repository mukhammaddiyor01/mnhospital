import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { PreferenceLanguage, PreferenceTheme } from './enums/preference.enum';
import { PreferenceService } from './preference.service';

const query = (value: unknown) => ({ exec: async () => value });

describe('Preference ownership', () => {
	const patientId = new Types.ObjectId();
	const actor = { _id: patientId, memberType: MemberType.PATIENT };
	const setup = () => {
		const preferenceModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
		const memberModel = { exists: jest.fn().mockResolvedValue({ _id: patientId }) };
		const doctorModel = { exists: jest.fn() };
		const receptionistModel = { exists: jest.fn() };
		const adminModel = { exists: jest.fn() };
		const service = new PreferenceService(preferenceModel as any, memberModel as any, doctorModel as any, receptionistModel as any, adminModel as any);
		return { service, preferenceModel, memberModel, doctorModel, receptionistModel, adminModel };
	};

	it('returns defaults without creating a record and scopes the lookup to the token profile', async () => {
		const { service, preferenceModel, memberModel } = setup();
		preferenceModel.findOne.mockReturnValue(query(null));
		expect(await service.getMyPreferences(actor)).toEqual({ theme: PreferenceTheme.LIGHT, language: PreferenceLanguage.EN });
		expect(memberModel.exists).toHaveBeenCalledWith({
			_id: patientId, memberType: MemberType.PATIENT, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false },
		});
		expect(preferenceModel.findOne).toHaveBeenCalledWith({ ownerId: patientId, ownerType: MemberType.PATIENT });
		expect(preferenceModel.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('updates only supplied fields under the verified owner and retains the other default', async () => {
		const { service, preferenceModel } = setup();
		preferenceModel.findOneAndUpdate.mockReturnValue(query({ theme: PreferenceTheme.DARK, language: PreferenceLanguage.EN }));
		expect(await service.updateMyPreferences(actor, { theme: PreferenceTheme.DARK })).toEqual({
			theme: PreferenceTheme.DARK, language: PreferenceLanguage.EN,
		});
		expect(preferenceModel.findOneAndUpdate).toHaveBeenCalledWith(
			{ ownerId: patientId, ownerType: MemberType.PATIENT },
			{ $set: { theme: PreferenceTheme.DARK } },
			expect.objectContaining({ upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }),
		);
	});

	it('rejects empty updates and inactive profiles', async () => {
		const { service, preferenceModel, memberModel } = setup();
		await expect(service.updateMyPreferences(actor, {})).rejects.toBeInstanceOf(BadRequestException);
		memberModel.exists.mockResolvedValue(null);
		await expect(service.getMyPreferences(actor)).rejects.toBeInstanceOf(NotFoundException);
		expect(preferenceModel.findOne).not.toHaveBeenCalled();
	});

	it('retries without upsert when concurrent first updates hit the unique owner index', async () => {
		const { service, preferenceModel } = setup();
		preferenceModel.findOneAndUpdate
			.mockReturnValueOnce({ exec: async () => { throw { code: 11000 }; } })
			.mockReturnValueOnce(query({ theme: PreferenceTheme.DARK, language: PreferenceLanguage.EN }));
		await service.updateMyPreferences(actor, { theme: PreferenceTheme.DARK });
		expect(preferenceModel.findOneAndUpdate).toHaveBeenNthCalledWith(2,
			{ ownerId: patientId, ownerType: MemberType.PATIENT },
			{ $set: { theme: PreferenceTheme.DARK } },
			{ new: true, runValidators: true },
		);
	});

	it('checks staff in the matching profile collection', async () => {
		const { service, preferenceModel, doctorModel } = setup();
		const doctorId = new Types.ObjectId();
		doctorModel.exists.mockResolvedValue({ _id: doctorId });
		preferenceModel.findOne.mockReturnValue(query({ theme: PreferenceTheme.LIGHT, language: PreferenceLanguage.KR }));
		expect(await service.getMyPreferences({ _id: doctorId, memberType: MemberType.DOCTOR })).toEqual({
			theme: PreferenceTheme.LIGHT, language: PreferenceLanguage.KR,
		});
		expect(doctorModel.exists).toHaveBeenCalledWith(expect.objectContaining({ _id: doctorId }));
	});
});
