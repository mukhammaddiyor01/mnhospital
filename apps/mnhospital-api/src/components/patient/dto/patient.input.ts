import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInstance, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
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
