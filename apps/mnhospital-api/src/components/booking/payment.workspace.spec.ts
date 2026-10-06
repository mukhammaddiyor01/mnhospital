import 'reflect-metadata';
import { BookingService } from './booking.service';
import { BookingResolver } from './booking.resolver';
import { MemberType } from '../member/enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentStatus } from '../patient/enums/patient.enum';
describe('Staff payment workspace', () => {
	const aggregate = jest.fn((_pipeline: any) => ({ exec: async () => [{ list: [], metaCounter: [] }] }));
	const service = new BookingService(
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{ aggregate } as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
	);
	beforeEach(() => jest.clearAllMocks());
	it('rejects patient and doctor staff-list access before querying', async () => {
		for (const role of [MemberType.PATIENT, MemberType.DOCTOR])
			await expect(service.getStaffPayments(role, { page: 1, limit: 10 })).rejects.toThrow();
		expect(aggregate).not.toHaveBeenCalled();
	});
	it('filters payment status and bounds page size', async () => {
		await service.getStaffPayments(MemberType.ADMIN, { page: 2, limit: 1000, status: PaymentStatus.PENDING });
		expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: { paymentStatus: PaymentStatus.PENDING } });
		expect(aggregate.mock.calls[0][0][2].$facet.list).toEqual([{ $skip: 100 }, { $limit: 100 }]);
	});
	it('requires admin or reception at GraphQL boundary', () => {
		expect(Reflect.getMetadata('roles', BookingResolver.prototype.getPayments)).toEqual([
			MemberType.RECEPTIONIST,
			MemberType.ADMIN,
		]);
		expect(Reflect.getMetadata('__guards__', BookingResolver.prototype.getPayments)).toContain(RolesGuard);
	});
});
