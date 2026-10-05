import { model, Types } from 'mongoose';
import NotificationSchema from './Notification.model';
import { MemberType } from '../../member/enums/member.enum';
import { NotificationGroup, NotificationType } from '../enums/notification.enum';

const NotificationModel = model('NotificationSchemaTest', NotificationSchema);

const validNotification = () => ({
	notificationType: NotificationType.APPOINTMENT,
	notificationGroup: NotificationGroup.APPOINTMENT,
	notificationTitle: 'Appointment confirmed',
	notificationDesc: 'Your appointment has been confirmed.',
	authorId: new Types.ObjectId(),
	authorType: MemberType.RECEPTIONIST,
	receiverId: new Types.ObjectId(),
	receiverType: MemberType.PATIENT,
	notificationRefId: new Types.ObjectId(),
});

describe('Notification schema', () => {
	it('requires a nonblank title and description', async () => {
		const notification = new NotificationModel({ ...validNotification(), notificationTitle: '   ', notificationDesc: '  ' });
		await expect(notification.validate()).rejects.toMatchObject({ name: 'ValidationError' });
	});

	it('rejects overlong text before an event can persist it', async () => {
		const notification = new NotificationModel({ ...validNotification(), notificationTitle: 'x'.repeat(151) });
		await expect(notification.validate()).rejects.toMatchObject({ name: 'ValidationError' });
	});

	it('indexes the receiver for both filtered and default newest-first lists', () => {
		const indexes = NotificationSchema.indexes().map(([keys]) => keys);
		expect(indexes).toContainEqual({ receiverId: 1, receiverType: 1, notificationStatus: 1, createdAt: -1 });
		expect(indexes).toContainEqual({ receiverId: 1, receiverType: 1, createdAt: -1 });
	});
});
