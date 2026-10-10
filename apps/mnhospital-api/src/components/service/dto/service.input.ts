import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsIn,
	IsInstance,
	IsInt,
	IsNotEmpty,
	IsNumber,
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
import { availableServiceSorts } from '../../../libs/config';
import { ServiceRoom, ServiceRoomName, ServiceStatus, ServiceType } from '../enums/service.enum';

@InputType()
export class ServiceInput {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'departmentId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	departmentId: ObjectId;

	@IsEnum(ServiceType)
	@IsNotEmpty()
	@Field(() => ServiceType)
	serviceType: ServiceType;

	@IsString()
	@IsNotEmpty()
	@Length(2, 100)
	@Field(() => String)
	serviceName: string;

	@IsOptional()
	@IsEnum(ServiceStatus)
	@Field(() => ServiceStatus, { nullable: true })
	serviceStatus?: ServiceStatus;

	@IsEnum(ServiceRoomName)
	@IsNotEmpty()
	@Field(() => ServiceRoomName)
	serviceRoomName: ServiceRoomName;

	@IsEnum(ServiceRoom)
	@IsNotEmpty()
	@Field(() => ServiceRoom)
	serviceRoom: ServiceRoom;

	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String)
	serviceTitle: string;

	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Field(() => Float)
	servicePrice: number;

	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@Field(() => [String])
	serviceImages?: string[];

	@IsString()
	@IsNotEmpty()
	@Length(1, 2000)
	@Field(() => String)
	serviceDesc?: string;

	@IsString()
	@IsNotEmpty()
	@Matches(/^(?:[1-9]\d{0,2}|1[0-3]\d{2}|14[0-3]\d|1440)$/, { message: 'Duration must be 1 to 1440 whole minutes' })
	@Field(() => String)
	serviceDuration: string;

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(366)
	@ArrayUnique()
	@IsString({ each: true })
	@Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
	@Field(() => [String], { nullable: true })
	availabilityDates?: string[];

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	@Field(() => Date, { nullable: true })
	openedAt?: Date;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	@Field(() => Date, { nullable: true })
	closedAt?: Date;
	memberId: ObjectId;
}

@InputType()
export class ServicePriceRange {
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Field(() => Float)
	start: number;

	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Field(() => Float)
	end: number;
}

@InputType()
export class ServicePeriodsRange {
	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	start: Date;

	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	end: Date;
}

@InputType()
export class ServiceSearch {
	@IsOptional()
	@IsBoolean()
	@Field(() => Boolean, { nullable: true })
	discountedOnly?: boolean;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'memberId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'departmentId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	departmentId?: ObjectId;

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceType, { each: true })
	@Field(() => [ServiceType], { nullable: true })
	serviceTypeList?: ServiceType[];

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceStatus, { each: true })
	@Field(() => [ServiceStatus], { nullable: true })
	serviceStatusList?: ServiceStatus[];

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceRoomName, { each: true })
	@Field(() => [ServiceRoomName], { nullable: true })
	serviceRoomNameList?: ServiceRoomName[];

	@IsOptional()
	@IsArray()
	@IsEnum(ServiceRoom, { each: true })
	@Field(() => [ServiceRoom], { nullable: true })
	serviceRoomList?: ServiceRoom[];

	@IsOptional()
	@ValidateNested()
	@Type(() => ServicePriceRange)
	@Field(() => ServicePriceRange, { nullable: true })
	priceRange?: ServicePriceRange;

	@IsOptional()
	@ValidateNested()
	@Type(() => ServicePeriodsRange)
	@Field(() => ServicePeriodsRange, { nullable: true })
	periodsRange?: ServicePeriodsRange;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class OrdinaryInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;
}

@InputType()
export class ServicesInquiry {
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
	@IsIn(availableServiceSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => ServiceSearch)
	@Field(() => ServiceSearch)
	search: ServiceSearch;
}

@InputType()
class DoctorServiceSearch {
	@IsOptional()
	@IsEnum(ServiceStatus)
	@Field(() => ServiceStatus, { nullable: true })
	serviceStatus?: ServiceStatus;
}

@InputType()
export class DoctorServicesInquiry {
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
	@IsIn(availableServiceSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsOptional()
	@ValidateNested()
	@Type(() => DoctorServiceSearch)
	@Field(() => DoctorServiceSearch, { nullable: true })
	search?: DoctorServiceSearch;
}
