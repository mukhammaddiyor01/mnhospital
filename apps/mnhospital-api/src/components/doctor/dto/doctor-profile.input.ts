import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

@InputType()
export class DoctorProfileUpdateInput {
	@Transform(trim)
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	docFullName?: string;

	@Transform(trim)
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
	@Field(() => String, { nullable: true })
	docPhone?: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
	@ValidateIf((_, value) => value !== undefined && value !== '')
	@IsEmail()
	@Field(() => String, { nullable: true })
	docMail?: string;

	@Transform(trim)
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Length(0, 300)
	@Field(() => String, { nullable: true })
	docAddress?: string;

	@Transform(trim)
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Length(0, 2000)
	@Field(() => String, { nullable: true })
	docDesc?: string;
}
