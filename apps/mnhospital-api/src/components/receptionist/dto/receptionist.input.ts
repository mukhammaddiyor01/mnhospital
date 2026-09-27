import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInstance, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberAuthType, MemberStatus } from '../../member/enums/member.enum';

@InputType()
export class ReceptionistInput {
	@IsString()
	@IsNotEmpty()
	@Length(3, 30)
	@Field(() => String)
	receptionistNick: string;

	@IsString()
	@IsNotEmpty()
	@Length(8, 32)
	@Field(() => String)
	receptionistPassword: string;

	@IsString()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
	@Field(() => String)
	receptionistPhone: string;

	@IsEmail()
	@IsNotEmpty()
	@Field(() => String)
	receptionistMail: string;

	@IsString()
	@IsNotEmpty()
	@Length(2, 100)
	@Field(() => String)
	receptionistFullName: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistImage?: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistAddress?: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistDesc?: string;

	@IsEnum(MemberAuthType)
	@IsOptional()
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;
}

@InputType()
export class ReceptionistLoginInput {
	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	receptionistNick: string;

	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	receptionistPassword: string;
}

@InputType()
export class ReceptionistProfileUpdateInput {
	@IsString()
	@IsOptional()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	receptionistFullName?: string;

	@IsString()
	@IsOptional()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
	@Field(() => String, { nullable: true })
	receptionistPhone?: string;

	@IsEmail()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistMail?: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistImage?: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistAddress?: string;

	@IsString()
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistDesc?: string;
}

@InputType()
export class ReceptionistAdminUpdateInput extends ReceptionistProfileUpdateInput {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsEnum(MemberStatus)
	@IsOptional()
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;
}

@InputType()
export class ReceptionistStatusUpdateInput {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsEnum(MemberStatus)
	@IsNotEmpty()
	@Field(() => MemberStatus)
	memberStatus: MemberStatus;
}

@InputType()
export class ReceptionistReportInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId)
	@IsOptional()
	@Field(() => String, { nullable: true })
	patientId?: ObjectId;
}

@InputType()
export class ReceptionistInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@IsEnum(MemberStatus)
	@IsOptional()
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;
}
