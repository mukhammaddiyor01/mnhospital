import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { PreferenceLanguage, PreferenceTheme } from '../enums/preference.enum';

@InputType()
export class UpdateMyPreferencesInput {
	@IsOptional()
	@IsEnum(PreferenceTheme)
	@Field(() => PreferenceTheme, { nullable: true })
	theme?: PreferenceTheme;

	@IsOptional()
	@IsEnum(PreferenceLanguage)
	@Field(() => PreferenceLanguage, { nullable: true })
	language?: PreferenceLanguage;
}
