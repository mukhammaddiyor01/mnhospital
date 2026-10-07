import 'reflect-metadata';
import { Types } from 'mongoose';
import { DoctorService } from './doctor.service';
import { DoctorResolver } from './doctor.resolver';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType, MemberStatus } from '../member/enums/member.enum';
import { RoomStatus } from '../../libs/enums/appointment.enum';

describe('Doctor room allocation', () => {
	const roomId = new Types.ObjectId();
	const exec = (value: unknown) => ({ exec: async () => value });
	let doctors: any, rooms: any, auth: any, service: DoctorService;
	const input = { docNick: 'new-doctor', docPassword: 'Password123', docRoom: ' 201 ' };
	beforeEach(() => {
		doctors = {
			findOne: jest.fn().mockReturnValue(exec(null)),
			distinct: jest.fn().mockReturnValue(exec(['101'])),
			create: jest.fn().mockImplementation(async (record) => record),
			findOneAndUpdate: jest.fn(),
		};
		rooms = {
			findOneAndUpdate: jest.fn().mockReturnValue(exec({ _id: roomId })),
			updateOne: jest.fn().mockReturnValue(exec({})),
			find: jest.fn(),
		};
		auth = {
			hashPassword: jest.fn().mockResolvedValue('hash'),
			revokeOwnerSessions: jest.fn().mockResolvedValue(undefined),
			createToken: jest.fn().mockResolvedValue('token'),
		};
		service = new DoctorService(doctors, null, null, null, null, null, auth, null, rooms);
	});
	it('only allows admin to request room choices', () => {
		expect(Reflect.getMetadata('roles', DoctorResolver.prototype.getAvailableDoctorRooms)).toEqual([MemberType.ADMIN]);
		expect(Reflect.getMetadata('__guards__', DoctorResolver.prototype.getAvailableDoctorRooms)).toContain(RolesGuard);
	});
	it('excludes occupied, unavailable and legacy assigned rooms', async () => {
		const sort = jest.fn(),
			limit = jest.fn(),
			lean = jest.fn();
		rooms.find.mockReturnValue({ sort });
		sort.mockReturnValue({ limit });
		limit.mockReturnValue({ lean });
		lean.mockReturnValue(exec([]));
		await service.getAvailableDoctorRooms();
		expect(rooms.find).toHaveBeenCalledWith({
			roomStatus: RoomStatus.AVAILABLE,
			roomNumber: { $nin: ['101'] },
			assignedDoctorId: null,
		});
		expect(doctors.distinct).toHaveBeenCalledWith(
			'docRoom',
			expect.objectContaining({ memberStatus: { $ne: MemberStatus.DELETE } }),
		);
	});
	it('rejects a room already used by a nondeleted doctor before reserving it', async () => {
		doctors.findOne.mockReturnValue(exec({ _id: new Types.ObjectId(), memberStatus: MemberStatus.BLOCK }));
		await expect(service.createDoctorByAdmin(input as never)).rejects.toThrow('already assigned');
		expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
		expect(doctors.create).not.toHaveBeenCalled();
	});
	it('rejects unavailable or concurrently claimed room without creating a doctor', async () => {
		rooms.findOneAndUpdate.mockReturnValue(exec(null));
		await expect(service.createDoctorByAdmin(input as never)).rejects.toThrow('unavailable');
		expect(doctors.create).not.toHaveBeenCalled();
	});
	it('reserves the exact room atomically using the same doctor ID', async () => {
		const result = await service.createDoctorByAdmin(input as never);
		expect(rooms.findOneAndUpdate).toHaveBeenCalledWith(
			{ roomNumber: '201', roomStatus: RoomStatus.AVAILABLE, assignedDoctorId: null },
			{ $set: { assignedDoctorId: result._id } },
			{ new: true },
		);
		expect(result.docRoom).toBe('201');
		expect(result.docPassword).toBe('hash');
	});
	it('releases only its own reservation when doctor creation fails', async () => {
		doctors.create.mockRejectedValue({ code: 11000 });
		await expect(service.createDoctorByAdmin(input as never)).rejects.toThrow();
		const doctorId = rooms.findOneAndUpdate.mock.calls[0][1].$set.assignedDoctorId;
		expect(rooms.updateOne).toHaveBeenCalledWith(
			{ _id: roomId, assignedDoctorId: doctorId },
			{ $unset: { assignedDoctorId: 1 } },
		);
	});
	it('releases the doctor room on deletion', async () => {
		const doctorId = new Types.ObjectId();
		doctors.findOne.mockReturnValue(exec({ _id: doctorId, memberStatus: MemberStatus.ACTIVE }));
		doctors.findOneAndUpdate.mockReturnValue(exec({ _id: doctorId, memberStatus: MemberStatus.DELETE }));
		await service.updateStatusByAdmin(doctorId, MemberStatus.DELETE);
		expect(rooms.updateOne).toHaveBeenCalledWith({ assignedDoctorId: doctorId }, { $unset: { assignedDoctorId: 1 } });
	});
});
