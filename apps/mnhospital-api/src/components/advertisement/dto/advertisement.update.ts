import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AdvertisementStatus } from '../enums/advertisement.enum';

@InputType()
export class AdvertisementUpdate {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: '_id must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@IsEnum(AdvertisementStatus)
	@Field(() => AdvertisementStatus, { nullable: true })
	advertisementStatus?: AdvertisementStatus;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String, { nullable: true })
	advertisementTitle?: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(1, 10000)
	@Field(() => String, { nullable: true })
	advertisementContent?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	advertisementImage?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	advertisementLink?: string;
}
