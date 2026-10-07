import { Types } from 'mongoose';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberType } from '../member/enums/member.enum';
import { AppointmentService } from './appointment.service';

describe('Appointment notification triggers', () => {
	const memberId = new Types.ObjectId();
	const patientId = new Types.ObjectId();
	const doctorId = new Types.ObjectId();
	const appointmentId = new Types.ObjectId();
	const orderId = new Types.ObjectId();
	const serviceId = new Types.ObjectId();
	const startsAt = new Date('2026-11-01T09:00:00.000Z');
	const endsAt = new Date('2026-11-01T09:30:00.000Z');
	const appointment = {
		_id: appointmentId,
		patientId,
		doctorId,
		appointmentStatus: AppointmentStatus.PENDING,
		statusHistory: [],
		save: jest.fn(),
	};
	const appointmentModel = {
		findOne: jest.fn(),
		findById: jest.fn(),
		create: jest.fn(),
		deleteOne: jest.fn(),
	};
	const bookingOrderModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
	const patientService = { resolveProfileId: jest.fn() };
	const notificationEvents = { toPatient: jest.fn(), toDoctor: jest.fn() };
	const service = new AppointmentService(
		appointmentModel as never,
		bookingOrderModel as never,
		{} as never,
		patientService as never,
		notificationEvents as never,
		{ findOne: () => ({ lean: () => ({ exec: async () => ({ _id: new Types.ObjectId() }) }) }) } as never,
	);

	beforeEach(() => {
		jest.clearAllMocks();
		appointment.appointmentStatus = AppointmentStatus.PENDING;
		appointment.statusHistory = [];
		appointment.save.mockResolvedValue(appointment);
		patientService.resolveProfileId.mockResolvedValue(patientId);
	});

	it('notifies patient and doctor only after an appointment is linked to the booking order', async () => {
		bookingOrderModel.findOne.mockReturnValue({
			exec: async () => ({
				_id: orderId,
				bookingOrderItems: [
					{
						serviceId: String(serviceId),
						doctorId: String(doctorId),
						requestedStartAt: startsAt.toISOString(),
						serviceDuration: '30',
					},
				],
			}),
		});
		appointmentModel.findOne.mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => null }) }) });
		appointmentModel.create.mockResolvedValue(appointment);
		bookingOrderModel.findOneAndUpdate.mockReturnValue({ exec: async () => ({ _id: orderId }) });
		await service.createAppointment(memberId, {
			bookingOrderId: orderId,
			serviceId,
			doctorId,
			roomId: new Types.ObjectId(),
			startsAt,
			endsAt,
		} as never);
		expect(bookingOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId,
				bookingOrderItems: {
					$elemMatch: { serviceId: String(serviceId), doctorId: String(doctorId), appointmentId: { $exists: false } },
				},
			}),
			{ $set: { 'bookingOrderItems.$.appointmentId': String(appointmentId) } },
			{ new: true },
		);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(
			patientId,
			expect.objectContaining({ refId: appointmentId }),
		);
		expect(notificationEvents.toDoctor).toHaveBeenCalledWith(
			doctorId,
			expect.objectContaining({ refId: appointmentId }),
		);
	});

	it('notifies the doctor after a patient cancellation is saved', async () => {
		appointmentModel.findOne.mockReturnValue({ exec: async () => appointment });
		await service.cancelAppointment(memberId, appointmentId);
		expect(notificationEvents.toDoctor).toHaveBeenCalledWith(
			doctorId,
			expect.objectContaining({ key: `appointment:${appointmentId}:cancelled` }),
		);
	});

	it('notifies the patient after an allowed status transition', async () => {
		appointmentModel.findById.mockReturnValue({ exec: async () => appointment });
		await service.updateAppointmentStatus(doctorId, MemberType.DOCTOR, appointmentId, AppointmentStatus.CONFIRMED);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(
			patientId,
			expect.objectContaining({ key: `appointment:${appointmentId}:CONFIRMED` }),
		);
		expect(notificationEvents.toDoctor).not.toHaveBeenCalled();
	});

	it('does not notify when the status transition is rejected', async () => {
		appointmentModel.findById.mockReturnValue({ exec: async () => appointment });
		await expect(
			service.updateAppointmentStatus(doctorId, MemberType.DOCTOR, appointmentId, AppointmentStatus.COMPLETED),
		).rejects.toThrow();
		expect(notificationEvents.toPatient).not.toHaveBeenCalled();
	});
});
