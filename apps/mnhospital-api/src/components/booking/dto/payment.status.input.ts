import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { PaymentStatus } from '../../patient/enums/patient.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class PaymentStatusInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	paymentId: ObjectId;

	@IsEnum(PaymentStatus)
	@IsNotEmpty()
	@Field(() => PaymentStatus)
	paymentStatus: PaymentStatus;
}
