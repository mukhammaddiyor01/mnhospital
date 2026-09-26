import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
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
