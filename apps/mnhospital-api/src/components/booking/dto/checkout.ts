import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsString, Length, IsMongoId } from 'class-validator';
import { CartItemInput } from './cart.item.input';
import { BookingOrder } from './booking-order';
import { Payment } from './payment';
import { Appointment } from '../../appointment/dto/appointment';
import { PaymentProvider } from '../../patient/enums/patient.enum';
import { EximbayPrepareInput } from './eximbay.prepare.input';

@InputType()
export class AppointmentBookingInput extends CartItemInput {
	@IsString() @Length(8, 100) @Field(() => String)
	idempotencyKey: string;
}
@InputType()
export class BookingCheckoutInput {
	@IsMongoId() @Field(() => String)
	bookingOrderId: string;
	@IsEnum(PaymentProvider) @Field(() => PaymentProvider)
	paymentProvider: PaymentProvider;
}
@InputType()
export class TestOnlinePaymentInput extends EximbayPrepareInput {
	@IsString() @Field(() => String)
	outcome: string;
}
@ObjectType()
export class BookingPaymentOptions {
	@Field(() => String) onlineMode: string;
	@Field(() => String) timeZone: string;
	@Field(() => String) currency: string;
}
@ObjectType()
export class BookingCheckout {
	@Field(() => BookingOrder) order: BookingOrder;
	@Field(() => [Payment]) payments: Payment[];
	@Field(() => [Appointment]) appointments: Appointment[];
}
