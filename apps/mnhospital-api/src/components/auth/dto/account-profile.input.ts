import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

@InputType()
export class AccountProfileInput {
	@Transform(trim)
	@IsOptional()
	@IsString()
	@Length(3, 30)
	@Field(() => String, { nullable: true })
	nickname?: string;

	@Transform(trim)
	@IsOptional()
	@IsString()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	fullName?: string;

	@Transform(trim)
	@IsOptional()
	@IsString()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
	@Field(() => String, { nullable: true })
	phone?: string;

	@Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	@ValidateIf((_, value) => value !== undefined && value !== '')
	@IsEmail()
	@Field(() => String, { nullable: true })
	email?: string;

	@Transform(trim)
	@IsOptional()
	@IsString()
	@Length(0, 300)
	@Field(() => String, { nullable: true })
	address?: string;

	@Transform(trim)
	@IsOptional()
	@IsString()
	@Length(0, 2000)
	@Field(() => String, { nullable: true })
	description?: string;

	@Transform(trim)
	@IsOptional()
	@IsString()
	@Length(0, 500)
	@Field(() => String, { nullable: true })
	image?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Field(() => Int, { nullable: true })
	experience?: number;
}

@InputType()
export class AccountPasswordInput {
	@IsString()
	@Length(1, 128)
	@Field(() => String)
	currentPassword: string;

	@IsString()
	@Length(8, 32)
	@Field(() => String)
	newPassword: string;
}
