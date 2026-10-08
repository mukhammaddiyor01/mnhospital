import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { BookingOrderStatus } from '../../patient/enums/patient.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class BookingOrderItem {
	@Field(() => String)
	serviceId: string;

	@Field(() => String)
	doctorId: string;

	@Field(() => String)
	serviceName: string;

	@Field(() => String)
	servicePrice: string;

	@Field(() => String)
	serviceDuration: string;

	@Field(() => String)
	requestedStartAt: string;

	@Field(() => String, { nullable: true })
	patientNote?: string;

	@Field(() => String, { nullable: true })
	appointmentId?: string;
}

@ObjectType()
export class BookingOrder {
	checkoutKey?: string;
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => String)
	cartId: ObjectId;

	@Field(() => String)
	orderCode: string;

	@Field(() => BookingOrderStatus)
	bookingOrderStatus: BookingOrderStatus;

	@Field(() => String)
	bookingOrderCurrency: string;

	@Field(() => [BookingOrderItem])
	bookingOrderItems: BookingOrderItem[];

	@Field(() => Float)
	bookingOrderSubtotalAmount: number;

	@Field(() => Float)
	bookingOrderDiscountAmount: number;

	@Field(() => Float)
	bookingOrderTotalAmount: number;

	@Field(() => Date, { nullable: true })
	confirmedAt?: Date;

	@Field(() => Date, { nullable: true })
	cancelledAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class BookingOrders {
	@Field(() => [BookingOrder])
	list: BookingOrder[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
