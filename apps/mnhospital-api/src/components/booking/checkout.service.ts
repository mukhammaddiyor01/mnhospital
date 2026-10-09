import { discountedServicePrice } from './pricing.policy';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { BookingService } from './booking.service';
import { EximbayService } from './eximbay.service';
import { AppointmentService } from '../appointment/appointment.service';
import { DoctorScheduleService } from '../doctor/doctor-schedule/doctorSchedule.service';
import { PatientService } from '../patient/patient.service';
import { BookingOrder } from './dto/booking-order';
import { Cart } from './dto/cart';
import { Service } from '../service/dto/service';
import { Payment } from './dto/payment';
import { Appointment } from '../appointment/dto/appointment';
import { AppointmentBookingInput, BookingCheckout, BookingCheckoutInput, BookingPaymentOptions } from './dto/checkout';
import { BookingOrderStatus, CartStatus, PaymentMethod, PaymentProvider, PaymentStatus } from '../patient/enums/patient.enum';
import { ServiceStatus } from '../service/enums/service.enum';
import { clinicDate, clinicTimeZone, clinicCurrency } from '../../libs/booking/clinic-time';
import { NotificationEventService } from '../notification/notification-event.service';
import { NotificationGroup, NotificationType } from '../notification/enums/notification.enum';

@Injectable()
export class CheckoutService {
	constructor(
		private readonly booking: BookingService,
		private readonly eximbay: EximbayService,
		private readonly appointments: AppointmentService,
		private readonly schedules: DoctorScheduleService,
		private readonly patients: PatientService,
		private readonly notifications: NotificationEventService,
		@InjectModel('BookingOrder') private readonly orders: Model<BookingOrder>,
		@InjectModel('Cart') private readonly carts: Model<Cart>,
		@InjectModel('Service') private readonly services: Model<Service>,
		@InjectModel('Payment') private readonly payments: Model<Payment>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
	) {}

	getOptions(): BookingPaymentOptions {
		const currency = clinicCurrency();
		const mode = this.eximbay.getTestMode();
		return { onlineMode: mode === 'SANDBOX' && currency === 'UZS' ? 'DISABLED' : mode, timeZone: clinicTimeZone(), currency };
	}

	async createBooking(memberId: Types.ObjectId, input: AppointmentBookingInput): Promise<BookingOrder> {
		const patientId = await this.patients.resolveProfileId(memberId);
		const existing = await this.orders.findOne({ patientId, checkoutKey: input.idempotencyKey }).exec();
		if (existing) return this.matchRetry(existing, input);
		const slots = await this.schedules.getAvailableSlots({ serviceId: input.serviceId, doctorId: input.doctorId, date: clinicDate(input.requestedStartAt) });
		if (!slots.some((slot) => slot.startsAt.getTime() === input.requestedStartAt.getTime())) throw new BadRequestException('Choose an available appointment time');
		const service = await this.services.findOne({ _id: input.serviceId, memberId: input.doctorId, serviceStatus: ServiceStatus.ACTIVE, deletedAt: { $exists: false } }).lean().exec();
		if (!service || !Number.isFinite(service.servicePrice) || service.servicePrice < 0) throw new BadRequestException('Service is unavailable');
		const price = discountedServicePrice(service.servicePrice, service.serviceDiscountPercent ?? 0, clinicCurrency());
		// A direct booking has its own checked-out cart; it never consumes an unrelated active patient cart.
		const cart = await this.carts.create({ patientId, cartStatus: CartStatus.CHECKED_OUT, currency: clinicCurrency(), subtotalAmount: price.base, discountAmount: price.discount, totalAmount: price.total });
		let order: BookingOrder;
		try {
			order = await this.orders.create({ patientId, cartId: cart._id, checkoutKey: input.idempotencyKey,
				pricingVersion: 1, pricingRevision: 0, serviceDiscountAmount: price.discount, promoDiscountAmount: 0,
				orderCode: `BO-${uuid()}`, bookingOrderStatus: BookingOrderStatus.PENDING, bookingOrderCurrency: clinicCurrency(),
				bookingOrderItems: [{ serviceId: String(service._id), doctorId: String(service.memberId), serviceName: service.serviceTitle || service.serviceName,
					serviceBasePrice: price.base, serviceDiscountAmount: price.discount, promoDiscountAmount: 0, servicePrice: String(price.total), serviceDuration: String(service.serviceDuration), requestedStartAt: input.requestedStartAt.toISOString(), patientNote: input.patientNote }],
				bookingOrderSubtotalAmount: price.base, bookingOrderDiscountAmount: price.discount, bookingOrderTotalAmount: price.total });
		} catch (error) {
			await this.carts.deleteOne({ _id: cart._id, patientId }).exec();
			if (error?.code === 11000) {
				const winner = await this.orders.findOne({ patientId, checkoutKey: input.idempotencyKey }).exec();
				if (winner) return this.matchRetry(winner, input);
			}
			throw error;
		}
		const event = { key: `booking-order:${order._id}:created`, type: NotificationType.SYSTEM, group: NotificationGroup.BOOKING_ORDER,
			title: 'Booking request received', description: 'A booking request is awaiting checkout.', refId: order._id };
		await this.notifications.toPatient(patientId, event);
		await this.notifications.toDoctor(input.doctorId, event);
		return order;
	}

