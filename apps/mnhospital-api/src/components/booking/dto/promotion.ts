import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type, Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsMongoId,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	Matches,
	Max,
	Min,
} from 'class-validator';
import { Types } from 'mongoose';
import { TotalCounter } from '../../member/dto/member';

export enum PromoDiscountType {
	PERCENT = 'PERCENT',
	FIXED = 'FIXED',
}
registerEnumType(PromoDiscountType, { name: 'PromoDiscountType' });
@InputType()
export class PromoCodeInput {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
	@IsString()
	@Length(3, 32)
	@Matches(/^[A-Z0-9_-]+$/)
	@Field(() => String)
	code: string;
	@IsEnum(PromoDiscountType) @Field(() => PromoDiscountType) discountType: PromoDiscountType;
	@IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000000000) @Field(() => Float) discountValue: number;
	@IsBoolean() @Field(() => Boolean) isActive: boolean;
	@IsOptional() @IsBoolean() @Field(() => Boolean, { nullable: true }) showOnHomepage?: boolean;
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(1000000000)
	@Field(() => Float, { defaultValue: 0 })
	minSubtotal: number = 0;
	@IsOptional() @Type(() => Date) @IsDate() @Field(() => Date, { nullable: true }) startsAt?: Date;
	@IsOptional() @Type(() => Date) @IsDate() @Field(() => Date, { nullable: true }) expiresAt?: Date;
	@IsArray()
	@ArrayMaxSize(100)
	@ArrayUnique()
	@IsMongoId({ each: true })
	@Field(() => [String], { defaultValue: [] })
	serviceIds: string[] = [];
}
@InputType()
export class PromoCodeUpdate extends PromoCodeInput {
	@IsMongoId() @Field(() => String) _id: string;
}
@InputType()
export class PromoCodesInquiry {
	@IsInt() @Min(1) @Field(() => Int, { defaultValue: 1 }) page = 1;
	@IsInt() @Min(1) @Max(100) @Field(() => Int, { defaultValue: 10 }) limit = 10;
}
@InputType()
export class BookingPromoInput {
	@IsMongoId() @Field(() => String) bookingOrderId: string;
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
	@IsString()
	@Length(3, 32)
	@Matches(/^[A-Z0-9_-]+$/)
	@Field(() => String, { nullable: true })
	promoCode?: string;
}
@ObjectType()
export class PromoCode {
	@Field(() => String) _id: Types.ObjectId;
	@Field(() => String) code: string;
	@Field(() => PromoDiscountType) discountType: PromoDiscountType;
	@Field(() => Float) discountValue: number;
	@Field(() => String) currency: string;
	@Field(() => Boolean) isActive: boolean;
	@Field(() => Boolean, { nullable: true }) showOnHomepage?: boolean;
	@Field(() => Float) minSubtotal: number;
	@Field(() => [String]) serviceIds: string[];
	@Field(() => Date, { nullable: true }) startsAt?: Date;
	@Field(() => Date, { nullable: true }) expiresAt?: Date;
	@Field(() => Date) createdAt: Date;
	@Field(() => Date) updatedAt: Date;
	deletedAt?: Date;
}
@ObjectType()
export class PromoCodes {
	@Field(() => [PromoCode]) list: PromoCode[];
	@Field(() => [TotalCounter]) metaCounter: TotalCounter[];
}

@ObjectType()
export class PublicPromoOffer {
 @Field(() => String) _id: Types.ObjectId;
 @Field(() => String) code: string;
 @Field(() => PromoDiscountType) discountType: PromoDiscountType;
 @Field(() => Float) discountValue: number;
 @Field(() => String) currency: string;
 @Field(() => Float) minSubtotal: number;
 @Field(() => [String]) serviceIds: string[];
 @Field(() => Date, { nullable: true }) expiresAt?: Date;
}
