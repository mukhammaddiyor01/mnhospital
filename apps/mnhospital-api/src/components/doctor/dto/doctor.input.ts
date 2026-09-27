import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	IsEmail,
	IsEnum,
	IsInstance,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	Matches,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Direction } from '../../../libs/enums/common.enum';
import { DoctorSort, DoctorSpecialty } from '../enums/doctor.enum';
import { MemberAuthType, MemberStatus } from '../../member/enums/member.enum';

@InputType()
export class DoctorInput {
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'servicesId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	servicesId?: ObjectId;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'departmentId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	departmentId?: ObjectId;

	@IsOptional()
	@IsEnum(DoctorSpecialty)
	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;

	@IsString()
	@IsNotEmpty()
	@Length(3, 30)
	@Field(() => String)
	docNick: string;

	@IsString()
	@IsNotEmpty()
	@Length(8, 32)
	@Field(() => String)
	docPassword: string;

	@IsString()
	@Matches(/^(?:\+?[1-9]\d{7,14}|0\d{1,2}-?\d{3,4}-?\d{4})$/, {
		message: 'docPhone must be a valid international or local phone number',
	})
	@Field(() => String)
	docPhone: string;

	@IsOptional()
	@IsEmail()
	@Field(() => String, { nullable: true })
	docMail?: string;

	@IsOptional()
	@IsString()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	docFullName?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	docImage?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	docAddress?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	docDesc?: string;

	@IsInt()
	@Min(0)
	@Field(() => Int)
	docExperience?: number;

	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	docRoom: string;

	@IsOptional()
	@IsEnum(MemberAuthType)
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;
}

@InputType()
export class DoctorLoginInput {
	@IsString()
	@IsNotEmpty()
	@Length(3, 30)
	@Field(() => String)
	docNick: string;

	@IsString()
	@IsNotEmpty()
	@Length(8, 32)
	@Field(() => String)
	docPassword: string;
}

@InputType()
export class DoctorStatusUpdateInput {
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
export class DoctorSearch {
	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class DoctorsInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsEnum(DoctorSpecialty)
	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;

	@ValidateNested()
	@Type(() => DoctorSearch)
	@Field(() => DoctorSearch)
	search: DoctorSearch;

	@IsOptional()
	@IsEnum(DoctorSort)
	@Field(() => DoctorSort, { nullable: true })
	sort?: DoctorSort;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;
}

@InputType()
export class AdminDoctorInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Max(100)
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

	@IsOptional()
	@IsEnum(DoctorSpecialty)
	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;
}
