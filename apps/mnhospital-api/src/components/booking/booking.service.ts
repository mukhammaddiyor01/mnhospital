import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../../libs/enums/common.enum';
import { PatientService } from '../patient/patient.service';
import { Cart, CartItem } from './dto/cart';
import { CartStatus } from '../patient/enums/patient.enum';
import { CartInput } from './dto/cart.input';
import { CartItemInput } from './dto/cart.item.input';
import { BookingOrder, BookingOrders } from './dto/booking-order';
import { BookingOrderStatus } from '../patient/enums/patient.enum';
import { Service } from '../service/dto/service';
import { ServiceStatus } from '../service/enums/service.enum';

@Injectable()
export class BookingService {
	constructor(
		@InjectModel('Cart') private readonly cartModel: Model<Cart>,
		@InjectModel('CartItem') private readonly cartItemModel: Model<CartItem>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('BookingOrder') private readonly bookingOrderModel: Model<BookingOrder>,
		private readonly patientService: PatientService,
	) {}

	public async createCart(memberId: ObjectId, input: CartInput): Promise<Cart> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const existingCart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (existingCart) return existingCart;

		return await this.cartModel.create({
			patientId,
			currency: input.currency ?? 'UZS',
			cartStatus: CartStatus.ACTIVE,
			subtotalAmount: 0,
			discountAmount: 0,
			totalAmount: 0,
		});
	}

	public async getMyCart(memberId: ObjectId): Promise<Cart> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		const items = await this.cartItemModel.find({ cartId: cart._id }).sort({ addedAt: -1 }).exec();
		(cart as Cart).items = items;
		return cart;
	}

	public async addCartItem(memberId: ObjectId, input: CartItemInput): Promise<CartItem> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const service = await this.serviceModel
			.findOne({
				_id: input.serviceId,
				memberId: input.doctorId,
				serviceStatus: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.lean()
			.exec();
		if (!service) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const serviceDuration = Number.parseInt(service.serviceDuration, 10);
		if (!Number.isFinite(serviceDuration) || serviceDuration <= 0) {
			throw new BadRequestException('Service duration must be a positive number');
		}

		let cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) {
			cart = await this.cartModel.create({
				patientId,
				currency: 'UZS',
				cartStatus: CartStatus.ACTIVE,
				subtotalAmount: 0,
				discountAmount: 0,
				totalAmount: 0,
			});
		}

		const item = await this.cartItemModel.create({
			cartId: cart._id,
			serviceId: service._id,
			doctorId: service.memberId,
			serviceType: service.serviceType,
			serviceName: service.serviceName,
			servicePrice: service.servicePrice,
			serviceDuration,
			patientNote: input.patientNote,
			requestedStartAt: input.requestedStartAt,
		});

		await this.cartModel
			.findByIdAndUpdate(cart._id, {
				$inc: {
					subtotalAmount: service.servicePrice,
					totalAmount: service.servicePrice,
				},
			})
			.exec();

		return item;
	}

	public async removeCartItem(memberId: ObjectId, cartItemId: ObjectId): Promise<CartItem> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const item = await this.cartItemModel.findOne({ _id: cartItemId, cartId: cart._id }).exec();
		if (!item) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		await this.cartItemModel.deleteOne({ _id: item._id, cartId: cart._id }).exec();
		await this.cartModel
			.findByIdAndUpdate(cart._id, {
				$inc: {
					subtotalAmount: -item.servicePrice,
					totalAmount: -item.servicePrice,
				},
			})
			.exec();

		return item;
	}

	public async createBookingOrder(memberId: ObjectId): Promise<BookingOrder> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const items = await this.cartItemModel.find({ cartId: cart._id }).sort({ addedAt: 1 }).lean().exec();
		if (!items.length) throw new BadRequestException('Cannot create a booking order from an empty cart');

		const existingOrder = await this.bookingOrderModel
			.findOne({ cartId: cart._id, bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] } })
			.lean()
			.exec();
		if (existingOrder) throw new BadRequestException(Message.CREATE_FAILED);

		const order = await this.bookingOrderModel.create({
			patientId,
			cartId: cart._id,
			orderCode: `BO-${uuidv4()}`,
			bookingOrderStatus: BookingOrderStatus.PENDING,
			bookingOrderCurrency: cart.currency,
			bookingOrderItems: items.map((item) => ({
				serviceId: item.serviceId.toString(),
				doctorId: item.doctorId.toString(),
				serviceName: item.serviceName,
				servicePrice: item.servicePrice.toString(),
				serviceDuration: item.serviceDuration.toString(),
				requestedStartAt: item.requestedStartAt.toISOString(),
			})),
			bookingOrderSubtotalAmount: cart.subtotalAmount,
			bookingOrderDiscountAmount: cart.discountAmount,
			bookingOrderTotalAmount: cart.totalAmount,
		});

		try {
			await this.cartModel.findByIdAndUpdate(cart._id, { $set: { cartStatus: CartStatus.CHECKED_OUT } }).exec();
		} catch (err) {
			await this.bookingOrderModel.deleteOne({ _id: order._id }).exec();
			throw err;
		}

		return order;
	}
}
