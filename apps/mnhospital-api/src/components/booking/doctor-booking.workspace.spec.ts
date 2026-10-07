import 'reflect-metadata';
import { Types } from 'mongoose';
import { BookingService } from './booking.service';
import { BookingResolver } from './booking.resolver';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { BookingOrderStatus } from '../patient/enums/patient.enum';

describe('Doctor booking request ownership', () => {
	const doctorId = new Types.ObjectId();
	const aggregate = jest.fn();
	const service = new BookingService({} as never, {} as never, {} as never,
		{ aggregate } as never, {} as never, {} as never, {} as never, {} as never, {} as never);
	beforeEach(() => {
		aggregate.mockReset();
		aggregate.mockReturnValue({ exec: async () => [{ list: [], metaCounter: [] }] });
	});

	it('allows only doctors and derives ownership from the authenticated profile', async () => {
		expect(Reflect.getMetadata('roles', BookingResolver.prototype.getMyDoctorBookingRequests)).toEqual([MemberType.DOCTOR]);
		expect(Reflect.getMetadata('__guards__', BookingResolver.prototype.getMyDoctorBookingRequests)).toContain(RolesGuard);
		const query = jest.fn().mockResolvedValue({ list: [], metaCounter: [] });
		const resolver = new BookingResolver({ getDoctorBookingRequests: query } as never);
		const input = { page: 1, limit: 10 };
		await resolver.getMyDoctorBookingRequests(input, doctorId);
		expect(query).toHaveBeenCalledWith(doctorId, input);
	});

	it('filters the matching line again after unwinding a multi-doctor order', async () => {
		await service.getDoctorBookingRequests(doctorId, { page: 2, limit: 5, status: BookingOrderStatus.CONFIRMED });
		const pipeline = aggregate.mock.calls[0][0];
		expect(pipeline[0].$match).toEqual({ 'bookingOrderItems.doctorId': String(doctorId), bookingOrderStatus: BookingOrderStatus.CONFIRMED });
		expect(pipeline[1].$unwind).toBe('$bookingOrderItems');
		expect(pipeline[2].$match).toEqual({ 'bookingOrderItems.doctorId': String(doctorId) });
		expect(pipeline.at(-1).$facet.list).toEqual([{ $skip: 5 }, { $limit: 5 }]);
	});

	it('projects scheduling fields without full order finances or other service lines', async () => {
		await service.getDoctorBookingRequests(doctorId, { page: 1, limit: 10 });
		const projection = aggregate.mock.calls[0][0].find((stage) => stage.$project).$project;
		expect(Object.keys(projection).sort()).toEqual(['_id', 'appointmentId', 'bookingOrderId', 'bookingOrderStatus', 'orderCode', 'requestedStartAt', 'serviceDuration', 'serviceId', 'serviceName'].sort());
		expect(projection._id.$concat).toContain('$bookingOrderItems.serviceId');
	});

	it('returns an empty list for a doctor without booking requests', async () => {
		aggregate.mockReturnValue({ exec: async () => [] });
		await expect(service.getDoctorBookingRequests(doctorId, { page: 1, limit: 10 })).resolves.toEqual({ list: [], metaCounter: [] });
	});
});
