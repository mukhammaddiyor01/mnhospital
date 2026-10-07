import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { Cart } from './dto/cart';
import { CartInput } from './dto/cart.input';
import { CartItemInput } from './dto/cart.item.input';
import { CartItem } from './dto/cart';
import { BookingOrder } from './dto/booking-order';
import { BookingOrders } from './dto/booking-order';
import { BookingOrderInquiry } from './dto/booking-order.input';
import { DoctorBookingRequests } from './dto/doctor-booking-request';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { BookingService } from './booking.service';
import { Payment } from './dto/payment';
import { PaymentInput } from './dto/payment.input';
import { PaymentStatusInput } from './dto/payment.status.input';
import { T } from '../../libs/types/common';
import { Payments } from './dto/payment';
import { PaymentInquiry } from './dto/payment.inquiry';
import { StaffBookingOrderInquiry } from './dto/staff-booking-order.input';
import { EximbayPrepareInput } from './dto/eximbay.prepare.input';
import { EximbayPrepare } from './dto/eximbay.prepare';

@Resolver()
export class BookingResolver {
	constructor(private readonly bookingService: BookingService) {}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Cart)
	public async createCart(
		@Args('input') input: CartInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Cart> {
		console.log('Mutation: createCart');
		return await this.bookingService.createCart(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Cart)
	public async getMyCart(@AuthMember('_id') memberId: ObjectId): Promise<Cart> {
		console.log('Query: getMyCart');
		return await this.bookingService.getMyCart(memberId);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => CartItem)
	public async addCartItem(
		@Args('input') input: CartItemInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<CartItem> {
		console.log('Mutation: addCartItem');
		return await this.bookingService.addCartItem(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => CartItem)
	public async removeCartItem(
		@Args('cartItemId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<CartItem> {
		console.log('Mutation: removeCartItem');
		return await this.bookingService.removeCartItem(memberId, shapeIntoMongoObjectId(input));
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => BookingOrder)
	public async createBookingOrder(@AuthMember('_id') memberId: ObjectId): Promise<BookingOrder> {
		console.log('Mutation: createBookingOrder');
		return await this.bookingService.createBookingOrder(memberId);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => BookingOrders)
	public async getMyBookingOrders(
		@Args('input') input: BookingOrderInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BookingOrders> {
		console.log('Query: getMyBookingOrders');
		return await this.bookingService.getMyBookingOrders(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => BookingOrder)
	public async getMyBookingOrder(
		@Args('bookingOrderId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BookingOrder> {
		console.log('Query: getMyBookingOrder');
		return await this.bookingService.getMyBookingOrder(memberId, shapeIntoMongoObjectId(input));
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => BookingOrder)
	public async cancelBookingOrder(
		@Args('bookingOrderId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BookingOrder> {
		console.log('Mutation: cancelBookingOrder');
		return await this.bookingService.cancelBookingOrder(memberId, shapeIntoMongoObjectId(input));
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Payment)
	public async createPayment(
		@Args('input') input: PaymentInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Payment> {
		console.log('Mutation: createPayment');
		return await this.bookingService.createPayment(memberId, input);
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Payment)
	public async updatePaymentStatus(
		@Args('input') input: PaymentStatusInput,
		@AuthMember() authMember: T,
	): Promise<Payment> {
		console.log('Mutation: updatePaymentStatus');
		return await this.bookingService.updatePaymentStatus(
			authMember._id,
			authMember.memberType,
			input.paymentId,
			input.paymentStatus,
		);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Payments)
	public async getMyPayments(
		@Args('input') input: PaymentInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Payments> {
		console.log('Query: getMyPayments');
		return await this.bookingService.getMyPayments(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Payment)
	public async getMyPayment(
		@Args('paymentId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Payment> {
		console.log('Query: getMyPayment');
		return await this.bookingService.getMyPayment(memberId, shapeIntoMongoObjectId(input));
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => EximbayPrepare)
	public async prepareEximbayPayment(
		@Args('input') input: EximbayPrepareInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<EximbayPrepare> {
		console.log('Mutation: prepareEximbayPayment');
		return await this.bookingService.prepareEximbayPayment(memberId, input.paymentId);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => DoctorBookingRequests)
	public async getMyDoctorBookingRequests(
		@Args('input') input: BookingOrderInquiry,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorBookingRequests> {
		return this.bookingService.getDoctorBookingRequests(doctorId, input);
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => BookingOrders)
	public async getBookingOrders(@Args('input') input: StaffBookingOrderInquiry, @AuthMember() authMember: T): Promise<BookingOrders> {
		console.log('Query: getBookingOrders');
		return await this.bookingService.getStaffBookingOrders(authMember.memberType, input);
	}
	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Payments)
	public async getPayments(@Args('input') input: PaymentInquiry, @AuthMember() authMember: T): Promise<Payments> {
		return this.bookingService.getStaffPayments(authMember.memberType, input);
	}

}
