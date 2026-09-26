import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	IsDate,
	IsEnum,
	IsInstance,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	Min,
} from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { DoctorReportFollowUp } from '../enums/doctor-report.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class DoctorReportInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	appointmentId: ObjectId;

	@IsString()
	@IsNotEmpty()
	@Length(1, 5000)
	@Field(() => String)
	docReportSymptoms: string;

	@IsString()
	@IsOptional()
	@Length(0, 5000)
	@Field(() => String, { nullable: true })
	docReportObservations?: string;

	@IsString()
	@IsNotEmpty()
	@Length(1, 5000)
	@Field(() => String)
	docReportDiagnosis: string;

	@IsString()
	@IsOptional()
	@Length(0, 5000)
	@Field(() => String, { nullable: true })
	docReportRecommendation?: string;

	@IsString()
	@IsNotEmpty()
	@Length(1, 5000)
	@Field(() => String)
	docReportMedication: string;

	@IsEnum(DoctorReportFollowUp)
	@IsNotEmpty()
	@Field(() => DoctorReportFollowUp)
	docReportFollowUp: DoctorReportFollowUp;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@Field(() => Date, { nullable: true })
	docReportFollowUpDate?: Date;
}

@InputType()
export class DoctorReportUpdateInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	reportId: ObjectId;

	@IsString()
	@IsOptional()
	@Length(1, 5000)
	@Field(() => String, { nullable: true })
	docReportSymptoms?: string;

	@IsString()
	@IsOptional()
	@Length(0, 5000)
	@Field(() => String, { nullable: true })
	docReportObservations?: string;

	@IsString()
	@IsOptional()
	@Length(1, 5000)
	@Field(() => String, { nullable: true })
	docReportDiagnosis?: string;

	@IsString()
	@IsOptional()
	@Length(0, 5000)
	@Field(() => String, { nullable: true })
	docReportRecommendation?: string;

	@IsString()
	@IsOptional()
	@Length(1, 5000)
	@Field(() => String, { nullable: true })
	docReportMedication?: string;

	@IsEnum(DoctorReportFollowUp)
	@IsOptional()
	@Field(() => DoctorReportFollowUp, { nullable: true })
	docReportFollowUp?: DoctorReportFollowUp;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@Field(() => Date, { nullable: true })
	docReportFollowUpDate?: Date;
}

@InputType()
export class DoctorReportInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;
}
