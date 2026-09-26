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
import { BookingOrderInquiry } from './dto/booking-order.input';
import { BookingOrderStatus } from '../patient/enums/patient.enum';
import { Service } from '../service/dto/service';
import { ServiceStatus } from '../service/enums/service.enum';
import { Payment, Payments } from './dto/payment';
import { PaymentInput } from './dto/payment.input';
import { PaymentInquiry } from './dto/payment.inquiry';
import { PaymentProvider, PaymentStatus } from '../patient/enums/patient.enum';
import { MemberType } from '../member/enums/member.enum';
import { StaffBookingOrderInquiry } from './dto/staff-booking-order.input';
import { EximbayService } from './eximbay.service';
import { Member } from '../member/dto/member';

@Injectable()
export class BookingService {
	constructor(
		@InjectModel('Cart') private readonly cartModel: Model<Cart>,
		@InjectModel('CartItem') private readonly cartItemModel: Model<CartItem>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('BookingOrder') private readonly bookingOrderModel: Model<BookingOrder>,
		@InjectModel('Payment') private readonly paymentModel: Model<Payment>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		private readonly patientService: PatientService,
		private readonly eximbayService: EximbayService,
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

	public async getMyBookingOrders(memberId: ObjectId, input: BookingOrderInquiry): Promise<BookingOrders> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const match: Record<string, unknown> = { patientId };
		if (input.status) match.bookingOrderStatus = input.status;

		const result = await this.bookingOrderModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getMyBookingOrder(memberId: ObjectId, bookingOrderId: ObjectId): Promise<BookingOrder> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const result = await this.bookingOrderModel.findOne({ _id: bookingOrderId, patientId }).exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result;
	}

