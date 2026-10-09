import { PromotionService } from './promotion.service';
import { discountedServicePrice } from './pricing.policy';
import { clinicCurrency } from '../../libs/booking/clinic-time';
import { AppointmentService } from '../appointment/appointment.service';
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
import { DoctorBookingRequests } from './dto/doctor-booking-request';
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
import { NotificationEventService } from '../notification/notification-event.service';
import { NotificationGroup, NotificationType } from '../notification/enums/notification.enum';

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
		private readonly notificationEvents: NotificationEventService,
		private readonly appointmentService?: AppointmentService,
		private readonly promotions?: PromotionService,
	) {}

	public async createCart(memberId: ObjectId, input: CartInput): Promise<Cart> {
		if (input.currency && input.currency !== clinicCurrency()) throw new BadRequestException('Cart currency must match the clinic catalog');
		const patientId = await this.patientService.resolveProfileId(memberId);
		const existingCart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (existingCart) return existingCart;

		return await this.cartModel.create({
			patientId,
			currency: input.currency ?? clinicCurrency(),
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

		const serviceDuration = Number(service.serviceDuration);
		if (!Number.isInteger(serviceDuration) || serviceDuration <= 0 || serviceDuration > 1440) {
			throw new BadRequestException('Service duration must be a positive number');
		}

		let cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) {
			cart = await this.cartModel.create({
				patientId,
				currency: clinicCurrency(),
				cartStatus: CartStatus.ACTIVE,
				subtotalAmount: 0,
				discountAmount: 0,
				totalAmount: 0,
			});
		}

		if (cart.currency !== clinicCurrency()) throw new BadRequestException('Cart currency must match the clinic catalog');
		const price = discountedServicePrice(service.servicePrice, service.serviceDiscountPercent ?? 0, cart.currency);
		const item = await this.cartItemModel.create({
			cartId: cart._id,
			serviceId: service._id,
			doctorId: service.memberId,
			serviceType: service.serviceType,
			serviceName: service.serviceName,
			serviceBasePrice: price.base, serviceDiscountAmount: price.discount, servicePrice: price.total,
			serviceDuration,
			patientNote: input.patientNote,
			requestedStartAt: input.requestedStartAt,
		});

		await this.cartModel
			.findByIdAndUpdate(cart._id, {
				$inc: {
					subtotalAmount: price.base, discountAmount: price.discount,
					totalAmount: price.total,
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
					subtotalAmount: -(item.serviceBasePrice ?? item.servicePrice), discountAmount: -(item.serviceDiscountAmount ?? 0),
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
		if (new Set(items.map((item) => `${item.serviceId}:${item.doctorId}`)).size !== items.length) throw new BadRequestException('Each service may appear only once in a booking');
		if (!items.length) throw new BadRequestException('Cannot create a booking order from an empty cart');

		const existingOrder = await this.bookingOrderModel
			.findOne({
				cartId: cart._id,
				bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] },
			})
			.lean()
			.exec();
		if (existingOrder) throw new BadRequestException(Message.CREATE_FAILED);

		const order = await this.bookingOrderModel.create({
			patientId,
			cartId: cart._id,
			pricingVersion: 1, pricingRevision: 0, serviceDiscountAmount: cart.discountAmount, promoDiscountAmount: 0,
			orderCode: `BO-${uuidv4()}`,
			bookingOrderStatus: BookingOrderStatus.PENDING,
			bookingOrderCurrency: cart.currency,
			bookingOrderItems: items.map((item) => ({
				serviceId: item.serviceId.toString(),
				doctorId: item.doctorId.toString(),
				serviceName: item.serviceName,
				serviceBasePrice: item.serviceBasePrice ?? item.servicePrice, serviceDiscountAmount: item.serviceDiscountAmount ?? 0, promoDiscountAmount: 0,
				servicePrice: item.servicePrice.toString(),
				serviceDuration: item.serviceDuration.toString(),
				requestedStartAt: item.requestedStartAt.toISOString(),
				patientNote: item.patientNote,
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
		await this.notificationEvents.toPatient(patientId, {
			key: `booking-order:${order._id}:created`,
			type: NotificationType.SYSTEM,
			group: NotificationGroup.BOOKING_ORDER,
			title: 'Booking order created',
			description: 'Your booking order is awaiting payment.',
			refId: order._id,
			authorId: memberId,
			authorType: MemberType.PATIENT,
		});
		for (const doctorId of new Set(items.map((item) => item.doctorId.toString()))) {
			await this.notificationEvents.toDoctor(new Types.ObjectId(doctorId), {
				key: `booking-order:${order._id}:created`,
				type: NotificationType.SYSTEM,
				group: NotificationGroup.BOOKING_ORDER,
				title: 'New booking request',
				description: 'A booking request for your service is awaiting payment and appointment creation.',
				refId: order._id,
				authorId: memberId,
				authorType: MemberType.PATIENT,
			});
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
		if (this.appointmentService) await this.appointmentService.assertOrderCancellable(await this.getMyBookingOrder(memberId, bookingOrderId));
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
		await this.paymentModel.updateMany({ bookingOrderId: result._id, patientId, paymentStatus: PaymentStatus.PENDING }, { $set: { paymentStatus: PaymentStatus.CANCELLED, activeIntent: false } }).exec();
		await this.appointmentService?.cancelOrderReservations(result, memberId);
		await this.notificationEvents.toPatient(patientId, {
			key: `booking-order:${result._id}:cancelled`,
			type: NotificationType.SYSTEM,
			group: NotificationGroup.BOOKING_ORDER,
			title: 'Booking order cancelled',
			description: 'Your booking order was cancelled.',
			refId: result._id,
			authorId: memberId,
			authorType: MemberType.PATIENT,
		});
		return result;
	}

	public async createPayment(memberId: ObjectId, input: PaymentInput): Promise<Payment> {
		if (![PaymentProvider.CASH, PaymentProvider.EXIMBAY].includes(input.paymentProvider) ||
			(input.paymentProvider === PaymentProvider.CASH ? input.paymentMethod !== 'CASH' : input.paymentMethod !== 'CARD')) {
			throw new BadRequestException('Choose cash or Eximbay card payment');
		}
		const patientId = await this.patientService.resolveProfileId(memberId);
		let order = await this.bookingOrderModel
			.findOne({
				_id: input.bookingOrderId,
				patientId,
				bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] },
			})
			.lean()
			.exec();
		if (!order) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (input.paymentProvider === PaymentProvider.EXIMBAY) {
			const mode = this.eximbayService.getTestMode?.();
			if (mode === 'DISABLED' || mode === 'SANDBOX' && order.bookingOrderCurrency === 'UZS') throw new BadRequestException('Online sandbox payment is unavailable for this booking currency');
		}

		let orderItem = order.bookingOrderItems.find(
			(item) => item.serviceId === input.serviceId.toString() && item.doctorId === input.doctorId.toString(),
		);
		if (!orderItem) throw new BadRequestException('The selected service is not included in this booking order');

		const existingPayment = await this.paymentModel.findOne({ idempotencyKey: input.idempotencyKey }).exec();
		if (existingPayment) {
			const samePatient = existingPayment.patientId.toString() === patientId.toString();
			const sameOrder = existingPayment.bookingOrderId.toString() === input.bookingOrderId.toString();
			const sameService = existingPayment.serviceId.toString() === input.serviceId.toString();
			const sameDoctor = existingPayment.doctorId.toString() === input.doctorId.toString();
			if (
				!samePatient ||
				!sameOrder ||
				!sameService ||
				!sameDoctor ||
				existingPayment.paymentProvider !== input.paymentProvider ||
				existingPayment.paymentMethod !== input.paymentMethod
			) {
				throw new BadRequestException('The idempotency key is already used for another payment');
			}
			return existingPayment;
		}

		const paidPayment = await this.paymentModel
			.findOne({
				patientId,
				bookingOrderId: order._id,
				serviceId: input.serviceId,
				doctorId: input.doctorId,
				paymentStatus: { $in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
			})
			.exec();
		if (paidPayment) {
			if (paidPayment.paymentStatus === PaymentStatus.PENDING && paidPayment.paymentProvider !== input.paymentProvider) throw new BadRequestException('A payment with another method is already pending');
			return paidPayment;
		}

		if (order.pricingVersion === 1) {
			if (!order.pricingLockedAt) await this.promotions.assertAvailable(order);
			order = await this.bookingOrderModel.findOneAndUpdate({ _id: order._id, patientId, bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] } }, { $set: { pricingLockedAt: new Date() } }, { new: true }).lean().exec();
			if (!order) throw new BadRequestException('Booking is no longer available for payment');
		}

		orderItem = order.bookingOrderItems.find(item => item.serviceId === String(input.serviceId) && item.doctorId === String(input.doctorId));
		const paymentAmount = Number(orderItem.servicePrice);
		if (paymentAmount === 0 && input.paymentProvider === PaymentProvider.EXIMBAY) throw new BadRequestException('No online charge is needed. Choose cash confirmation for a zero-price booking');
		if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
			throw new BadRequestException('Booking order contains an invalid payment amount');
		}

		try {
		return await this.paymentModel.create({
			testPayment: input.paymentProvider === PaymentProvider.EXIMBAY && this.eximbayService.getTestMode() === 'SIMULATED',
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
		} catch (error) {
			if (error?.code !== 11000) throw error;
			const winner = await this.paymentModel.findOne({ patientId, bookingOrderId: order._id, serviceId: input.serviceId,
				doctorId: input.doctorId, paymentStatus: { $in: [PaymentStatus.PENDING, PaymentStatus.PAID] } }).exec();
			if (winner && (winner.paymentStatus === PaymentStatus.PAID || winner.paymentProvider === input.paymentProvider)) return winner;
			throw new BadRequestException('Another payment method is already pending');
		}
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
		if (payment.paymentProvider === PaymentProvider.EXIMBAY && paymentStatus === PaymentStatus.PAID) throw new BadRequestException('Online payment requires gateway confirmation');

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
		payment.activeIntent = [PaymentStatus.PENDING, PaymentStatus.PAID].includes(paymentStatus);
		if (paymentStatus === PaymentStatus.PAID) payment.paidAt = new Date();
		if (paymentStatus === PaymentStatus.REFUNDED) payment.refundedAt = new Date();
		const result = await payment.save();
		await this.notifyPaymentStatus(result, paymentStatus, memberId, memberType);

		if (paymentStatus === PaymentStatus.PAID) {
			await this.confirmBookingOrderIfAllPaymentsPaid(payment.bookingOrderId);
			await this.appointmentService?.settlePaymentReservation(result);
		}

		return result;
	}

	public async settleTestPayment(payment: Payment, outcome: PaymentStatus): Promise<Payment> {
		const result = await this.paymentModel.findOneAndUpdate({ _id: payment._id, patientId: payment.patientId, testPayment: true, paymentStatus: PaymentStatus.PENDING },
			{ $set: { paymentStatus: outcome, activeIntent: outcome === PaymentStatus.PAID, ...(outcome === PaymentStatus.PAID ? { paidAt: new Date(), gatewayTransactionId: `TEST-${payment._id}` } : {}) } }, { new: true }).exec();
		if (!result) throw new BadRequestException('The test payment was already completed');
		if (outcome === PaymentStatus.PAID) {
			await this.confirmBookingOrderIfAllPaymentsPaid(payment.bookingOrderId);
			await this.appointmentService.settlePaymentReservation(result);
		} else {
			await this.appointmentService.cancelPaymentReservation(result);
		}
		await this.notifyPaymentStatus(result, outcome);
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
			const confirmedOrder = await this.bookingOrderModel
				.findOneAndUpdate(
					{ _id: order._id, bookingOrderStatus: BookingOrderStatus.PENDING },
					{ $set: { bookingOrderStatus: BookingOrderStatus.CONFIRMED, confirmedAt: new Date() } },
				)
				.exec();
			if (confirmedOrder) {
				await this.notificationEvents.toPatient(order.patientId, {
					key: `booking-order:${order._id}:confirmed`,
					type: NotificationType.SYSTEM,
					group: NotificationGroup.BOOKING_ORDER,
					title: 'Booking order confirmed',
					description: 'Your booking order is confirmed and ready for appointment scheduling.',
					refId: order._id,
				});
			}
		}
	}

	private async notifyPaymentStatus(
		payment: Payment,
		status: PaymentStatus,
		authorId?: ObjectId,
		authorType?: MemberType,
	): Promise<void> {
		await this.notificationEvents.toPatient(payment.patientId, {
			key: `payment:${payment._id}:${status}`,
			type: NotificationType.PAYMENT,
			group: NotificationGroup.PAYMENT,
			title: 'Payment status updated',
			description: `Your payment status is now ${status.toLowerCase()}.`,
			refId: payment._id,
			authorId,
			authorType,
		});
	}

	public async verifyEximbayPayment(paymentId: ObjectId, rawData: string): Promise<{ firstTime: boolean }> {
		const payment = await this.paymentModel.findById(paymentId).lean().exec();
		if (!payment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		if (payment.paymentProvider !== PaymentProvider.EXIMBAY)
			throw new BadRequestException('Payment provider must be EXIMBAY');

		if (payment.testPayment) throw new BadRequestException('A simulated payment cannot receive a gateway callback');
		const callback = new URLSearchParams(rawData);
		await this.eximbayService.verify(rawData);
		if (callback.get('rescode') && callback.get('rescode') !== '0000') {
			if (callback.get('order_id') !== payment.providerPaymentId || callback.get('currency') !== payment.paymentCurrency
				|| Number(callback.get('amount')) !== payment.paymentAmount) throw new BadRequestException('Eximbay callback does not match the payment');
			const failed = await this.paymentModel.findOneAndUpdate({ _id: payment._id, paymentStatus: PaymentStatus.PENDING },
				{ $set: { paymentStatus: PaymentStatus.FAILED, activeIntent: false } }, { new: true }).exec();
			if (failed) { await this.appointmentService?.cancelPaymentReservation(failed); await this.notifyPaymentStatus(failed, PaymentStatus.FAILED); }
			return { firstTime: Boolean(failed) };
		}
		const transactionId = callback.get('transaction_id');
		if (!transactionId) throw new BadRequestException('Eximbay transaction_id is missing');
		const retrieved = await this.eximbayService.retrieve({
			providerPaymentId: payment.providerPaymentId,
			currency: payment.paymentCurrency,
			amount: payment.paymentAmount,
			transactionId,
		});

		const paidAmount = Number(retrieved.payment?.amount);
		if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - payment.paymentAmount) > 0.001) {
			throw new BadRequestException(
				`Eximbay amount mismatch: expected ${payment.paymentAmount}, received ${retrieved.payment?.amount ?? '0'}`,
			);
		}
		if (retrieved.payment?.order_id !== payment.providerPaymentId) {
			throw new BadRequestException('Eximbay order_id does not match the payment');
		}

		if (retrieved.payment?.currency !== payment.paymentCurrency || retrieved.payment?.transaction_id !== transactionId) throw new BadRequestException('Eximbay transaction or currency does not match the payment');
		if (retrieved.payment?.status !== 'SALE') throw new BadRequestException('Eximbay payment has not completed');
		const order = await this.bookingOrderModel.findById(payment.bookingOrderId).lean().exec();
		if (!order || order.bookingOrderStatus === BookingOrderStatus.CANCELLED) throw new BadRequestException('Booking is unavailable for payment');

		const updated = await this.paymentModel
			.findOneAndUpdate(
				{ _id: payment._id, paymentStatus: PaymentStatus.PENDING },
				{ $set: { paymentStatus: PaymentStatus.PAID, gatewayTransactionId: transactionId, paidAt: new Date() } },
				{ new: true },
			)
			.exec();

		if (updated) {
			await this.notifyPaymentStatus(updated, PaymentStatus.PAID);
			await this.confirmBookingOrderIfAllPaymentsPaid(payment.bookingOrderId);
			await this.appointmentService?.settlePaymentReservation(updated);
		}
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
		if (this.eximbayService.getTestMode() !== 'SANDBOX') throw new BadRequestException('Eximbay sandbox is not enabled');
		const patientId = await this.patientService.resolveProfileId(memberId);
		const payment = await this.paymentModel.findOne({ _id: paymentId, patientId }).lean().exec();
		if (!payment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		if (payment.paymentProvider !== PaymentProvider.EXIMBAY)
			throw new BadRequestException('Payment provider must be EXIMBAY');
		if (payment.paymentStatus !== PaymentStatus.PENDING) throw new BadRequestException('Payment is no longer pending');

		const order = await this.bookingOrderModel.findOne({ _id: payment.bookingOrderId, patientId }).lean().exec();
		if (!order || order.bookingOrderStatus === BookingOrderStatus.CANCELLED) {
			throw new BadRequestException('Booking order is not available for payment');
		}

		if (payment.testPayment) throw new BadRequestException('A simulated payment cannot open the gateway');
		await this.appointmentService.assertPaymentReservation(payment);
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

	public async getStaffPayments(memberType: MemberType, input: PaymentInquiry): Promise<Payments> {
		if (![MemberType.ADMIN, MemberType.RECEPTIONIST].includes(memberType))
			throw new InternalServerErrorException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
		const match: Record<string, unknown> = input.status ? { paymentStatus: input.status } : {};
		const limit = Math.min(input.limit, 100);
		const result = await this.paymentModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1, _id: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * limit }, { $limit: limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getDoctorBookingRequests(doctorId: ObjectId, input: BookingOrderInquiry): Promise<DoctorBookingRequests> {
		const match: Record<string, unknown> = { 'bookingOrderItems.doctorId': doctorId.toString() };
		if (input.status) match.bookingOrderStatus = input.status;
		const result = await this.bookingOrderModel.aggregate([
			{ $match: match },
			{ $unwind: '$bookingOrderItems' },
			{ $match: { 'bookingOrderItems.doctorId': doctorId.toString() } },
			{ $sort: { createdAt: -1, _id: -1, 'bookingOrderItems.serviceId': 1 } },
			{ $project: {
				_id: { $concat: [{ $toString: '$_id' }, ':', '$bookingOrderItems.serviceId'] },
				bookingOrderId: { $toString: '$_id' },
				orderCode: 1,
				bookingOrderStatus: 1,
				serviceId: '$bookingOrderItems.serviceId',
				serviceName: '$bookingOrderItems.serviceName',
				serviceDuration: '$bookingOrderItems.serviceDuration',
				requestedStartAt: '$bookingOrderItems.requestedStartAt',
				appointmentId: '$bookingOrderItems.appointmentId',
			} },
			{ $facet: {
				list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
				metaCounter: [{ $count: 'total' }],
			} },
		]).exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getStaffBookingOrders(memberType: MemberType, input: StaffBookingOrderInquiry): Promise<BookingOrders> {
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
