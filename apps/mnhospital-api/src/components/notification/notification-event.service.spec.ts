import { Types } from 'mongoose';
import { MemberType } from '../member/enums/member.enum';
import { NotificationGroup, NotificationType } from './enums/notification.enum';
import { NotificationEventService } from './notification-event.service';

describe('NotificationEventService', () => {
	const patientProfileId = new Types.ObjectId();
	const memberId = new Types.ObjectId();
	const refId = new Types.ObjectId();
	const exec = jest.fn();
	const patientModel = { findById: jest.fn(() => ({ select: () => ({ lean: () => ({ exec }) }) })) };
	const notificationService = { createEventNotification: jest.fn() };
	const service = new NotificationEventService(patientModel as never, notificationService as never);
	const event = {
		key: `appointment:${refId}:confirmed`,
		type: NotificationType.APPOINTMENT,
		group: NotificationGroup.APPOINTMENT,
		title: 'Appointment confirmed',
		description: 'Your appointment status changed.',
		refId,
	};

	beforeEach(() => jest.clearAllMocks());

	it('routes patient events to the login member ID, not the patient profile ID', async () => {
		exec.mockResolvedValue({ memberId });
		await service.toPatient(patientProfileId, event);
		expect(patientModel.findById).toHaveBeenCalledWith(patientProfileId);
		expect(notificationService.createEventNotification).toHaveBeenCalledWith(
			`${event.key}:${MemberType.PATIENT}:${memberId}`,
			expect.objectContaining({ receiverId: memberId, receiverType: MemberType.PATIENT, notificationRefId: refId }),
		);
	});

	it('does not invent a receiver for a profile without a member account', async () => {
		exec.mockResolvedValue({});
		await service.toPatient(patientProfileId, event);
		expect(notificationService.createEventNotification).not.toHaveBeenCalled();
	});

	it('routes doctor events directly to the doctor account', async () => {
		const doctorId = new Types.ObjectId();
		await service.toDoctor(doctorId, event);
		expect(notificationService.createEventNotification).toHaveBeenCalledWith(
			`${event.key}:${MemberType.DOCTOR}:${doctorId}`,
			expect.objectContaining({ receiverId: doctorId, receiverType: MemberType.DOCTOR }),
		);
	});
});
