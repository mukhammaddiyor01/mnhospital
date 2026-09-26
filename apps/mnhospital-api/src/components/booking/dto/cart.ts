import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { CartStatus } from '../../patient/enums/patient.enum';

@ObjectType()
export class Cart {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => CartStatus)
	cartStatus: CartStatus;

	@Field(() => String)
	currency: string;

	@Field(() => Float)
	subtotalAmount: number;

	@Field(() => Float)
	discountAmount: number;

	@Field(() => Float)
	totalAmount: number;

	@Field(() => Date, { nullable: true })
	expiresAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}