	private matchRetry(order: BookingOrder, input: AppointmentBookingInput): BookingOrder {
		const line = order.bookingOrderItems[0];
		if (order.bookingOrderItems.length !== 1 || line.serviceId !== String(input.serviceId) || line.doctorId !== String(input.doctorId)
			|| new Date(line.requestedStartAt).getTime() !== input.requestedStartAt.getTime() || (line.patientNote || '') !== (input.patientNote || '')) {
			throw new BadRequestException('The checkout key belongs to another booking');
		}
		return order;
	}

	async getCheckout(memberId: Types.ObjectId, orderId: Types.ObjectId): Promise<BookingCheckout> {
		const order = await this.booking.getMyBookingOrder(memberId, orderId);
		const [payments, appointments] = await Promise.all([
			this.payments.find({ bookingOrderId: order._id, patientId: order.patientId }).sort({ createdAt: -1 }).exec(),
			this.appointmentModel.find({ bookingOrderId: order._id, patientId: order.patientId }).exec(),
		]);
		return { order, payments, appointments };
	}

	async choosePayment(memberId: Types.ObjectId, input: BookingCheckoutInput): Promise<BookingCheckout> {
		if (![PaymentProvider.CASH, PaymentProvider.EXIMBAY].includes(input.paymentProvider)) throw new BadRequestException('Choose cash or Eximbay test payment');
		if (input.paymentProvider === PaymentProvider.EXIMBAY && this.eximbay.getTestMode() === 'DISABLED') throw new BadRequestException('Online test payment is not configured');
		const order = await this.booking.getMyBookingOrder(memberId, new Types.ObjectId(input.bookingOrderId));
		if (![BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED].includes(order.bookingOrderStatus)) throw new BadRequestException('Booking is unavailable for checkout');
		if (input.paymentProvider === PaymentProvider.EXIMBAY && this.eximbay.getTestMode() === 'SANDBOX' && order.bookingOrderCurrency === 'UZS') {
			throw new BadRequestException('This booking uses UZS. Choose cash or create a new KRW booking.');
		}
		if (input.paymentProvider === PaymentProvider.EXIMBAY && order.bookingOrderItems.some(line => Number(line.servicePrice) === 0)) {
			throw new BadRequestException('Choose cash confirmation for a booking containing a zero-price service');
		}
		for (const line of order.bookingOrderItems) {
			const payment = await this.booking.createPayment(memberId, {
				bookingOrderId: order._id, serviceId: new Types.ObjectId(line.serviceId), doctorId: new Types.ObjectId(line.doctorId),
				paymentProvider: input.paymentProvider, paymentMethod: input.paymentProvider === PaymentProvider.CASH ? PaymentMethod.CASH : PaymentMethod.CARD,
				idempotencyKey: uuid(),
			});
			if (![PaymentStatus.PENDING, PaymentStatus.PAID].includes(payment.paymentStatus)) throw new BadRequestException('This payment attempt has ended. Create a new booking.');
			await this.appointments.scheduleBookingLine(memberId, order, line.serviceId, line.doctorId, input.paymentProvider === PaymentProvider.EXIMBAY);
			if (payment.paymentProvider === PaymentProvider.CASH || payment.paymentStatus === PaymentStatus.PAID) await this.appointments.settlePaymentReservation(payment);
		}
		return this.getCheckout(memberId, order._id);
	}

	async completeTestPayment(memberId: Types.ObjectId, paymentId: Types.ObjectId, outcome: string): Promise<Payment> {
		if (this.eximbay.getTestMode() !== 'SIMULATED') throw new BadRequestException('Local test payment is disabled');
		if (!['PAID', 'FAILED', 'CANCELLED'].includes(outcome)) throw new BadRequestException('Invalid test payment outcome');
		const payment = await this.booking.getMyPayment(memberId, paymentId);
		if (payment.paymentProvider !== PaymentProvider.EXIMBAY || !payment.testPayment) throw new BadRequestException('This is not a local test payment');
		if (payment.paymentStatus === outcome) return payment;
		if (payment.paymentStatus !== PaymentStatus.PENDING) throw new BadRequestException('This payment attempt has ended');
		const order = await this.booking.getMyBookingOrder(memberId, payment.bookingOrderId);
		if (order.bookingOrderStatus === BookingOrderStatus.CANCELLED) throw new BadRequestException('Booking was cancelled');
		const reservation = await this.appointmentModel.findOne({ bookingOrderId: order._id, serviceId: payment.serviceId, doctorId: payment.doctorId,
			patientId: payment.patientId, appointmentStatus: 'PENDING', holdExpiresAt: { $gt: new Date() } }).exec();
		if (!reservation) throw new NotFoundException('The payment reservation expired. Choose a new appointment.');
		return this.booking.settleTestPayment(payment, outcome as PaymentStatus);
	}
}
