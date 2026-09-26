import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { PaymentMethod, PaymentProvider, PaymentStatus } from '../../patient/enums/patient.enum';

@ObjectType()
export class Payment {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	serviceId: ObjectId;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	providerPaymentId: string;

	@Field(() => String)
	bookingOrderId: ObjectId;

	@Field(() => PaymentProvider)
	paymentProvider: PaymentProvider;

	@Field(() => String)
	idempotencyKey: string;

	@Field(() => Float)
	paymentAmount: number;

	@Field(() => String)
	paymentCurrency: string;

	@Field(() => PaymentMethod)
	paymentMethod: PaymentMethod;

	@Field(() => PaymentStatus)
	paymentStatus: PaymentStatus;

	@Field(() => Date, { nullable: true })
	paidAt?: Date;

	@Field(() => Date, { nullable: true })
	refundedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}
