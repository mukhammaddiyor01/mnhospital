import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';
import { PreferenceLanguage } from '../../preference/enums/preference.enum';

@InputType()
export class AskHospitalAssistantInput {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 1000)
	@Field(() => String)
	text: string;

	@IsEnum(PreferenceLanguage)
	@Field(() => PreferenceLanguage)
	language: PreferenceLanguage;
}
