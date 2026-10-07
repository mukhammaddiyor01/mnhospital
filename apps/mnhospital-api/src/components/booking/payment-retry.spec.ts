import { Types } from 'mongoose';
import { BookingService } from './booking.service';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '../patient/enums/patient.enum';
describe('Patient payment retry ownership', () => {
	const patientId = new Types.ObjectId(),
		memberId = new Types.ObjectId();
	const input = {
		bookingOrderId: new Types.ObjectId(),
		serviceId: new Types.ObjectId(),
		doctorId: new Types.ObjectId(),
		idempotencyKey: 'retry-owned-payment',
		paymentProvider: PaymentProvider.CASH,
		paymentMethod: PaymentMethod.CASH,
	};
	const order = {
		_id: input.bookingOrderId,
		bookingOrderCurrency: 'UZS',
		bookingOrderItems: [{ serviceId: String(input.serviceId), doctorId: String(input.doctorId), servicePrice: 150 }],
	};
	const findOne = jest.fn();
	const create = jest.fn();
	const orderFind = jest.fn(() => ({ lean: () => ({ exec: async () => order }) }));
	const service = new BookingService(
		{} as never,
		{} as never,
		{} as never,
		{ findOne: orderFind } as never,
		{ findOne, create } as never,
		{} as never,
		{ resolveProfileId: async () => patientId } as never,
		{} as never,
		{} as never,
	);
	beforeEach(() => jest.clearAllMocks());
	it('reuses the same owned payment intent on retry', async () => {
		const payment = { ...input, patientId };
		findOne.mockReturnValueOnce({ exec: async () => payment });
		expect(await service.createPayment(memberId, input)).toBe(payment);
		expect(create).not.toHaveBeenCalled();
	});
	it('rejects an idempotency key owned by another patient or provider', async () => {
		for (const patch of [{ patientId: new Types.ObjectId() }, { paymentProvider: PaymentProvider.EXIMBAY }]) {
			findOne.mockReturnValueOnce({ exec: async () => ({ ...input, patientId, ...patch }) });
			await expect(service.createPayment(memberId, input)).rejects.toThrow('idempotency key');
		}
		expect(create).not.toHaveBeenCalled();
	});
	it('returns a paid booking line instead of creating another charge', async () => {
		const paid = { _id: new Types.ObjectId(), paymentStatus: PaymentStatus.PAID };
		findOne.mockReturnValueOnce({ exec: async () => null }).mockReturnValueOnce({ exec: async () => paid });
		expect(await service.createPayment(memberId, input)).toBe(paid);
		expect(findOne).toHaveBeenLastCalledWith(
			expect.objectContaining({ patientId, bookingOrderId: input.bookingOrderId, paymentStatus: PaymentStatus.PAID }),
		);
		expect(create).not.toHaveBeenCalled();
	});
	it('uses the owned booking snapshot for amount and currency', async () => {
		findOne.mockReturnValue({ exec: async () => null });
		create.mockResolvedValue({});
		await service.createPayment(memberId, input);
		expect(orderFind).toHaveBeenCalledWith(expect.objectContaining({ patientId }));
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId,
				paymentAmount: 150,
				paymentCurrency: 'UZS',
				paymentStatus: PaymentStatus.PENDING,
			}),
		);
	});
});
