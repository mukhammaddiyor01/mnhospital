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
import { shapeIntoMongoObjectId } from '../../libs/config';
import { BookingService } from './booking.service';

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
}
