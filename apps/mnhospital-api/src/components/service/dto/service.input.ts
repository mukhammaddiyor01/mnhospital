import { Field, Float, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsDate,
	IsEnum,
	IsInstance,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	Min,
} from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
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
	@Length(1, 50)
	@Field(() => String)
	serviceDuration: string;

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
	memberId: import('mongoose').Schema.Types.ObjectId;
}
