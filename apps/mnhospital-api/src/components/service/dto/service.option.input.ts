import { ServiceStatus } from '../enums/service.enum';
import { Transform } from 'class-transformer';
import { Field, Float, InputType } from '@nestjs/graphql';
import {
	IsArray,
	ArrayNotEmpty,
	ArrayMaxSize,
	ArrayUnique,
	IsEnum,
	IsMongoId,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	Matches,
	Max,
	Min,
} from 'class-validator';
@InputType()
export class ServiceOptionInput {
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(3)
	@ArrayUnique()
	@IsMongoId({ each: true })
	@Field(() => [String], { nullable: true })
	includedServiceIds?: string[];

	@IsMongoId() @Field(() => String) baseServiceId: string;
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(2, 150)
	@Field(() => String)
	serviceTitle: string;
	@IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1e9) @Field(() => Float) servicePrice: number;
	@IsString() @Matches(/^(?:[1-9]\d{0,2}|1[0-3]\d{2}|14[0-3]\d|1440)$/) @Field(() => String) serviceDuration: string;
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 2000)
	@Field(() => String, { nullable: true })
	serviceDesc?: string;
}

@InputType()
export class ServiceOptionUpdateInput extends ServiceOptionInput {
	@IsMongoId() @Field(() => String) optionId: string;
	@IsOptional() @IsEnum(ServiceStatus) @Field(() => ServiceStatus, { nullable: true }) serviceStatus?: ServiceStatus;
}
