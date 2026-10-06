import { Field, ObjectType } from '@nestjs/graphql';
import { PreferenceLanguage, PreferenceTheme } from '../enums/preference.enum';

@ObjectType()
export class UserPreference {
	@Field(() => PreferenceTheme)
	theme: PreferenceTheme;

	@Field(() => PreferenceLanguage)
	language: PreferenceLanguage;
}
