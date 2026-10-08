import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInstance, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class CartItemInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	serviceId: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	doctorId: ObjectId;

	@IsOptional()
	@IsString()
	@MaxLength(1000)
	@Field(() => String, { nullable: true })
	patientNote?: string;

	@Type(() => Date)
	@IsDate()
	@IsNotEmpty()
	@Field(() => Date)
	requestedStartAt: Date;
}
