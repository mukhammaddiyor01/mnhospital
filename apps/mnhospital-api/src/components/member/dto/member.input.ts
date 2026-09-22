import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { MemberAuthType, MemberStatus, MemberType } from '../enums/member.enum';
import { availableMemberSorts } from '../../../libs/config';
import { Direction } from '../../../libs/enums/common.enum';

@InputType()
export class MemberInput {
	@IsString()
	@IsNotEmpty()
	@Length(3, 30)
	@Field(() => String)
	memberNick: string;

	@IsString()
	@IsNotEmpty()
	@Length(8, 32)
	@Field(() => String)
	memberPassword: string;

	@IsString()
	@IsNotEmpty()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/, {
		message: 'memberPhone must be a valid international or local phone number',
	})
	@Field(() => String)
	memberPhone: string;

	@IsOptional()
	@IsEmail()
	@Field(() => String, { nullable: true })
	memberMail?: string;

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

	@IsOptional()
	@IsEnum(MemberType)
	@Field(() => MemberType, { nullable: true })
	memberType?: MemberType;

	@IsOptional()
	@IsEnum(MemberAuthType)
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;
}

@InputType()
export class LoginInput {
	@IsNotEmpty()
	@Length(3, 12)
	@Field(() => String)
	memberNick: string;

	@IsNotEmpty()
	@Length(5, 12)
	@Field(() => String)
	memberPassword: string;
}

/** ADMIN */

@InputType()
class MISearch {
	@IsOptional()
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;

	@IsOptional()
	@Field(() => MemberType, { nullable: true })
	memberType?: MemberType;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class MembersInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableMemberSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => MISearch)
	search: MISearch;
}
