import { Types } from 'mongoose';
import { MemberType } from '../member/enums/member.enum';
import { BookingOrderStatus, CartStatus, PaymentProvider, PaymentStatus } from '../patient/enums/patient.enum';
import { BookingService } from './booking.service';

describe('Booking and payment notification triggers', () => {
	const memberId = new Types.ObjectId();
	const patientId = new Types.ObjectId();
	const orderId = new Types.ObjectId();
	const paymentId = new Types.ObjectId();
	const serviceId = new Types.ObjectId();
	const doctorId = new Types.ObjectId();
	const cartId = new Types.ObjectId();
	const cartModel = { findOne: jest.fn(), findByIdAndUpdate: jest.fn() };
	const cartItemModel = { find: jest.fn() };
	const bookingOrderModel = { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn(), deleteOne: jest.fn() };
	const paymentModel = { findById: jest.fn(), find: jest.fn(), findOneAndUpdate: jest.fn() };
	const patientService = { resolveProfileId: jest.fn() };
	const eximbayService = { verify: jest.fn(), retrieve: jest.fn() };
	const notificationEvents = { toPatient: jest.fn(), toDoctor: jest.fn() };
	const service = new BookingService(
		cartModel as never, cartItemModel as never, {} as never, bookingOrderModel as never,
		paymentModel as never, {} as never, patientService as never, eximbayService as never, notificationEvents as never,
	);

	beforeEach(() => {
		jest.clearAllMocks();
		patientService.resolveProfileId.mockResolvedValue(patientId);
	});

	it('notifies after checkout succeeds', async () => {
		cartModel.findOne.mockReturnValue({ exec: async () => ({ _id: cartId, currency: 'KRW', subtotalAmount: 100, discountAmount: 0, totalAmount: 100 }) });
		cartItemModel.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: async () => [{
			serviceId, doctorId, serviceName: 'Consultation', servicePrice: 100, serviceDuration: 30,
			requestedStartAt: new Date('2026-11-01T09:00:00.000Z'),
		}] }) }) });
		bookingOrderModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		bookingOrderModel.create.mockResolvedValue({ _id: orderId, patientId });
		cartModel.findByIdAndUpdate.mockReturnValue({ exec: async () => ({ cartStatus: CartStatus.CHECKED_OUT }) });
		await service.createBookingOrder(memberId);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `booking-order:${orderId}:created` }));
		expect(notificationEvents.toDoctor).toHaveBeenCalledWith(doctorId, expect.objectContaining({ key: `booking-order:${orderId}:created`, group: 'BOOKING_ORDER' }));
	});

	it('notifies the patient after an owned order is cancelled', async () => {
		bookingOrderModel.findOneAndUpdate.mockReturnValue({ exec: async () => ({ _id: orderId, patientId }) });
		await service.cancelBookingOrder(memberId, orderId);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `booking-order:${orderId}:cancelled` }));
	});

	it('notifies each involved doctor once for a multi-doctor booking', async () => {
		const otherDoctorId = new Types.ObjectId();
		cartModel.findOne.mockReturnValue({ exec: async () => ({ _id: cartId, currency: 'KRW', subtotalAmount: 300, discountAmount: 0, totalAmount: 300 }) });
		cartItemModel.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: async () => [doctorId, doctorId, otherDoctorId].map((owner) => ({
			serviceId: new Types.ObjectId(), doctorId: owner, serviceName: 'Consultation', servicePrice: 100, serviceDuration: 30,
			requestedStartAt: new Date('2026-11-01T09:00:00.000Z'),
		})) }) }) });
		bookingOrderModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		bookingOrderModel.create.mockResolvedValue({ _id: orderId, patientId });
		cartModel.findByIdAndUpdate.mockReturnValue({ exec: async () => ({ cartStatus: CartStatus.CHECKED_OUT }) });
		await service.createBookingOrder(memberId);
		expect(notificationEvents.toDoctor).toHaveBeenCalledTimes(2);
		expect(notificationEvents.toDoctor.mock.calls.map(([id]) => String(id)).sort()).toEqual([String(doctorId), String(otherDoctorId)].sort());
	});

	it('does not notify staff when checkout persistence fails', async () => {
		cartModel.findOne.mockReturnValue({ exec: async () => ({ _id: cartId, currency: 'KRW', subtotalAmount: 100, discountAmount: 0, totalAmount: 100 }) });
		cartItemModel.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: async () => [{
			serviceId, doctorId, serviceName: 'Consultation', servicePrice: 100, serviceDuration: 30,
			requestedStartAt: new Date('2026-11-01T09:00:00.000Z'),
		}] }) }) });
		bookingOrderModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		bookingOrderModel.create.mockResolvedValue({ _id: orderId, patientId });
		cartModel.findByIdAndUpdate.mockReturnValueOnce({ exec: async () => { throw new Error('Checkout failed'); } });
		bookingOrderModel.deleteOne.mockReturnValue({ exec: async () => ({ deletedCount: 1 }) });
		await expect(service.createBookingOrder(memberId)).rejects.toThrow('Checkout failed');
		expect(notificationEvents.toDoctor).not.toHaveBeenCalled();
		expect(notificationEvents.toPatient).not.toHaveBeenCalled();
	});

	it('notifies for a paid payment and an order confirmed after all lines are paid', async () => {
		const payment = { _id: paymentId, patientId, bookingOrderId: orderId, paymentStatus: PaymentStatus.PENDING, save: jest.fn() };
		payment.save.mockResolvedValue(payment);
		paymentModel.findById.mockReturnValue({ exec: async () => payment });
		bookingOrderModel.findById.mockReturnValue({ exec: async () => ({
			_id: orderId, patientId, bookingOrderStatus: BookingOrderStatus.PENDING,
			bookingOrderItems: [{ serviceId: String(serviceId), doctorId: String(doctorId) }],
		}) });
		paymentModel.find.mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => [{ serviceId, doctorId }] }) }) });
		bookingOrderModel.findOneAndUpdate.mockReturnValue({ exec: async () => ({ _id: orderId }) });
		await service.updatePaymentStatus(memberId, MemberType.RECEPTIONIST, paymentId, PaymentStatus.PAID);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `payment:${paymentId}:PAID` }));
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `booking-order:${orderId}:confirmed` }));
	});

	it('notifies for an Eximbay callback only when it changes a pending payment', async () => {
		const payment = {
			_id: paymentId, patientId, bookingOrderId: orderId, paymentProvider: PaymentProvider.EXIMBAY,
			providerPaymentId: 'PAY-123', paymentCurrency: 'KRW', paymentAmount: 100,
		};
		paymentModel.findById.mockReturnValue({ lean: () => ({ exec: async () => payment }) });
		eximbayService.verify.mockResolvedValue(undefined);
		eximbayService.retrieve.mockResolvedValue({ payment: { amount: '100', order_id: 'PAY-123' } });
		bookingOrderModel.findById.mockReturnValue({ exec: async () => null });
		bookingOrderModel.findOneAndUpdate.mockReturnValue({ exec: async () => null });
		paymentModel.findOneAndUpdate
			.mockReturnValueOnce({ exec: async () => ({ ...payment, paymentStatus: PaymentStatus.PAID }) })
			.mockReturnValueOnce({ exec: async () => null });
		await service.verifyEximbayPayment(paymentId, 'transaction_id=TX-123');
		await service.verifyEximbayPayment(paymentId, 'transaction_id=TX-123');
		expect(notificationEvents.toPatient).toHaveBeenCalledTimes(1);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `payment:${paymentId}:PAID` }));
	});
});
