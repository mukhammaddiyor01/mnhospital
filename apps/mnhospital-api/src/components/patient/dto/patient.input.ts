import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInstance, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberStatus } from '../../member/enums/member.enum';
import { PatientBloodType, PatientGender } from '../enums/patient.enum';

@InputType()
export class PatientProfileInput {
	@IsEnum(PatientBloodType)
	@IsNotEmpty()
	@Field(() => PatientBloodType)
	patientBloodType: PatientBloodType;

	@IsEnum(PatientGender)
	@IsNotEmpty()
	@Field(() => PatientGender)
	patientGender: PatientGender;

	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	patientBirthDate: Date;

	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	patientIdNumber: string;

	@IsOptional()
	@IsString()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	patientFullName?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	patientImage?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	patientDesc?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	patientAddress?: string;
}

@InputType()
export class PatientStatusUpdateInput {
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
export class AdminPatientInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@IsOptional()
	@IsEnum(MemberStatus)
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	text?: string;
}
