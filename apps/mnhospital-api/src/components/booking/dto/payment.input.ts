import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty, IsString, Length } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { PaymentMethod, PaymentProvider } from '../../patient/enums/patient.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class PaymentInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	bookingOrderId: ObjectId;

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

	@IsEnum(PaymentProvider)
	@IsNotEmpty()
	@Field(() => PaymentProvider)
	paymentProvider: PaymentProvider;

	@IsEnum(PaymentMethod)
	@IsNotEmpty()
	@Field(() => PaymentMethod)
	paymentMethod: PaymentMethod;

	@IsString()
	@IsNotEmpty()
	@Length(8, 100)
	@Field(() => String)
	idempotencyKey: string;
}
