import { Schema } from 'mongoose';
import { MemberType } from '../../member/enums/member.enum';
import { PreferenceLanguage, PreferenceTheme } from '../enums/preference.enum';

const UserPreferenceSchema = new Schema(
	{
		ownerId: { type: Schema.Types.ObjectId, required: true },
		ownerType: { type: String, enum: MemberType, required: true },
		theme: { type: String, enum: PreferenceTheme, default: PreferenceTheme.LIGHT },
		language: { type: String, enum: PreferenceLanguage, default: PreferenceLanguage.EN },
	},
	{ timestamps: true, collection: 'userPreferences' },
);

UserPreferenceSchema.index({ ownerId: 1, ownerType: 1 }, { unique: true });

export default UserPreferenceSchema;
