import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { CartStatus } from '../../patient/enums/patient.enum';

@ObjectType()
export class CartItem {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	cartId: ObjectId;

	@Field(() => String)
	serviceId: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	serviceType: string;

	@Field(() => String)
	serviceName: string;

	@Field(() => Float)
	servicePrice: number;

	@Field(() => Float)
	serviceDuration: number;

	@Field(() => String, { nullable: true })
	patientNote?: string;

	@Field(() => Date)
	requestedStartAt: Date;

	@Field(() => Date)
	addedAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

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

	@Field(() => [CartItem], { nullable: true })
	items?: CartItem[];

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}
