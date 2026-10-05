import { Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { MemberType } from '../member/enums/member.enum';
import { NotificationStatus } from './enums/notification.enum';
import { NotificationService } from './notification.service';

describe('NotificationService receiver ownership', () => {
	const receiverId = new Types.ObjectId();
	const notificationId = new Types.ObjectId();
	const exec = jest.fn();
	const model = {
		aggregate: jest.fn(() => ({ exec })),
		findOne: jest.fn(() => ({ exec })),
		findOneAndUpdate: jest.fn(() => ({ exec })),
		updateMany: jest.fn(() => ({ exec })),
	};
	const service = new NotificationService(model as never);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('scopes the inbox query to the JWT receiver ID and role', async () => {
		exec.mockResolvedValue([{ list: [], metaCounter: [] }]);
		await service.getMyNotifications(receiverId, MemberType.PATIENT, { page: 1, limit: 10 });
		expect(model.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
			{ $match: { receiverId, receiverType: MemberType.PATIENT } },
		]));
	});

	it('does not return another receiver’s notification', async () => {
		exec.mockResolvedValue(null);
		await expect(service.getMyNotification(receiverId, MemberType.PATIENT, notificationId)).rejects.toBeInstanceOf(NotFoundException);
		expect(model.findOne).toHaveBeenCalledWith({ _id: notificationId, receiverId, receiverType: MemberType.PATIENT });
	});

	it('scopes read and archive updates to the receiver', async () => {
		exec.mockResolvedValue({ _id: notificationId });
		await service.markMyNotificationRead(receiverId, MemberType.PATIENT, notificationId);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: notificationId, receiverId, receiverType: MemberType.PATIENT, notificationStatus: NotificationStatus.UNREAD },
			{ $set: { notificationStatus: NotificationStatus.READ } },
			{ new: true },
		);

		await service.archiveMyNotification(receiverId, MemberType.PATIENT, notificationId);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: notificationId, receiverId, receiverType: MemberType.PATIENT, notificationStatus: { $ne: NotificationStatus.ARCHIVED } },
			{ $set: { notificationStatus: NotificationStatus.ARCHIVED } },
			{ new: true },
		);
	});

	it('only marks this receiver’s unread notifications in bulk', async () => {
		exec.mockResolvedValue({ modifiedCount: 2 });
		await expect(service.markAllMyNotificationsRead(receiverId, MemberType.PATIENT)).resolves.toBe(2);
		expect(model.updateMany).toHaveBeenCalledWith(
			{ receiverId, receiverType: MemberType.PATIENT, notificationStatus: NotificationStatus.UNREAD },
			{ $set: { notificationStatus: NotificationStatus.READ } },
		);
	});
});
