import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { AdvertisementStatus } from '../enums/advertisement.enum';

@InputType()
export class AdvertisementInput {
	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String)
	advertisementTitle: string;

	@IsString()
	@IsNotEmpty()
	@Length(1, 10000)
	@Field(() => String)
	advertisementContent: string;

	@IsOptional()
	@IsEnum(AdvertisementStatus)
	@Field(() => AdvertisementStatus, { nullable: true })
	advertisementStatus?: AdvertisementStatus;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	advertisementImage?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	advertisementLink?: string;
}

@InputType()
export class AdvertisementsInquiry {
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
