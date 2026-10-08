import { Types } from 'mongoose';
import { AppointmentService } from './appointment.service';
import { ReceptionistService } from '../receptionist/receptionist.service';
import { MemberType } from '../member/enums/member.enum';
import { ReceptionTaskStatus } from '../receptionist/enums/receptionist.enum';
import { appointmentPatientPreview } from './patient-preview';

describe('Staff appointment patient thumbnails', () => {
	const actor = new Types.ObjectId(),
		otherDoctor = new Types.ObjectId(),
		appointmentId = new Types.ObjectId();
	let appointments: any, tasks: any;
	beforeEach(() => {
		appointments = { aggregate: jest.fn(() => ({ exec: async () => [{ list: [], metaCounter: [] }] })) };
		tasks = {
			distinct: jest.fn(async () => [appointmentId]),
			find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => [{ appointmentId }] }) }) })),
		};
	});
	it('projects only the patient display name and image, excluding deleted profiles', () => {
		expect(appointmentPatientPreview()[0]).toEqual({
			$lookup: {
				from: 'patients',
				localField: 'patientId',
				foreignField: '_id',
				pipeline: [
					{ $match: { deletedAt: { $exists: false } } },
					{ $project: { _id: 0, patientFullName: 1, patientImage: 1 } },
				],
				as: 'patientPreview',
			},
		});
	});
	it('keeps doctor ownership ahead of the thumbnail lookup even with another doctor filter', async () => {
		const service = new AppointmentService(appointments, null, tasks, null, null, null);
		await service.getStaffAppointments(actor, MemberType.DOCTOR, { page: 1, limit: 10, doctorId: otherDoctor });
		const pipeline = appointments.aggregate.mock.calls[0][0];
		expect(pipeline[0]).toEqual({ $match: { doctorId: actor } });
		expect(pipeline[2].$facet.list.slice(0, 2)).toEqual([{ $skip: 0 }, { $limit: 10 }]);
		expect(pipeline[2].$facet.list.slice(2)).toEqual(appointmentPatientPreview());
	});
	it('only enriches the assigned active reception queue', async () => {
		const service = new ReceptionistService(tasks, appointments, null, null, null, null, null);
		await service.getMyAppointmentQueue(actor, { page: 1, limit: 6 });
		expect(tasks.distinct).toHaveBeenCalledWith('appointmentId', {
			receptionistId: actor,
			taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] },
		});
		expect(appointments.aggregate.mock.calls[0][0][0].$match._id).toEqual({ $in: [appointmentId] });
	});
	it('does not query patients when reception has no assigned appointments', async () => {
		tasks.distinct.mockResolvedValue([]);
		const service = new ReceptionistService(tasks, appointments, null, null, null, null, null);
		expect(await service.getMyAppointmentQueue(actor, { page: 1, limit: 6 })).toEqual({ list: [], metaCounter: [] });
		expect(appointments.aggregate).not.toHaveBeenCalled();
	});
});
