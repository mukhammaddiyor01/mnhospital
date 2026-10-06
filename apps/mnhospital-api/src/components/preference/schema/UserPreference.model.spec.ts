import { model, Types } from 'mongoose';
import { MemberType } from '../../member/enums/member.enum';
import { PreferenceLanguage, PreferenceTheme } from '../enums/preference.enum';
import UserPreferenceSchema from './UserPreference.model';

const PreferenceModel = model('UserPreferenceSchemaTest', UserPreferenceSchema);

describe('User preference schema', () => {
	it('defaults theme and language for a profile', async () => {
		const preference = new PreferenceModel({ ownerId: new Types.ObjectId(), ownerType: MemberType.PATIENT });
		await preference.validate();
		expect(preference.theme).toBe(PreferenceTheme.LIGHT);
		expect(preference.language).toBe(PreferenceLanguage.EN);
	});

	it('rejects unknown preference values and uniquely indexes role plus profile ID', async () => {
		const preference = new PreferenceModel({ ownerId: new Types.ObjectId(), ownerType: MemberType.DOCTOR, theme: 'UNKNOWN' });
		await expect(preference.validate()).rejects.toMatchObject({ name: 'ValidationError' });
		expect(UserPreferenceSchema.indexes()).toContainEqual([{ ownerId: 1, ownerType: 1 }, expect.objectContaining({ unique: true })]);
	});
});
