import { Field, Float, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsDate,
	IsEnum,
	IsInstance,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	Matches,
	Min,
} from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ServiceRoom, ServiceRoomName, ServiceStatus, ServiceType } from '../enums/service.enum';

@InputType()
export class ServiceUpdate {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: '_id must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'departmentId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	departmentId?: ObjectId;

	@IsOptional()
	@IsEnum(ServiceType)
	@Field(() => ServiceType, { nullable: true })
	serviceType?: ServiceType;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 100)
	@Field(() => String, { nullable: true })
	serviceName?: string;

	@IsOptional()
	@IsEnum(ServiceStatus)
	@Field(() => ServiceStatus, { nullable: true })
	serviceStatus?: ServiceStatus;

	@IsOptional()
	@IsEnum(ServiceRoomName)
	@Field(() => ServiceRoomName, { nullable: true })
	serviceRoomName?: ServiceRoomName;

	@IsOptional()
	@IsEnum(ServiceRoom)
	@Field(() => ServiceRoom, { nullable: true })
	serviceRoom?: ServiceRoom;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String, { nullable: true })
	serviceTitle?: string;

	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Field(() => Float, { nullable: true })
	servicePrice?: number;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@Field(() => [String], { nullable: true })
	serviceImages?: string[];

	@IsOptional()
	@IsString()
	@Length(1, 2000)
	@Field(() => String, { nullable: true })
	serviceDesc?: string;

	@IsOptional()
	@IsString()
	@Matches(/^(?:[1-9]\d{0,2}|1[0-3]\d{2}|14[0-3]\d|1440)$/, { message: 'Duration must be 1 to 1440 whole minutes' })
	@Field(() => String, { nullable: true })
	serviceDuration?: string;

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

	inactiveAt?: Date;

	unavailabeAt?: Date;
}
