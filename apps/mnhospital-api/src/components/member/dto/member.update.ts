import { Field, InputType, Int } from '@nestjs/graphql';
import {
	IsEmail,
	IsEnum,
	IsInt,
	IsMongoId,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	Matches,
	Min,
} from 'class-validator';
import { MemberAuthType, MemberStatus, MemberType } from '../enums/member.enum';
import { ObjectId } from 'mongoose';

@InputType()
export class MemberUpdate {
	@IsMongoId()
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@IsEnum(MemberType)
	@Field(() => MemberType, { nullable: true })
	memberType?: MemberType;

	@IsOptional()
	@IsEnum(MemberStatus)
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;

	@IsOptional()
	@IsEnum(MemberAuthType)
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;

	@IsOptional()
	@IsString()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/, {
		message: 'memberPhone must be a valid international or local phone number',
	})
	@Field(() => String, { nullable: true })
	memberPhone?: string;

	@IsOptional()
	@IsEmail()
	@Field(() => String, { nullable: true })
	memberMail?: string;

	@IsOptional()
	@IsString()
	@Length(3, 30)
	@Field(() => String, { nullable: true })
	memberNick?: string;

	@IsOptional()
	@IsString()
	@Length(8, 32)
	@Field(() => String, { nullable: true })
	memberPassword?: string;

	@IsOptional()
	@IsString()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	memberFullName?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	memberIdNumber?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	memberImage?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	memberDesc?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Field(() => Int, { nullable: true })
	memberAddress?: number;

	deleteAt?: Date;
}
