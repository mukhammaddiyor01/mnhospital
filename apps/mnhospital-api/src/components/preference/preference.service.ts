import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { UpdateMyPreferencesInput } from './dto/preference.input';
import { UserPreference } from './dto/preference';
import { PreferenceLanguage, PreferenceTheme } from './enums/preference.enum';

export interface PreferenceActor {
	_id: Types.ObjectId;
	memberType: MemberType;
}

@Injectable()
export class PreferenceService {
	constructor(
		@InjectModel('UserPreference') private readonly preferenceModel: Model<any>,
		@InjectModel('Member') private readonly memberModel: Model<any>,
		@InjectModel('Doctor') private readonly doctorModel: Model<any>,
		@InjectModel('Receptionist') private readonly receptionistModel: Model<any>,
		@InjectModel('Admin') private readonly adminModel: Model<any>,
	) {}

	public async getMyPreferences(actor: PreferenceActor): Promise<UserPreference> {
		await this.requireActiveProfile(actor);
		const preference = await this.preferenceModel.findOne({ ownerId: actor._id, ownerType: actor.memberType }).exec();
		return preference
			? { theme: preference.theme, language: preference.language }
			: { theme: PreferenceTheme.LIGHT, language: PreferenceLanguage.EN };
	}

	public async updateMyPreferences(actor: PreferenceActor, input: UpdateMyPreferencesInput): Promise<UserPreference> {
		await this.requireActiveProfile(actor);
		const changes: Partial<UserPreference> = {};
		if (input.theme != null) changes.theme = input.theme;
		if (input.language != null) changes.language = input.language;
		if (Object.keys(changes).length === 0) throw new BadRequestException('Set at least one preference');

		const owner = { ownerId: actor._id, ownerType: actor.memberType };
		const update = { $set: changes };
		let preference: UserPreference;
		try {
			preference = await this.preferenceModel.findOneAndUpdate(owner, update, {
				upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
			}).exec();
		} catch (error) {
			if ((error as { code?: number }).code !== 11000) throw error;
			preference = await this.preferenceModel.findOneAndUpdate(owner, update, { new: true, runValidators: true }).exec();
		}
		return { theme: preference.theme, language: preference.language };
	}

	private async requireActiveProfile(actor: PreferenceActor): Promise<void> {
		const active = { _id: actor._id, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } };
		let profile: unknown;
		switch (actor.memberType) {
			case MemberType.PATIENT:
				profile = await this.memberModel.exists({ ...active, memberType: MemberType.PATIENT });
				break;
			case MemberType.DOCTOR:
				profile = await this.doctorModel.exists(active);
				break;
			case MemberType.RECEPTIONIST:
				profile = await this.receptionistModel.exists(active);
				break;
			case MemberType.ADMIN:
				profile = await this.adminModel.exists({ _id: actor._id });
				break;
			default:
				throw new NotFoundException('Active preference profile not found');
		}
		if (!profile) throw new NotFoundException('Active preference profile not found');
	}
}
