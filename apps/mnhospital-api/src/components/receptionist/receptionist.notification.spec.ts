import { Types } from 'mongoose';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberType } from '../member/enums/member.enum';
import { ReceptionTaskStatus } from './enums/receptionist.enum';
import { ReceptionistService } from './receptionist.service';

describe('Reception task notification triggers', () => {
	const receptionistId = new Types.ObjectId();
	const doctorId = new Types.ObjectId();
	const patientId = new Types.ObjectId();
	const appointmentId = new Types.ObjectId();
	const taskId = new Types.ObjectId();
	const receptionTaskModel = { create: jest.fn(), findById: jest.fn() };
	const appointmentModel = { findOne: jest.fn() };
	const notificationEvents = { toReceptionist: jest.fn(), toDoctor: jest.fn() };
	const service = new ReceptionistService(
		receptionTaskModel as never, appointmentModel as never, {} as never, {} as never,
		{} as never, {} as never, notificationEvents as never,
	);

	beforeEach(() => jest.clearAllMocks());

	it('notifies the assigned receptionist only after task creation', async () => {
		appointmentModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => ({
			_id: appointmentId, patientId, doctorId, appointmentStatus: AppointmentStatus.CONFIRMED,
		}) }) });
		receptionTaskModel.create.mockResolvedValue({ _id: taskId });
		await service.createTask(receptionistId, MemberType.RECEPTIONIST, { appointmentId } as never);
		expect(notificationEvents.toReceptionist).toHaveBeenCalledWith(receptionistId, expect.objectContaining({ key: `reception-task:${taskId}:assigned` }));
	});

	it('notifies the doctor after an assigned task is completed', async () => {
		const task = {
			_id: taskId, doctorId, receptionistId, taskStatus: ReceptionTaskStatus.IN_PROGRESS,
			statusHistory: [], save: jest.fn(),
		};
		task.save.mockResolvedValue(task);
		receptionTaskModel.findById.mockReturnValue({ exec: async () => task });
		await service.updateTask(receptionistId, MemberType.RECEPTIONIST, { taskId, taskStatus: ReceptionTaskStatus.COMPLETED, taskResult: 'Done' } as never);
		expect(notificationEvents.toDoctor).toHaveBeenCalledWith(doctorId, expect.objectContaining({ key: `reception-task:${taskId}:completed` }));
	});

	it('does not notify when an invalid task transition is rejected', async () => {
		const task = { _id: taskId, doctorId, receptionistId, taskStatus: ReceptionTaskStatus.PENDING, statusHistory: [] };
		receptionTaskModel.findById.mockReturnValue({ exec: async () => task });
		await expect(service.updateTask(receptionistId, MemberType.RECEPTIONIST, { taskId, taskStatus: ReceptionTaskStatus.COMPLETED, taskResult: 'Done' } as never)).rejects.toThrow();
		expect(notificationEvents.toDoctor).not.toHaveBeenCalled();
	});
});