	public async cancelBookingOrder(memberId: ObjectId, bookingOrderId: ObjectId): Promise<BookingOrder> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const result = await this.bookingOrderModel
			.findOneAndUpdate(
				{
					_id: bookingOrderId,
					patientId,
					bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] },
				},
				{ $set: { bookingOrderStatus: BookingOrderStatus.CANCELLED, cancelledAt: new Date() } },
				{ new: true },
			)
			.exec();

		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		return result;
	}

	public async createPayment(memberId: ObjectId, input: PaymentInput): Promise<Payment> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const order = await this.bookingOrderModel
			.findOne({
				_id: input.bookingOrderId,
				patientId,
				bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] },
			})
			.lean()
			.exec();
		if (!order) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const orderItem = order.bookingOrderItems.find(
			(item) => item.serviceId === input.serviceId.toString() && item.doctorId === input.doctorId.toString(),
		);
		if (!orderItem) throw new BadRequestException('The selected service is not included in this booking order');

		const existingPayment = await this.paymentModel.findOne({ idempotencyKey: input.idempotencyKey }).exec();
		if (existingPayment) {
			const samePatient = existingPayment.patientId.toString() === patientId.toString();
			const sameOrder = existingPayment.bookingOrderId.toString() === input.bookingOrderId.toString();
			const sameService = existingPayment.serviceId.toString() === input.serviceId.toString();
			const sameDoctor = existingPayment.doctorId.toString() === input.doctorId.toString();
			if (!samePatient || !sameOrder || !sameService || !sameDoctor) {
				throw new BadRequestException('The idempotency key is already used for another payment');
			}
			return existingPayment;
		}

		const paymentAmount = Number(orderItem.servicePrice);
		if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
			throw new BadRequestException('Booking order contains an invalid payment amount');
		}

		return await this.paymentModel.create({
			serviceId: input.serviceId,
			patientId,
			doctorId: input.doctorId,
			providerPaymentId: `PAY-${uuidv4()}`,
			bookingOrderId: order._id,
			paymentProvider: input.paymentProvider,
			idempotencyKey: input.idempotencyKey,
			paymentAmount,
			paymentCurrency: order.bookingOrderCurrency,
			paymentMethod: input.paymentMethod,
			paymentStatus: PaymentStatus.PENDING,
		});
	}

	public async updatePaymentStatus(
		memberId: ObjectId,
		memberType: MemberType,
		paymentId: ObjectId,
		paymentStatus: PaymentStatus,
	): Promise<Payment> {
		if (![MemberType.ADMIN, MemberType.RECEPTIONIST].includes(memberType)) {
			throw new InternalServerErrorException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
		}

		const payment = await this.paymentModel.findById(paymentId).exec();
		if (!payment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const allowedStatuses: Record<PaymentStatus, PaymentStatus[]> = {
			[PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
			[PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
			[PaymentStatus.FAILED]: [],
			[PaymentStatus.REFUNDED]: [],
			[PaymentStatus.CANCELLED]: [],
		};
		if (!allowedStatuses[payment.paymentStatus].includes(paymentStatus)) {
			throw new BadRequestException(`Cannot change payment status from ${payment.paymentStatus} to ${paymentStatus}`);
		}

		payment.paymentStatus = paymentStatus;
		if (paymentStatus === PaymentStatus.PAID) payment.paidAt = new Date();
		if (paymentStatus === PaymentStatus.REFUNDED) payment.refundedAt = new Date();
		const result = await payment.save();

		if (paymentStatus === PaymentStatus.PAID) {
			await this.confirmBookingOrderIfAllPaymentsPaid(payment.bookingOrderId);
		}

		return result;
	}

	private async confirmBookingOrderIfAllPaymentsPaid(bookingOrderId: ObjectId): Promise<void> {
		const order = await this.bookingOrderModel.findById(bookingOrderId).exec();
		if (!order || order.bookingOrderStatus !== BookingOrderStatus.PENDING) return;

		const paidPayments = await this.paymentModel
			.find({ bookingOrderId: order._id, paymentStatus: PaymentStatus.PAID })
			.select('serviceId doctorId')
			.lean()
			.exec();
		const paidLines = new Set(paidPayments.map((item) => `${item.serviceId.toString()}:${item.doctorId.toString()}`));
		const allItemsPaid = order.bookingOrderItems.every((item) => paidLines.has(`${item.serviceId}:${item.doctorId}`));

		if (allItemsPaid) {
			await this.bookingOrderModel
				.findOneAndUpdate(
					{ _id: order._id, bookingOrderStatus: BookingOrderStatus.PENDING },
					{ $set: { bookingOrderStatus: BookingOrderStatus.CONFIRMED, confirmedAt: new Date() } },
				)
				.exec();
		}
	}

	public async verifyEximbayPayment(paymentId: ObjectId, rawData: string): Promise<{ firstTime: boolean }> {
		const payment = await this.paymentModel.findById(paymentId).lean().exec();
		if (!payment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		if (payment.paymentProvider !== PaymentProvider.EXIMBAY) throw new BadRequestException('Payment provider must be EXIMBAY');

		const transactionId = new URLSearchParams(rawData).get('transaction_id');
		if (!transactionId) throw new BadRequestException('Eximbay transaction_id is missing');

		await this.eximbayService.verify(rawData);
		const retrieved = await this.eximbayService.retrieve({
			providerPaymentId: payment.providerPaymentId,
			currency: payment.paymentCurrency,
			amount: payment.paymentAmount,
			transactionId,
		});

		const paidAmount = Number.parseFloat(retrieved.payment?.amount ?? '0');
		if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - payment.paymentAmount) > 0.001) {
			throw new BadRequestException(
				`Eximbay amount mismatch: expected ${payment.paymentAmount}, received ${retrieved.payment?.amount ?? '0'}`,
			);
		}
		if (retrieved.payment?.order_id && retrieved.payment.order_id !== payment.providerPaymentId) {
			throw new BadRequestException('Eximbay order_id does not match the payment');
		}

		const updated = await this.paymentModel
			.findOneAndUpdate(
				{ _id: payment._id, paymentStatus: PaymentStatus.PENDING },
				{ $set: { paymentStatus: PaymentStatus.PAID, gatewayTransactionId: transactionId, paidAt: new Date() } },
				{ new: true },
			)
			.exec();

		if (updated) await this.confirmBookingOrderIfAllPaymentsPaid(payment.bookingOrderId);
		return { firstTime: Boolean(updated) };
	}

	public async getMyPayments(memberId: ObjectId, input: PaymentInquiry): Promise<Payments> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const match: Record<string, unknown> = { patientId };
		if (input.status) match.paymentStatus = input.status;

		const result = await this.paymentModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getMyPayment(memberId: ObjectId, paymentId: ObjectId): Promise<Payment> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const result = await this.paymentModel.findOne({ _id: paymentId, patientId }).exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result;
	}

	public async prepareEximbayPayment(memberId: ObjectId, paymentId: ObjectId) {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const payment = await this.paymentModel.findOne({ _id: paymentId, patientId }).lean().exec();
		if (!payment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		if (payment.paymentProvider !== PaymentProvider.EXIMBAY) throw new BadRequestException('Payment provider must be EXIMBAY');
		if (payment.paymentStatus !== PaymentStatus.PENDING) throw new BadRequestException('Payment is no longer pending');

		const order = await this.bookingOrderModel.findOne({ _id: payment.bookingOrderId, patientId }).lean().exec();
		if (!order || order.bookingOrderStatus === BookingOrderStatus.CANCELLED) {
			throw new BadRequestException('Booking order is not available for payment');
		}

		const member = await this.memberModel.findById(memberId).select('memberFullName memberMail').lean().exec();
		return await this.eximbayService.prepare({
			paymentId: payment._id.toString(),
			providerPaymentId: payment.providerPaymentId,
			currency: payment.paymentCurrency,
			amount: payment.paymentAmount,
			buyerName: member?.memberFullName,
			buyerEmail: member?.memberMail,
		});
	}

	public async getStaffBookingOrders(
		memberType: MemberType,
		input: StaffBookingOrderInquiry,
	): Promise<BookingOrders> {
		if (![MemberType.ADMIN, MemberType.RECEPTIONIST].includes(memberType)) {
			throw new InternalServerErrorException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
		}

		const match: Record<string, unknown> = {};
		if (input.status) match.bookingOrderStatus = input.status;
		if (input.patientId) match.patientId = input.patientId;

		const result = await this.bookingOrderModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}
}
