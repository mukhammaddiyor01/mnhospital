import 'reflect-metadata';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomResolver } from './room.resolver';
import { RoomService } from './room.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { AppointmentService } from './appointment.service';
import { RoomStatus } from '../../libs/enums/appointment.enum';

describe('Room and appointment workspace access', () => {
	it('restricts room writes to admin and allows authenticated room selection', () => {
		for (const method of ['createRoom', 'updateRoom']) {
			expect(Reflect.getMetadata('roles', RoomResolver.prototype[method])).toEqual([MemberType.ADMIN]);
			expect(Reflect.getMetadata('__guards__', RoomResolver.prototype[method])).toContain(RolesGuard);
		}
		expect(Reflect.getMetadata('roles', RoomResolver.prototype.getRooms)).toContain(MemberType.PATIENT);
	});
	it('returns safe duplicate and missing room errors', async () => {
		const service = new RoomService({
			create: jest.fn().mockRejectedValue({ code: 11000 }),
			findOneAndUpdate: () => ({ exec: async () => null }),
		} as never);
		await expect(service.createRoom({} as never)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.updateRoom(new Types.ObjectId(), {} as never)).rejects.toBeInstanceOf(NotFoundException);
	});
	it('rejects unavailable rooms before creating or linking an appointment', async () => {
		const doctorId = new Types.ObjectId(),
			serviceId = new Types.ObjectId(),
			roomId = new Types.ObjectId();
		const startsAt = new Date('2026-12-01T09:00:00Z'),
			endsAt = new Date('2026-12-01T09:30:00Z');
		const create = jest.fn();
		const roomFind = jest.fn(() => ({ lean: () => ({ exec: async () => null }) }));
		const service = new AppointmentService(
			{ create } as never,
			{
				findOne: () => ({
					exec: async () => ({
						bookingOrderItems: [
							{
								doctorId: String(doctorId),
								serviceId: String(serviceId),
								requestedStartAt: startsAt,
								serviceDuration: '30',
							},
						],
					}),
				}),
			} as never,
			{} as never,
			{ resolveProfileId: async () => new Types.ObjectId() } as never,
			{} as never,
			{ findOne: roomFind } as never,
		);
		await expect(
			service.createAppointment(new Types.ObjectId(), {
				doctorId,
				serviceId,
				roomId,
				bookingOrderId: new Types.ObjectId(),
				startsAt,
				endsAt,
			} as never),
		).rejects.toThrow('selected room is not available');
		expect(roomFind).toHaveBeenCalledWith({ _id: roomId, roomStatus: RoomStatus.AVAILABLE });
		expect(create).not.toHaveBeenCalled();
	});
	it('scopes receptionist appointment reads to active assigned task references', async () => {
		const receptionistId = new Types.ObjectId(),
			appointmentId = new Types.ObjectId();
		const aggregate = jest.fn((_pipeline: any) => ({ exec: async () => [{ list: [], metaCounter: [] }] }));
		const tasks = jest.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => [{ appointmentId }] }) }) }));
		const service = new AppointmentService(
			{ aggregate } as never,
			{} as never,
			{ find: tasks } as never,
			{} as never,
			{} as never,
			{} as never,
		);
		await service.getStaffAppointments(receptionistId, MemberType.RECEPTIONIST, { page: 1, limit: 10 });
		expect(tasks).toHaveBeenCalledWith(expect.objectContaining({ receptionistId }));
		expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: { _id: { $in: [appointmentId] } } });
	});
});
