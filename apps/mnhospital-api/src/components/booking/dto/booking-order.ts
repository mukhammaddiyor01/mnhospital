import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { BookingOrderStatus } from '../../patient/enums/patient.enum';
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';
import { PaymentStatus, PaymentProvider } from '../../patient/enums/patient.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class BookingOrderItem {
 // Live operational state; never stored in the order's price snapshot.
 @Field(() => AppointmentStatus, { nullable: true }) appointmentStatus?: AppointmentStatus;
 @Field(() => String, { nullable: true }) appointmentCode?: string;
 @Field(() => String, { nullable: true }) paymentId?: string;
 @Field(() => PaymentStatus, { nullable: true }) paymentStatus?: PaymentStatus;
 @Field(() => PaymentProvider, { nullable: true }) paymentProvider?: PaymentProvider;
 @Field(() => Float, { nullable: true }) paymentAmount?: number;

	@Field(() => String)
	serviceId: string;

	@Field(() => String)
	doctorId: string;

	@Field(() => String)
	serviceName: string;

	@Field(() => String)
	servicePrice: string;

	@Field(() => Float, { nullable: true }) serviceBasePrice?: number;
	@Field(() => Float, { nullable: true }) serviceDiscountAmount?: number;
	@Field(() => Float, { nullable: true }) promoDiscountAmount?: number;

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
	@Field(() => Int, { nullable: true }) pricingVersion?: number; pricingRevision?: number; promoCodeId?: ObjectId;
	@Field(() => Date, { nullable: true }) pricingLockedAt?: Date;
	@Field(() => String, { nullable: true }) promoCode?: string;
	@Field(() => Float, { nullable: true }) serviceDiscountAmount?: number;
	@Field(() => Float, { nullable: true }) promoDiscountAmount?: number;
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
