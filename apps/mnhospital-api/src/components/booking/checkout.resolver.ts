import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { MemberType } from '../member/enums/member.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { CheckoutService } from './checkout.service';
import { AppointmentBookingInput, BookingCheckout, BookingCheckoutInput, BookingPaymentOptions, TestOnlinePaymentInput } from './dto/checkout';
import { BookingOrder } from './dto/booking-order';
import { Payment } from './dto/payment';

@Resolver()
export class CheckoutResolver {
	constructor(private readonly checkout: CheckoutService) {}
	@UseGuards(WithoutGuard) @Query(() => BookingPaymentOptions)
	getBookingPaymentOptions() { return this.checkout.getOptions(); }
	@Roles(MemberType.PATIENT) @UseGuards(RolesGuard) @Mutation(() => BookingOrder)
	createAppointmentBooking(@Args('input') input: AppointmentBookingInput, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.checkout.createBooking(memberId, input);
	}
	@Roles(MemberType.PATIENT) @UseGuards(RolesGuard) @Query(() => BookingCheckout)
	getMyBookingCheckout(@Args('bookingOrderId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.checkout.getCheckout(memberId, shapeIntoMongoObjectId(id));
	}
	@Roles(MemberType.PATIENT) @UseGuards(RolesGuard) @Mutation(() => BookingCheckout)
	chooseBookingPayment(@Args('input') input: BookingCheckoutInput, @AuthMember('_id') memberId: Types.ObjectId) {
		shapeIntoMongoObjectId(input.bookingOrderId);
		return this.checkout.choosePayment(memberId, input);
	}
	@Roles(MemberType.PATIENT) @UseGuards(RolesGuard) @Mutation(() => Payment)
	completeTestOnlinePayment(@Args('input') input: TestOnlinePaymentInput, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.checkout.completeTestPayment(memberId, input.paymentId, input.outcome);
	}
}
